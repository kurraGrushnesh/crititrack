/**
 * Validation for the "report a correction" form.
 *
 * A profile subject (or anyone) can dispute something on a profile. The
 * form posts to `POST /report-correction` on the backend, which stores
 * the report for review. The field rules below are the contract between
 * three places that must agree:
 *
 *   - this file, used by the web form before it submits,
 *   - `functions/lib/correction.js`, used by the endpoint,
 *   - `lib/core/security/correction.dart`, used by the Flutter form.
 *
 * A change to a bound or an allowed value here needs the identical change
 * in the other two, plus a matching test case in each suite. The web and
 * the endpoint share the stricter job: the endpoint cannot trust the
 * client ran this, so it runs the same checks again.
 */

import { parseSafeUrl } from "./safe-url";

export const CORRECTION_FIELDS = [
  "biography",
  "controversy",
  "sentiment",
  "image",
  "other",
] as const;

export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

/**
 * What the submission is: a third-party "correction" (the default), or a
 * "response" from the profile's subject giving their side of a rendered
 * claim. Both are stored the same way; a moderator may attach a response
 * so it shows inline on the profile.
 */
export const CORRECTION_KINDS = ["correction", "response"] as const;
export type CorrectionKind = (typeof CORRECTION_KINDS)[number];

export const SLUG_MAX_LENGTH = 90;
export const CLAIM_MIN_LENGTH = 10;
export const CLAIM_MAX_LENGTH = 600;
export const CORRECTION_MIN_LENGTH = 10;
export const CORRECTION_MAX_LENGTH = 1000;
export const EMAIL_MAX_LENGTH = 254;

/** Matches the slugs produced by the backend's `toSlug`, including the
 * `n-<hex>` fallback for names written entirely in a non-Latin script. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A deliberately loose email check: one `@`, a dot in the domain, no
 * spaces. The endpoint does not send mail, so this only rejects
 * obviously-broken input. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Free-text that reads as an instruction to a model, not as a report. */
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

export interface CorrectionInput {
  slug?: unknown;
  field?: unknown;
  kind?: unknown;
  claim?: unknown;
  correction?: unknown;
  evidenceUrl?: unknown;
  email?: unknown;
}

export interface CleanCorrection {
  slug: string;
  field: CorrectionField;
  kind: CorrectionKind;
  claim: string;
  correction: string;
  evidenceUrl: string | null;
  email: string | null;
}

export class CorrectionError extends Error {
  code: string;
  field: string;
  status: number;
  constructor(field: string, code: string, message: string) {
    super(message);
    this.name = "CorrectionError";
    this.field = field;
    this.code = code;
    this.status = 400;
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function assertNoInjection(field: string, text: string): void {
  const lowered = text.toLowerCase();
  if (INJECTION_MARKERS.some((m) => lowered.includes(m))) {
    throw new CorrectionError(
      field,
      "looks_like_instruction",
      "That reads as an instruction rather than a description. Please rephrase.",
    );
  }
}

/**
 * Validates and normalises a correction report. Throws
 * {@link CorrectionError} on the first problem, so a caller can surface
 * `err.field` and `err.message` inline.
 */
export function validateCorrection(input: CorrectionInput): CleanCorrection {
  const slug = asString(input.slug).trim().toLowerCase();
  if (slug.length === 0) {
    throw new CorrectionError("slug", "missing", "No profile was named.");
  }
  if (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
    throw new CorrectionError("slug", "invalid", "That profile id is not valid.");
  }

  const fieldValue = asString(input.field).trim().toLowerCase();
  if (!CORRECTION_FIELDS.includes(fieldValue as CorrectionField)) {
    throw new CorrectionError(
      "field",
      "invalid",
      "Choose which part of the profile is wrong.",
    );
  }
  const field = fieldValue as CorrectionField;

  const kindValue = asString(input.kind).trim().toLowerCase() || "correction";
  if (!CORRECTION_KINDS.includes(kindValue as CorrectionKind)) {
    throw new CorrectionError("kind", "invalid", "Unknown submission type.");
  }
  const kind = kindValue as CorrectionKind;

  const claim = collapseWhitespace(asString(input.claim));
  if (claim.length < CLAIM_MIN_LENGTH) {
    throw new CorrectionError(
      "claim",
      "too_short",
      "Quote the part you are disputing, in a sentence or two.",
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

  const correction = collapseWhitespace(asString(input.correction));
  if (correction.length < CORRECTION_MIN_LENGTH) {
    throw new CorrectionError(
      "correction",
      "too_short",
      "Say what it should say instead.",
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

  let evidenceUrl: string | null = null;
  const rawUrl = asString(input.evidenceUrl).trim();
  if (rawUrl.length > 0) {
    const parsed = parseSafeUrl(rawUrl);
    if (parsed == null) {
      throw new CorrectionError(
        "evidenceUrl",
        "unsafe",
        "The evidence link must be a plain https web address.",
      );
    }
    evidenceUrl = parsed.toString();
  }

  let email: string | null = null;
  const rawEmail = asString(input.email).trim();
  if (rawEmail.length > 0) {
    if (rawEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(rawEmail)) {
      throw new CorrectionError("email", "invalid", "That email address is not valid.");
    }
    email = rawEmail;
  }

  return { slug, field, kind, claim, correction, evidenceUrl, email };
}
