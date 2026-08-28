"use strict";

/**
 * Input validation and normalisation for the public API.
 *
 * The `name` query parameter is attacker-controlled and flows into an LLM
 * prompt, so it is bounded and character-restricted before it is used:
 *
 *   - An unbounded value is billed to us as input tokens.
 *   - A crafted value ("ignore previous instructions...") steers the model,
 *     and its output is rendered in the app as a factual profile.
 *
 * Restricting the character set to what real personal names contain removes
 * the punctuation and newlines that injection payloads rely on, while still
 * accepting non-Latin scripts, accents, apostrophes and hyphens.
 */

/** Longest name we will accept. Comfortably above any real personal name. */
const MAX_NAME_LENGTH = 80;
const MIN_NAME_LENGTH = 2;

/**
 * Letters and combining marks from any script, plus the separators real
 * names use. Deliberately excludes newlines, braces, quotes, backticks and
 * every other character an injection payload needs to be legible.
 */
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'\u2019-]*[\p{L}\p{M}.]$/u;

/** Rejected outright: these read as instructions, not names. */
const INJECTION_MARKERS = [
  "ignore previous",
  "ignore prior",
  "ignore all",
  "disregard",
  "system prompt",
  "you are now",
  "new instructions",
  "act as",
];

class ValidationError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.status = 400;
  }
}

/**
 * Validates and canonicalises a celebrity name.
 *
 * @param {unknown} raw the untrusted query parameter
 * @return {{name: string, slug: string}} safe to use downstream
 * @throws {ValidationError} when the input is unusable or hostile
 */
function validateName(raw) {
  if (typeof raw !== "string") {
    throw new ValidationError("missing_name", "?name= is required");
  }

  // Collapse all whitespace runs (including any newlines) to single spaces
  // before measuring, so padding cannot be used to smuggle length.
  const name = raw.replace(/\s+/gu, " ").trim();

  if (name.length === 0) {
    throw new ValidationError("missing_name", "?name= is required");
  }
  if (name.length < MIN_NAME_LENGTH) {
    throw new ValidationError("name_too_short", "Name is too short");
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
        "name_too_long",
        `Name must be ${MAX_NAME_LENGTH} characters or fewer`,
    );
  }
  if (!NAME_PATTERN.test(name)) {
    throw new ValidationError(
        "name_invalid",
        "Name may only contain letters, spaces, apostrophes, hyphens and periods",
    );
  }

  const lowered = name.toLowerCase();
  if (INJECTION_MARKERS.some((m) => lowered.includes(m))) {
    throw new ValidationError("name_invalid", "That is not a valid name");
  }

  return {name, slug: toSlug(name)};
}

/**
 * URL-safe lowercase slug. This is the canonical cache key, so every
 * spelling variant of one name must collapse to the same value.
 *
 * @param {string} s
 * @return {string}
 */
function toSlug(s) {
  const ascii = s
      .normalize("NFD")
      // Strip combining marks so "Beyoncé" and "Beyonce" share a key.
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "");

  // Names written entirely in a non-Latin script reduce to an empty string
  // above, which would make every such name collide on one cache key.
  // Fall back to a deterministic hash of the normalised name so each still
  // gets its own stable, URL-safe document id.
  if (ascii.length === 0) {
    return `n-${fnv1a(s.normalize("NFC").toLowerCase())}`;
  }
  return ascii;
}

/**
 * FNV-1a, 32-bit. Small, dependency-free and deterministic across runs —
 * the only properties needed for a cache key.
 *
 * @param {string} str
 * @return {string} lowercase hex
 */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

module.exports = {
  validateName,
  toSlug,
  ValidationError,
  MAX_NAME_LENGTH,
  MIN_NAME_LENGTH,
};
