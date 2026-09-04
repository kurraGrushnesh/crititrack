import { useId } from "react";
import type { ProfessionalIdentity as Identity } from "@/lib/professional-identity";

/**
 * A compact "Professional Identity" block — primary + other professions,
 * current role(s), industry, specialisations, expertise, and a derived
 * career status, as chips. Every value is derived from the sourced
 * Wikidata claims already on the profile (`profile.professional`); a row
 * is shown only when it has data, and the whole section renders nothing
 * when nothing resolved. Chips are not links yet — there is no
 * occupation discovery page to point them at — but the markup is ready
 * to become links without restyling.
 */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="prof-row">
      <dt className="prof-row-label">{label}</dt>
      <dd className="prof-chips">{children}</dd>
    </div>
  );
}

export default function ProfessionalIdentity({
  identity,
}: {
  identity: Identity;
}) {
  const headingId = useId();
  if (identity.empty) return null;

  const {
    primary,
    secondary,
    roles,
    industries,
    specializations,
    expertise,
    careerStatus,
  } = identity;

  return (
    <section className="prof-identity" aria-labelledby={headingId}>
      <h2 id={headingId} className="prof-heading">
        Professional Identity
      </h2>

      <dl className="prof-rows">
        {primary && (
          <Row label="Primary">
            <span
              className="prof-chip is-primary"
              title={`${primary.path.sector} · ${primary.path.industry}`}
            >
              {primary.label}
            </span>
          </Row>
        )}

        {secondary.length > 0 && (
          <Row label="Also">
            {secondary.map((p) => (
              <span
                key={p.id}
                className="prof-chip"
                title={`${p.path.sector} · ${p.path.industry}`}
              >
                {p.label}
              </span>
            ))}
          </Row>
        )}

        {roles.length > 0 && (
          <Row label={roles.length > 1 ? "Current roles" : "Current role"}>
            {roles.map((r) => (
              <span key={r} className="prof-chip is-role">
                {r}
              </span>
            ))}
          </Row>
        )}

        {industries.length > 0 && (
          <Row label={industries.length > 1 ? "Industries" : "Industry"}>
            {industries.map((i) => (
              <span key={i.id} className="prof-chip is-muted" title={i.sector}>
                {i.label}
              </span>
            ))}
          </Row>
        )}

        {specializations.length > 0 && (
          <Row label="Specializations">
            {specializations.map((s) => (
              <span
                key={s.id}
                className="prof-chip is-muted"
                title={`Specialisation of ${s.occupation}`}
              >
                {s.label}
              </span>
            ))}
          </Row>
        )}

        {expertise.length > 0 && (
          <Row label="Expertise">
            {expertise.map((e) => (
              <span key={e} className="prof-chip is-muted">
                {e}
              </span>
            ))}
          </Row>
        )}

        {careerStatus && (
          <Row label="Status">
            <span className={`prof-chip is-status status-${careerStatus.toLowerCase()}`}>
              {careerStatus}
            </span>
          </Row>
        )}
      </dl>
    </section>
  );
}
