"use strict";

const {fetchWithTimeout, parseLlmJson} = require("./httpUtil");
const logger = require("firebase-functions/logger");

const BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MODEL = "qwen/qwen3.6-27b";

/**
 * One chat-completion call with automatic model fallback on HTTP 404
 * (primary model deprecated / removed).
 *
 * @param {string} apiKey
 * @param {string} prompt
 * @param {number} [temperature]
 * @return {Promise<string>} the assistant message content
 */
async function callGroq(apiKey, prompt, temperature = 0.4) {
  const body = (model) => JSON.stringify({
    model,
    messages: [{role: "user", content: prompt}],
    temperature,
    response_format: {type: "json_object"},
  });

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  let res = await fetchWithTimeout(BASE_URL, {
    method: "POST", headers, body: body(PRIMARY_MODEL),
  }, 30000);

  if (res.status === 404) {
    logger.warn(`Groq primary "${PRIMARY_MODEL}" 404 — falling back to "${FALLBACK_MODEL}"`);
    res = await fetchWithTimeout(BASE_URL, {
      method: "POST", headers, body: body(FALLBACK_MODEL),
    }, 30000);
  }

  if (res.status === 401) throw new ApiError("groq_auth", "Invalid Groq API key", 502);
  if (res.status === 429) throw new ApiError("groq_rate", "Groq rate limit", 429);
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError("groq_error", `Groq HTTP ${res.status}: ${text.slice(0, 300)}`, 502);
  }

  const json = await res.json();
  return json.choices[0].message.content;
}

/**
 * Structured biography + controversy analysis.
 *
 * @param {string} apiKey
 * @param {string} name
 * @return {Promise<object>}
 */
async function fetchBiography(apiKey, name) {
  const prompt = `You are a celebrity biography and public-controversy analyst. Return ONLY valid JSON with this exact structure:
{
  "profession": "string — their primary profession/title",
  "summary": "string — 2-3 sentence overview of who they are",
  "background": "string — 2-3 paragraphs covering early life, career trajectory, and current status",
  "notableWorks": ["string array — 5-8 most notable achievements, albums, films, companies, etc."],
  "controversies": [
    {
      "title": "string — <= 10 word headline for the episode",
      "summary": "string — 1-3 neutral, factual sentences on what happened and the response",
      "category": "one of: Legal, Financial, Social media, Personal conduct, Political, Professional, Relationships, Other",
      "severity": 1,
      "status": "one of: ongoing, resolved, historical",
      "year": 2020,
      "sources": ["publication name or URL", "..."]
    }
  ]
}
Rules:
- "controversies" holds 0-6 of the most significant, well-documented episodes. Use an empty array if there are none.
- severity is an integer 1-5: 1 = minor backlash, 3 = sustained public criticism, 5 = major scandal with lasting legal/career consequences.
- "year" is the approximate year it began; omit the field entirely if genuinely unknown.
- Stay factual and neutral. Do not invent controversies; omit anything you are not confident is real and reported.
- Do not include any text outside the JSON object. Do not wrap in markdown code blocks.

Generate a comprehensive biography for: ${name}`;

  const content = await callGroq(apiKey, prompt, 0.4);
  const j = parseLlmJson(content);
  return {
    profession: j.profession || "Public Figure",
    summary: j.summary || "",
    background: j.background || "",
    notableWorks: Array.isArray(j.notableWorks) ? j.notableWorks : [],
    controversies: Array.isArray(j.controversies) ? j.controversies : [],
  };
}

/**
 * Sentiment analysis over a list of headlines, with model-cited evidence.
 *
 * @param {string} apiKey
 * @param {string} name
 * @param {string[]} headlines
 * @param {string[]} sourceLabels
 * @return {Promise<object>}
 */
