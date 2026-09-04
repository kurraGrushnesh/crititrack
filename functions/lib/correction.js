"use strict";

/**
 * Validation for "report a correction" submissions.
 *
 * This is the authoritative copy of the correction-form rules. Two other
 * copies must agree with it: `site/lib/correction.ts` (the web form, which
 * runs the same checks before it will submit) and
 * `lib/core/security/correction.dart` (the Flutter form). A change to a
 * bound or an allowed value here needs the identical change in both, plus
 * a matching test case in each suite.
 *
 * The endpoint cannot trust that a client ran its copy, so it runs this
 * one again on every request.
 */

const {parseSafeUrl} = require("./safeUrl");

const CORRECTION_FIELDS = [
  "biography",
  "controversy",
  "sentiment",
  "image",
  "other",
];

/**
 * What the submission is.
 *
 *   "correction" — anyone reporting that something on the profile is
 *                  wrong. The default, and the historic behaviour.
 *   "response"   — the subject of the profile (or their representative)
 *                  giving their side of a claim that is rendered. Stored
 *                  the same way; a moderator may then attach it to the
 *                  profile so it shows inline beside the claim, which is
 *                  the point of the editorial position: a named living
 *                  person gets to be heard on their own page.
 */
const CORRECTION_KINDS = ["correction", "response"];

const SLUG_MAX_LENGTH = 90;
const CLAIM_MIN_LENGTH = 10;
const CLAIM_MAX_LENGTH = 600;
const CORRECTION_MIN_LENGTH = 10;
const CORRECTION_MAX_LENGTH = 1000;
const EMAIL_MAX_LENGTH = 254;

/** Matches the slugs `validate.toSlug` produces, including `n-<hex>`. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Free text that reads as an instruction to a model, not as a report. */
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

/** A rejected submission. `field` names the offending input. */
class CorrectionError extends Error {
  /** @param {string} field @param {string} code @param {string} message */
  constructor(field, code, message) {
    super(message);
    this.name = "CorrectionError";
    this.field = field;
    this.code = code;
    this.status = 400;
  }
}

/** @param {unknown} v @return {string} */
function asString(v) {
  return typeof v === "string" ? v : "";
}

/** @param {string} v @return {string} */
function collapseWhitespace(v) {
  return v.replace(/\s+/gu, " ").trim();
}

/** @param {string} field @param {string} text */
function assertNoInjection(field, text) {
  const lowered = text.toLowerCase();
  if (INJECTION_MARKERS.some((m) => lowered.includes(m))) {
    throw new CorrectionError(
        field,
        "looks_like_instruction",
        "That reads as an instruction rather than a description.",
    );
  }
}

/**
 * Validates and normalises a correction submission. Throws
 * {@link CorrectionError} on the first problem.
 *
 * @param {Record<string, unknown>} input
 * @return {{slug: string, field: string, claim: string,
 *   correction: string, evidenceUrl: string|null, email: string|null}}
 */
function validateCorrection(input) {
  const raw = input && typeof input === "object" ? input : {};

  const slug = asString(raw.slug).trim().toLowerCase();
  if (slug.length === 0) {
    throw new CorrectionError("slug", "missing", "No profile was named.");
  }
  if (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new CorrectionError(
        "slug", "invalid", "That profile id is not valid.",
    );
  }

  const field = asString(raw.field).trim().toLowerCase();
  if (!CORRECTION_FIELDS.includes(field)) {
    throw new CorrectionError(
        "field", "invalid", "Choose which part of the profile is wrong.",
    );
  }

  // Optional; absent means a third-party correction, the original
  // behaviour.
  const kindRaw = asString(raw.kind).trim().toLowerCase();
  const kind = kindRaw === "" ? "correction" : kindRaw;
  if (!CORRECTION_KINDS.includes(kind)) {
    throw new CorrectionError("kind", "invalid", "Unknown submission type.");
  }

  const claim = collapseWhitespace(asString(raw.claim));
  if (claim.length < CLAIM_MIN_LENGTH) {
    throw new CorrectionError(
        "claim", "too_short", "Quote the part you are disputing.",
    );
  }
  if (claim.length > CLAIM_MAX_LENGTH) {
    throw new CorrectionError(
        "claim",
        "too_long",
        `Keep the disputed text under ${CLAIM_MAX_LENGTH} characters.`,
    );
  }
  assertNoInjection("claim", claim);

  const correction = collapseWhitespace(asString(raw.correction));
  if (correction.length < CORRECTION_MIN_LENGTH) {
    throw new CorrectionError(
        "correction", "too_short", "Say what it should say instead.",
    );
  }
  if (correction.length > CORRECTION_MAX_LENGTH) {
    throw new CorrectionError(
        "correction",
        "too_long",
        `Keep the correction under ${CORRECTION_MAX_LENGTH} characters.`,
    );
  }
  assertNoInjection("correction", correction);

  let evidenceUrl = null;
  const rawUrl = asString(raw.evidenceUrl).trim();
  if (rawUrl.length > 0) {
    const parsed = parseSafeUrl(rawUrl);
    if (parsed === null) {
      throw new CorrectionError(
          "evidenceUrl",
          "unsafe",
          "The evidence link must be a plain https web address.",
      );
    }
    evidenceUrl = parsed.toString();
  }

  let email = null;
  const rawEmail = asString(raw.email).trim();
  if (rawEmail.length > 0) {
    if (rawEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(rawEmail)) {
      throw new CorrectionError(
          "email", "invalid", "That email address is not valid.",
      );
    }
    email = rawEmail;
  }

  return {slug, field, kind, claim, correction, evidenceUrl, email};
}

module.exports = {
  validateCorrection,
  CorrectionError,
  CORRECTION_FIELDS,
  CORRECTION_KINDS,
  SLUG_MAX_LENGTH,
  CLAIM_MIN_LENGTH,
  CLAIM_MAX_LENGTH,
  CORRECTION_MIN_LENGTH,
  CORRECTION_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
};
