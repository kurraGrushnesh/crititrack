import type { RealProfile } from "@/lib/api";
import {
  buildClassification,
  FACET_GROUPS,
  type Facet,
} from "@/lib/classification";

/**
 * The Categories / Classification panel. Renders whatever facets
 * {@link buildClassification} produced from real source data, grouped by
 * area. An absent facet is simply not shown — no "Unknown", no filler.
 */
function FacetBlock({ facet }: { facet: Facet }) {
  return (
    <div className="facet">
      <h3 className="facet-label">{facet.label}</h3>

      {facet.kind === "tags" && (
        <ul className="facet-tags">
          {facet.items.map((it) => (
            <li key={it.label} className="tag">
              {it.label}
            </li>
          ))}
        </ul>
      )}

      {facet.kind === "text" && (
        <ul className="facet-text">
          {facet.items.map((it) => (
            <li key={it.label}>{it.label}</li>
          ))}
        </ul>
      )}

      {facet.kind === "links" && (
        <ul className="facet-links">
          {facet.items.map((it) => (
            <li key={it.label}>
              <a
                href={it.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="source-link"
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      )}

      {facet.kind === "timeline" && (
        <ul className="facet-timeline">
          {facet.items.map((it, i) => (
            <li key={`${it.label}-${i}`}>
              {it.meta && <span className="facet-year">{it.meta}</span>}
              <span>{it.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ClassificationPanel({
  profile,
}: {
  profile: RealProfile;
}) {
  const facets = buildClassification(profile);
  if (facets.length === 0) return null;

  const groups = FACET_GROUPS.map((g) => ({
    group: g,
    facets: facets.filter((f) => f.group === g),
  })).filter((g) => g.facets.length > 0);

  return (
    <div className="classification">
      {groups.map(({ group, facets: gf }) => (
        <section key={group} className="classification-group">
          <h2 className="classification-group-label">{group}</h2>
          <div className="facet-grid">
            {gf.map((f) => (
              <FacetBlock key={f.key} facet={f} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
