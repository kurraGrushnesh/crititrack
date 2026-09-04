"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { search, type SearchFilters } from "@/lib/search";
import { DECADES } from "@/lib/catalog";
import SearchBox from "./SearchBox";

/**
 * The universal search results page. Reads the query and any filter
 * params from the URL, runs the bundled search, and renders grouped
 * results — People, Professions, Industries & Categories — plus a filter
 * bar. Companies / organisations / sports teams show an honest empty
 * state; CritiTrack has no data for them yet.
 */

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
      [...new Set(result.people.map((p) => p.country).filter(Boolean))].sort() as string[],
    [result.people],
  );

  const hasAnything =
    result.people.length > 0 ||
    result.professions.length > 0 ||
    result.categories.length > 0;

  return (
    <main id="main" className="page search-page">
      <div className="page-head">
        <h1>Discover</h1>
        <p>
          Search people, professions, industries and categories. Type a
          name to open a live profile.
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

      {/* Active filters */}
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
        <section className="search-group">
          <h2>People ({result.people.length})</h2>
          <div className="search-people">
            {result.people.map((p) => (
              <a
                key={p.slug}
                className="search-person"
                href={`/figure/?q=${encodeURIComponent(p.name)}`}
              >
                <span className="sp-name">{p.name}</span>
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
        </section>
      )}

      {result.professions.length > 0 && (
        <section className="search-group">
          <h2>Professions</h2>
          <div className="search-tax">
            {result.professions.map((t) => (
              <a
                key={t.kind + t.id}
                className="search-tax-chip"
                href={`/search/?occupation=${t.kind === "occupation" ? t.id : ""}`}
              >
                {t.label}
                {t.path && <span className="stc-path">{t.path}</span>}
                {t.count > 0 && <span className="stc-count">{t.count}</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      {result.categories.length > 0 && (
        <section className="search-group">
          <h2>Industries &amp; categories</h2>
          <div className="search-tax">
            {result.categories.map((t) => (
              <a
                key={t.kind + t.id}
                className="search-tax-chip"
                href={
                  t.kind === "industry"
                    ? `/search/?industry=${t.id}`
                    : t.kind === "sector"
                      ? `/search/?sector=${t.id}`
                      : `/search/?category=${t.id}`
                }
              >
                {t.label}
                {t.path && <span className="stc-path">{t.path}</span>}
                {t.count > 0 && <span className="stc-count">{t.count}</span>}
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="search-group">
        <h2>Companies &amp; organisations</h2>
        <p className="no-records">
          Not available yet — CritiTrack has no company, organisation or
          sports-team records. Only people and the profession taxonomy are
          searchable.
        </p>
      </section>
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