async function analyzeSentiment(apiKey, name, headlines, sourceLabels) {
  if (!headlines.length) {
    return defaultSentiment("No recent headlines available for sentiment analysis.");
  }

  const list = headlines
      .map((h, i) => {
        const label = sourceLabels[i] ? ` [${sourceLabels[i]}]` : "";
        return `${i + 1}. ${h}${label}`;
      })
      .join("\n");

  const prompt = `You are a sentiment analysis expert specializing in celebrity media coverage.
Analyze the provided headlines and return ONLY valid JSON with no markdown or code blocks:
{
  "positiveRatio": 0.0,
  "negativeRatio": 0.0,
  "neutralRatio": 0.0,
  "overallScore": 0,
  "trendDirection": "up",
  "dominantEmotion": "string",
  "trendData": [
    {"day": "Mon", "score": 0}, {"day": "Tue", "score": 0}, {"day": "Wed", "score": 0},
    {"day": "Thu", "score": 0}, {"day": "Fri", "score": 0}, {"day": "Sat", "score": 0},
    {"day": "Sun", "score": 0}
  ],
  "explanation": "string — 2-3 paragraphs explaining the sentiment trend",
  "evidence": [
    {"fragment": "<= 12 word excerpt that drove the score", "source": "news|youtube|instagram"}
  ]
}
Rules: ratios must sum to 1.0. overallScore is 0-100. trendDirection is one of: "up", "down", "stable".
evidence should contain 1-2 short excerpts (<= 12 words) with a source type.

Analyze sentiment for ${name} based on these recent headlines:

${list}`;

  const content = await callGroq(apiKey, prompt, 0.3);
  const j = parseLlmJson(content);

  const trendData = Array.isArray(j.trendData) && j.trendData.length ?
    j.trendData.map((d, i) => ({
      day: d.day || `Day ${i + 1}`,
      score: numOr(d.score, 50),
    })) :
    defaultTrend();

  const evidence = Array.isArray(j.evidence) ?
    j.evidence
        .map((e) => ({fragment: e.fragment || "", source: e.source || "news"}))
        .filter((e) => e.fragment) :
    [];

  return {
    overallScore: numOr(j.overallScore, 50),
    positiveRatio: numOr(j.positiveRatio, 0.33),
    negativeRatio: numOr(j.negativeRatio, 0.33),
    neutralRatio: numOr(j.neutralRatio, 0.34),
    trendDirection: j.trendDirection || "stable",
    explanation: j.explanation || "",
    dominantEmotion: j.dominantEmotion || "neutral",
    trendData,
    evidence,
  };
}

/**
 * Single-source sentiment score 0-100.
 *
 * @param {string} apiKey
 * @param {string} name
 * @param {string[]} texts
 * @param {string} sourceName
 * @return {Promise<number|null>}
 */
async function analyzeSourceSentiment(apiKey, name, texts, sourceName) {
  if (!texts.length) return null;
  const list = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const prompt = `You are a sentiment analysis expert. Analyze the following ${sourceName} content about ${name}.
Return ONLY valid JSON: {"sentimentScore": 0}
sentimentScore is 0-100 (0=very negative, 100=very positive). No text outside the JSON.

Content:
${list}`;
  try {
    const content = await callGroq(apiKey, prompt, 0.3);
    const j = parseLlmJson(content);
    return clamp(numOr(j.sentimentScore, 50), 0, 100);
  } catch (e) {
    logger.warn(`source sentiment (${sourceName}) failed: ${e.message}`);
    return null;
  }
}

// ── helpers ────────────────────────────────────────────────────────────

/** @param {any} v @param {number} d @return {number} */
function numOr(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
/** @param {number} v @param {number} lo @param {number} hi @return {number} */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
/** @return {Array<{day: string, score: number}>} */
function defaultTrend() {
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => ({day, score: 50}));
}
/** @param {string} explanation @return {object} */
function defaultSentiment(explanation) {
  return {
    overallScore: 50, positiveRatio: 0.33, negativeRatio: 0.33,
    neutralRatio: 0.34, trendDirection: "stable", explanation,
    dominantEmotion: "neutral", trendData: defaultTrend(), evidence: [],
  };
}

/** Typed error carrying an HTTP status for the response layer. */
class ApiError extends Error {
  /** @param {string} code @param {string} message @param {number} status */
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

module.exports = {
  fetchBiography,
  analyzeSentiment,
  analyzeSourceSentiment,
  defaultSentiment,
  ApiError,
};
