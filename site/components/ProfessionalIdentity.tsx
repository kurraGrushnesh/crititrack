import type { ProfessionalIdentity as Identity } from "@/lib/professional-identity";

/**
 * A compact "Professional Identity" block — primary + secondary
 * professions, current role(s), industries and specialisations, as
 * chips. Reads only `profile.professional`, which is derived from the
 * sourced Wikidata occupation claims. Renders nothing when there is
 * nothing resolved.
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
      <span className="prof-row-label">{label}</span>
      <div className="prof-chips">{children}</div>
    </div>
  );
}

export default function ProfessionalIdentity({
  identity,
}: {
  identity: Identity;
}) {
  if (identity.empty) return null;

  const { primary, secondary, roles, industries, specializations } = identity;

  return (
    <section className="prof-identity" aria-label="Professional identity">
      <h2 className="prof-heading">Professional Identity</h2>

      {(primary || secondary.length > 0) && (
        <Row label="Profession">
          {primary && (
            <span
              className="prof-chip is-primary"
              title={`${primary.path.sector} · ${primary.path.industry}`}
            >
              {primary.label}
            </span>
          )}
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
        <Row label={roles.length > 1 ? "Roles" : "Role"}>
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
    </section>
  );
}
