"use client";

import { useState } from "react";
import {
  CORRECTION_FIELDS,
  CorrectionError,
  validateCorrection,
  type CleanCorrection,
} from "@/lib/correction";
import { DEMO_PROFILES } from "@/lib/demo-data";

/**
 * The report-a-correction form.
 *
 * It runs the shared `validateCorrection` before it does anything else,
 * so the same rules the backend enforces are enforced here first and the
 * user sees inline errors. On a valid submission it POSTs to
 * `NEXT_PUBLIC_API_BASE/report-correction` when that is configured; when
 * it is not (the static demo), it says so plainly rather than pretending
 * the report was filed.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

const FIELD_LABELS: Record<string, string> = {
  biography: "Biography text",
  controversy: "A controversy record",
  sentiment: "The sentiment score or trend",
  image: "The photo",
  other: "Something else",
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "filed"; clean: CleanCorrection }
  | { kind: "no-endpoint"; clean: CleanCorrection }
  | { kind: "network-error"; message: string };

export default function CorrectionForm({
  defaultSlug = "",
}: {
  defaultSlug?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      slug: String(form.get("slug") ?? ""),
      field: String(form.get("field") ?? ""),
      claim: String(form.get("claim") ?? ""),
      correction: String(form.get("correction") ?? ""),
      evidenceUrl: String(form.get("evidenceUrl") ?? ""),
      email: String(form.get("email") ?? ""),
    };

    let clean: CleanCorrection;
    try {
      clean = validateCorrection(input);
      setErrors({});
    } catch (err) {
      if (err instanceof CorrectionError) {
        setErrors({ [err.field]: err.message });
        return;
      }
      throw err;
    }

    if (!API_BASE) {
      setStatus({ kind: "no-endpoint", clean });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(`${API_BASE}/report-correction`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(clean),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          field?: string;
          message?: string;
        };
        if (body.field && body.message) {
          setErrors({ [body.field]: body.message });
          setStatus({ kind: "idle" });
          return;
        }
        setStatus({
          kind: "network-error",
          message: `The server rejected the report (HTTP ${res.status}).`,
        });
        return;
      }
      setStatus({ kind: "filed", clean });
    } catch {
      setStatus({
        kind: "network-error",
        message: "Could not reach the server. Please try again later.",
      });
    }
  }

  if (status.kind === "filed") {
    return (
      <div className="form-ok">
        <p>
          <strong>Report filed.</strong> Thank you. Corrections are reviewed
          against published reporting; we do not change a record without a
          source that supports the change.
        </p>
      </div>
    );
  }

  if (status.kind === "no-endpoint") {
    return (
      <div className="form-ok">
        <p>
          <strong>Your report passed validation, but this is the static
          demo site and no correction endpoint is configured here.</strong>{" "}
          Nothing was submitted. In the app, or on a deployment with{" "}
          <code>NEXT_PUBLIC_API_BASE</code> set, this same form posts to{" "}
          <code>POST /report-correction</code>.
        </p>
        <p className="form-note">
          What you entered: a correction to the{" "}
          <em>{FIELD_LABELS[status.clean.field]}</em> on{" "}
          <em>{status.clean.slug}</em>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className={`field${errors.slug ? " field-invalid" : ""}`}>
        <label htmlFor="cf-slug">Profile</label>
        <select id="cf-slug" name="slug" defaultValue={defaultSlug}>
          <option value="">Select a profile</option>
          {DEMO_PROFILES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.slug})
            </option>
          ))}
        </select>
        {errors.slug && <span className="err">{errors.slug}</span>}
      </div>

      <div className={`field${errors.field ? " field-invalid" : ""}`}>
        <label htmlFor="cf-field">Which part is wrong?</label>
        <select id="cf-field" name="field" defaultValue="">
          <option value="">Select</option>
          {CORRECTION_FIELDS.map((f) => (
            <option key={f} value={f}>
              {FIELD_LABELS[f]}
            </option>
          ))}
        </select>
        {errors.field && <span className="err">{errors.field}</span>}
      </div>

      <div className={`field${errors.claim ? " field-invalid" : ""}`}>
        <label htmlFor="cf-claim">What does it currently say?</label>
        <span className="hint">
          Quote or paraphrase the part you are disputing.
        </span>
        <textarea id="cf-claim" name="claim" maxLength={800} />
        {errors.claim && <span className="err">{errors.claim}</span>}
      </div>

      <div className={`field${errors.correction ? " field-invalid" : ""}`}>
        <label htmlFor="cf-correction">What should it say instead?</label>
        <textarea id="cf-correction" name="correction" maxLength={1200} />
        {errors.correction && (
          <span className="err">{errors.correction}</span>
        )}
      </div>

      <div className={`field${errors.evidenceUrl ? " field-invalid" : ""}`}>
        <label htmlFor="cf-url">Evidence link (optional)</label>
        <span className="hint">
          A plain https web address to reporting that supports the change.
        </span>
        <input
          id="cf-url"
          name="evidenceUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
        />
        {errors.evidenceUrl && (
          <span className="err">{errors.evidenceUrl}</span>
        )}
      </div>

      <div className={`field${errors.email ? " field-invalid" : ""}`}>
        <label htmlFor="cf-email">Your email (optional)</label>
        <span className="hint">
          Only if you want a reply. Not stored with the public record.
        </span>
        <input id="cf-email" name="email" type="email" autoComplete="email" />
        {errors.email && <span className="err">{errors.email}</span>}
      </div>

      {status.kind === "network-error" && (
        <p className="err" role="alert">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={status.kind === "submitting"}
      >
        {status.kind === "submitting" ? "Submitting" : "Submit report"}
      </button>
    </form>
  );
}
