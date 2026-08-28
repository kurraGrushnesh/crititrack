"use strict";

/**
 * Benchmark harness.
 *
 * Scores a labelled set with each method and reports accuracy, macro-F1,
 * latency and cost, so "the ensemble is better than one LLM call" is a
 * number rather than a claim.
 *
 * Usage:
 *   node benchmark/run.js                 lexicon only, no key needed
 *   GROQ_API_KEY=... node benchmark/run.js   adds the LLM and the ensemble
 *
 * Writes benchmark/results.json.
 */

const fs = require("node:fs");
const path = require("node:path");

const lexicon = require("../lib/sentiment/lexicon");
const {blendItem} = require("../lib/sentiment/ensemble");

/** Score bands used to turn a 0-100 number into a label. */
const POSITIVE_AT = 65;
const NEGATIVE_BELOW = 40;

/** @param {number|null} score @return {string|null} */
function toLabel(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= POSITIVE_AT) return "positive";
  if (score < NEGATIVE_BELOW) return "negative";
  return "neutral";
}

/**
 * Accuracy plus per-class precision, recall and F1.
 *
 * Macro-F1 is reported alongside accuracy because accuracy alone hides a
 * method that simply guesses the majority class.
 *
 * @param {Array<{predicted: string|null, actual: string}>} rows
 * @return {object}
 */
function score(rows) {
  const labels = ["positive", "neutral", "negative"];
  const scored = rows.filter((r) => r.predicted !== null);

  const correct = scored.filter((r) => r.predicted === r.actual).length;
  const accuracy = scored.length ? correct / scored.length : 0;

  const perClass = {};
  let f1Total = 0;

  for (const label of labels) {
    const tp = scored.filter(
        (r) => r.predicted === label && r.actual === label,
    ).length;
    const fp = scored.filter(
        (r) => r.predicted === label && r.actual !== label,
    ).length;
    const fn = scored.filter(
        (r) => r.predicted !== label && r.actual === label,
    ).length;

    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

    perClass[label] = {
      precision: round3(precision),
      recall: round3(recall),
      f1: round3(f1),
      support: scored.filter((r) => r.actual === label).length,
    };
    f1Total += f1;
  }

  return {
    accuracy: round3(accuracy),
    macroF1: round3(f1Total / labels.length),
    scored: scored.length,
    skipped: rows.length - scored.length,
    perClass,
  };
}

/** @param {number} v @return {number} */
function round3(v) {
  return Math.round(v * 1000) / 1000;
}

async function main() {
  const dataPath = path.join(__dirname, "labelled.json");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const items = data.items || [];
  const texts = items.map((i) => i.text);

  if (items.length === 0) {
    console.error("No labelled items found.");
    process.exit(1);
  }

  const methods = {};

  // ── Lexicon ─────────────────────────────────────────────────────
  let t0 = Date.now();
  const lexScores = lexicon.scoreAll(texts);
  const lexMs = Date.now() - t0;
  methods.lexicon = {
    ...score(
        items.map((it, i) => ({
          predicted: toLabel(lexScores[i]),
          actual: it.label,
        })),
    ),
    latencyMsTotal: lexMs,
    latencyMsPerItem: round3(lexMs / items.length),
    costPer1000Usd: 0,
    note: "VADER lexicon. No network, no cost.",
  };

  // ── LLM and ensemble, only with a key ───────────────────────────
  const key = process.env.GROQ_API_KEY;
  if (key) {
    const {scoreItemsBatch} = require("../lib/groq");

    t0 = Date.now();
    const llm = await scoreItemsBatch(key, texts);
    const llmMs = Date.now() - t0;

    methods.llm = {
      ...score(
          items.map((it, i) => ({
            predicted: toLabel(llm[i] ? llm[i].score : null),
            actual: it.label,
          })),
      ),
      latencyMsTotal: llmMs,
      latencyMsPerItem: round3(llmMs / items.length),
      note: "Single batched Groq call scoring every item.",
    };

    methods.ensemble = {
      ...score(
          items.map((it, i) => {
            const b = blendItem({
              lexicon: lexScores[i],
              llm: llm[i] ? llm[i].score : null,
            });
            return {predicted: toLabel(b ? b.score : null), actual: it.label};
          }),
      ),
      latencyMsTotal: llmMs + lexMs,
      latencyMsPerItem: round3((llmMs + lexMs) / items.length),
      note: "Weighted blend of lexicon and LLM.",
    };
  } else {
    console.warn(
        "GROQ_API_KEY not set — only the lexicon was measured. " +
      "The LLM and ensemble rows are omitted rather than estimated.",
    );
  }

  const results = {
    generatedAt: new Date().toISOString(),
    dataset: {
      path: "benchmark/labelled.json",
      items: items.length,
      note: data._note,
    },
    thresholds: {positiveAt: POSITIVE_AT, negativeBelow: NEGATIVE_BELOW},
    methods,
  };

  const outPath = path.join(__dirname, "results.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2) + "\n");

  console.log(`\n  ${items.length} labelled items\n`);
  console.log(
      "  method".padEnd(14) + "accuracy".padStart(10) +
    "macroF1".padStart(10) + "ms/item".padStart(10),
  );
  console.log("  " + "-".repeat(42));
  for (const [name, m] of Object.entries(methods)) {
    console.log(
        "  " + name.padEnd(12) +
      String(m.accuracy).padStart(10) +
      String(m.macroF1).padStart(10) +
      String(m.latencyMsPerItem).padStart(10),
    );
  }
  console.log(`\n  wrote ${path.relative(process.cwd(), outPath)}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
