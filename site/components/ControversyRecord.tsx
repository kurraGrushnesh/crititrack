import type { Controversy } from "@/lib/controversy";
import SourceLink from "./SourceLink";

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
export default function ControversyRecord({ item }: { item: Controversy }) {
  return (
    <article className="record">
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
    </article>
  );
}
