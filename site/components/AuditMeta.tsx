import { relativeTime } from "@/lib/time";
import type { AuditMeta as AuditMetaData } from "@/lib/methodology";

/**
 * The compact "Calculated / Method / Confidence" line the spec asks for
 * under a major calculated result. Every field is real: `calculatedAt`
 * is the profile's own fetch timestamp (CritiTrack does not store a
 * separate per-calculation clock), `version` comes from the system's
 * own source-of-truth constant, and `confidence` is only shown when the
 * underlying calculation actually produced one.
 */
export default function AuditMeta({ meta }: { meta: AuditMetaData }) {
  return (
    <p className="audit-meta">
      <span>Calculated {relativeTime(meta.calculatedAt)}</span>
      <span className="audit-sep">·</span>
      <span>
        Method: {meta.label} v{meta.version}
      </span>
      {meta.confidence != null && (
        <>
          <span className="audit-sep">·</span>
          <span>Confidence: {meta.confidence}</span>
        </>
      )}
    </p>
  );
}
