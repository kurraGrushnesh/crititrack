import type { Controversy } from "@/lib/controversy";
import type { Claim } from "@/lib/claims";
import { titleSlug } from "@/lib/claims";
import { controversyAnchor } from "@/lib/deep-link";
import SourceLink from "./SourceLink";
import ClaimsMatrix from "./ClaimsMatrix";
import SaveToResearchButton from "./SaveToResearchButton";

const STATUS_LABEL: Record<Controversy["status"], string> = {
  ongoing: "Ongoing",
  resolved: "Resolved",
  historical: "Historical",
};

/**
 * One typed controversy record: title, category, severity, status, year,
 * neutral summary, and the sources backing it. A severity 4 or 5 record
 * with no source never reaches this component -- the corroboration gate
 * in `lib/controversy.ts` drops it first.
 */
export default function ControversyRecord({
  item,
  claims,
  entityId,
}: {
  item: Controversy;
  claims?: Claim[];
  entityId?: string | null;
}) {
  return (
    <article className="record" id={controversyAnchor(item.title)}>
      <div className="record-top">
        <h3>{item.title}</h3>
        <span className={`tag tag-sev tag-sev-${item.severity}`}>
          Severity {item.severity}
        </span>
        <span className={`tag tag-status-${item.status}`}>
          {STATUS_LABEL[item.status]}
        </span>
        <span className="tag">{item.category}</span>
        {item.year != null && <span className="tag">{item.year}</span>}
      </div>
      <p>{item.summary}</p>
      <div className="record-sources">
        <span className="rs-label">Sources:</span>
        {item.sources.length === 0 ? (
          <span className="source-plain">none recorded</span>
        ) : (
          item.sources.map((s, i) => (
            <span key={`${s}-${i}`}>
              <SourceLink source={s} />
              {i < item.sources.length - 1 ? "," : ""}
            </span>
          ))
        )}
      </div>
      <p className="record-evidence-link">
        <a href="#evidence-explorer">View evidence →</a>
      </p>
      <SaveToResearchButton
        item={{
          type: "CONTROVERSY",
          entityId: entityId ?? null,
          title: item.title,
          summary: item.summary,
          referenceId: titleSlug(item.title),
          metadata: {
            severity: item.severity,
            status: item.status,
            year: item.year ?? null,
            category: item.category,
          },
        }}
      />
      {claims && <ClaimsMatrix controversyTitle={item.title} claims={claims} entityId={entityId} />}
    </article>
  );
}
