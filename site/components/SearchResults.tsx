"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  search,
  type SearchFilters,
  type PersonHit,
  type TaxonomyHit,
} from "@/lib/search";
import { DECADES } from "@/lib/catalog";
import SearchBox from "./SearchBox";

/**
 * The universal search results page. Reads the query and any filter
 * params from the URL, runs the bundled search, and renders results
 * grouped and ordered by relevance tier (strongest first).
 *
 * Groups appear in a fixed order — People, Companies, Organizations,
 * Professions, Industries & Categories, Other — and empty groups are
 * hidden. CritiTrack has no company/organisation/team data, so those
 * groups never appear; a single footer line says so honestly.
 */

const PER_GROUP = 6;

function readFilters(params: URLSearchParams): SearchFilters {
  const decade = Number(params.get("decade"));
  return {
    occupationId: params.get("occupation") ?? undefined,
    industryId: params.get("industry") ?? undefined,
    sectorId: params.get("sector") ?? undefined,
    country: params.get("country") ?? undefined,
    category: params.get("category") ?? undefined,
    bornDecade: Number.isFinite(decade) && decade ? decade : undefined,
  };
}

/** Wraps the matched slice of `text` in <mark>. Case-insensitive. */
function Highlight({ text, query }: { text: string; query: string }): ReactNode {
  const q = query.trim();
  if (q.length < 2) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

const TAX_KIND_LABEL: Record<TaxonomyHit["kind"], string> = {
  occupation: "Profession",
  specialization: "Specialisation",
  industry: "Industry",
  sector: "Sector",
  category: "Category",
};

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="search-group">
      <h2>
        {title} <span className="sg-count">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function ExpandableList({
  total,
  children,
}: {
  total: number;
  children: (limit: number) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const limit = open ? total : PER_GROUP;
  return (
    <>
      {children(limit)}
      {total > PER_GROUP && !open && (
        <button
          type="button"
          className="search-viewall"
          onClick={() => setOpen(true)}
        >
          View all {total} results →
        </button>
      )}
    </>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const paramString = params.toString();

  const result = useMemo(
    () => search(q, readFilters(new URLSearchParams(paramString))),
    [q, paramString],
  );

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/search/?${next.toString()}`, { scroll: false });
  }

  const countries = useMemo(
    () =>
      [...new Set(result.people.map((p) => p.country).filter(Boolean))]
        .sort() as string[],
    [result.people],
  );

  const taxHref = (t: TaxonomyHit) =>
    t.kind === "occupation"
      ? `/search/?occupation=${t.id}`
      : t.kind === "industry"
        ? `/search/?industry=${t.id}`
        : t.kind === "sector"
          ? `/search/?sector=${t.id}`
          : t.kind === "category"
            ? `/search/?category=${t.id}`
            : `/search/?q=${encodeURIComponent(t.label)}`;

  const hasAnything =
    result.people.length > 0 ||
    result.professions.length > 0 ||
    result.categories.length > 0;

  return (
    <main id="main" className="page search-page">
      <div className="page-head">
        <h1>Discover</h1>
        <p>
          Search people, professions, industries and categories. Results are
          ordered by how closely they match — strongest first.
        </p>
      </div>

      <div className="search-page-box">
        <SearchBox />
      </div>

      {result.interpretation.length > 0 && (
        <p className="search-interpretation">
          Reading “{q}” as — {result.interpretation.join("; ")}.
        </p>
      )}

      <div className="search-filters">
        {result.filters.country && (
          <button className="filter-chip" onClick={() => setParam("country", null)}>
            {result.filters.country} ✕
          </button>
        )}
        {result.filters.occupationId && (
          <button
            className="filter-chip"
            onClick={() => setParam("occupation", null)}
          >
            profession filter ✕
          </button>
        )}
        {result.filters.industryId && (
          <button className="filter-chip" onClick={() => setParam("industry", null)}>
            industry filter ✕
          </button>
        )}
        {result.filters.sectorId && (
          <button className="filter-chip" onClick={() => setParam("sector", null)}>
            sector filter ✕
          </button>
        )}
        {result.filters.category && (
          <button className="filter-chip" onClick={() => setParam("category", null)}>
            {result.filters.category} ✕
          </button>
        )}
        {result.filters.bornDecade != null && (
          <button className="filter-chip" onClick={() => setParam("decade", null)}>
            born {result.filters.bornDecade}s ✕
          </button>
        )}

        {countries.length > 1 && !result.filters.country && (
          <select
            className="filter-select"
            defaultValue=""
            onChange={(e) => setParam("country", e.target.value || null)}
            aria-label="Filter by country"
          >
            <option value="">Country…</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {result.people.length > 1 && result.filters.bornDecade == null && (
          <select
            className="filter-select"
            defaultValue=""
            onChange={(e) => setParam("decade", e.target.value || null)}
            aria-label="Filter by decade of birth"
          >
            <option value="">Decade born…</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        )}
      </div>

      {!hasAnything && (
        <p className="no-records">
          Nothing in the catalogue or taxonomy matches that. Try a name, a
          profession (“cardiologist”), or a phrase like “Indian entrepreneurs”.
        </p>
      )}

      {result.people.length > 0 && (
        <Group title="People" count={result.people.length}>
          <ExpandableList total={result.people.length}>
            {(limit) => (
              <div className="search-people">
                {result.people.slice(0, limit).map((p: PersonHit) => (
                  <a
                    key={p.slug}
                    className="search-person"
                    href={`/figure/?q=${encodeURIComponent(p.name)}`}
                  >
                    <span className="sp-type">Person</span>
                    <span className="sp-name">
                      <Highlight text={p.name} query={q} />
                    </span>
                    <span className="sp-role">
                      {p.profession?.label ?? p.descriptor}
                    </span>
                    <span className="sp-meta">
                      {[p.profession?.industry, p.country]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </a>
                ))}
              </div>
            )}
          </ExpandableList>
        </Group>
      )}

      {result.professions.length > 0 && (
        <Group title="Professions" count={result.professions.length}>
          <ExpandableList total={result.professions.length}>
            {(limit) => (
              <div className="search-tax">
                {result.professions.slice(0, limit).map((t) => (
                  <a
                    key={t.kind + t.id}
                    className="search-tax-chip"
                    href={taxHref(t)}
                  >
                    <span className="stc-type">{TAX_KIND_LABEL[t.kind]}</span>
                    <span className="stc-label">
                      <Highlight text={t.label} query={q} />
                    </span>
                    {t.path && <span className="stc-path">{t.path}</span>}
                    {t.count > 0 && <span className="stc-count">{t.count}</span>}
                  </a>
                ))}
              </div>
            )}
          </ExpandableList>
        </Group>
      )}

      {result.categories.length > 0 && (
        <Group title="Industries &amp; categories" count={result.categories.length}>
          <ExpandableList total={result.categories.length}>
            {(limit) => (
              <div className="search-tax">
                {result.categories.slice(0, limit).map((t) => (
                  <a
                    key={t.kind + t.id}
                    className="search-tax-chip"
                    href={taxHref(t)}
                  >
                    <span className="stc-type">{TAX_KIND_LABEL[t.kind]}</span>
                    <span className="stc-label">
                      <Highlight text={t.label} query={q} />
                    </span>
                    {t.path && <span className="stc-path">{t.path}</span>}
                    {t.count > 0 && <span className="stc-count">{t.count}</span>}
                  </a>
                ))}
              </div>
            )}
          </ExpandableList>
        </Group>
      )}

      <p className="search-note">
        CritiTrack has no company, organisation or sports-team records yet —
        only people and the profession taxonomy are searchable.
      </p>
    </main>
  );
}

export default function SearchResults() {
  return (
    <Suspense fallback={<main id="main" className="page" />}>
      <Inner />
    </Suspense>
  );
}
