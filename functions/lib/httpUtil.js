"use strict";

/**
 * fetch with a timeout. Node 24 provides a global fetch/AbortController.
 *
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs]
 * @return {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {...options, signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strips markdown code fences an LLM sometimes wraps JSON in, then parses.
 *
 * @param {string} raw
 * @return {any}
 */
function parseLlmJson(raw) {
  const cleaned = String(raw)
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();
  return JSON.parse(cleaned);
}

module.exports = {fetchWithTimeout, parseLlmJson};
