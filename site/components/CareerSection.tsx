import { useId } from "react";
import type { CareerIntelligence, CareerEntry } from "@/lib/career";

/**
 * Career & Professional Intelligence — a visual timeline of sourced
 * Wikidata posts, the organisations they touched, and a few insights
 * derived strictly from those rows (career start, current position,
 * transitions, leadership, founder history).
 *
 * Every row links back to its Wikidata source. When there are no sourced
 * career rows the section says "Career information isn't available yet."
 * rather than filling in a plausible history.
 */

function span(e: CareerEntry): string {
  if (e.start && e.end) {
    return e.start === e.end ? `${e.start}` : `${e.start} – ${e.end}`;
  }
  if (e.start) return e.current ? `${e.start} – present` : `${e.start}`;
  if (e.end) return `until ${e.end}`;
  return "date unknown";
}

function CareerRow({ e }: { e: CareerEntry }) {
  const meta = [e.industry, e.location].filter(Boolean).join(" · ");
  // A Wikidata "employer" row carries an organisation but no title; show
  // the organisation as the headline rather than an empty "Role".
  const head = e.role ?? e.organization ?? "Role";
  const sub = e.role ? e.organization : null;
  return (
    <li className={`career-row${e.current ? " is-current" : ""}`}>
      <span className="career-when">{span(e)}</span>
      <details className="career-entry">
        <summary>
          <span className="career-role">{head}</span>
          {sub && <span className="career-org">{sub}</span>}
        </summary>
        <div className="career-detail">
          {meta && <p className="career-meta">{meta}</p>}
          {e.source.url ? (
            <a
              href={e.source.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
            >
              Source: {e.source.name}
            </a>
          ) : (
            <p className="career-meta">Source: {e.source.name}</p>
          )}
        </div>
      </details>
    </li>
  );
}

export default function CareerSection({
  career,
}: {
  career: CareerIntelligence | undefined;
}) {
  const headingId = useId();

  if (!career || !career.available) {
    return (
      <section className="career-section" aria-labelledby={headingId}>
        <h2 id={headingId} className="prof-heading">
          Career
        </h2>
        <p className="career-empty">
          Career information isn&rsquo;t available yet.
        </p>
      </section>
    );
  }

  const { timeline, organizations, insights } = career;
  const cards: { label: string; value: React.ReactNode }[] = [];
  if (insights.start) cards.push({ label: "Career start", value: insights.start });
  if (insights.current)
    cards.push({ label: "Current position", value: insights.current });
  if (insights.transitions.length)
    cards.push({
      label: "Transitions",
      value: (
        <ul className="career-card-list">
          {insights.transitions.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ),
    });
  if (insights.leadershipRoles.length)
    cards.push({
      label: "Leadership roles",
      value: insights.leadershipRoles.join(", "),
    });
  if (insights.founder)
    cards.push({
      label: "Founder history",
      value: "Named as a founder in the record",
    });

  return (
    <section className="career-section" aria-labelledby={headingId}>
      <h2 id={headingId} className="prof-heading">
        Career
      </h2>

      {organizations.length > 0 && (
        <div className="career-orgs" aria-label="Major organizations">
          {organizations.map((o) => (
            <span key={o} className="career-badge">
              {o}
            </span>
          ))}
        </div>
      )}

      <ol className="career-timeline">
        {timeline.map((e, i) => (
          <CareerRow key={`${e.role}-${e.organization}-${e.start}-${i}`} e={e} />
        ))}
      </ol>

      {cards.length > 0 && (
        <div className="career-insights">
          {cards.map((c) => (
            <div key={c.label} className="career-card">
              <span className="career-card-label">{c.label}</span>
              <div className="career-card-value">{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <p className="form-note">
        Career facts are from Wikidata. Roles without a recorded date or
        title are omitted.
      </p>
    </section>
  );
}
