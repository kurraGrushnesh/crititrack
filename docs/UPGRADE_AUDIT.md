# CritiTrack → Entity Intelligence Platform — Audit & Plan

Response to the Master Upgrade Prompt. **Step 1 (audit) only — no rebuild
code written yet.**

---

## 1. Audit of the current app

### Stack

| Layer | What it is |
|---|---|
| **Web frontend** | Next.js 16, React 19, TypeScript, **static export** (`output: "export"` — no SSR, no API routes, no server actions). Hosted on Firebase Hosting (`crititrack-f7430.web.app`). Editorial-minimal design; CSS split across `site/app/{globals,reference,app,minimal,features}.css`. |
| **Web client data** | Firebase JS SDK, lazy-loaded: anonymous auth + App Check (reCAPTCHA Enterprise). `site/lib/*` = pure logic + API adapters (vitest, 171 tests). `site/components/*` = UI. |
| **Flutter app** | Full Dart client in `lib/` (Riverpod, go_router, typed `Result`), ~500 tests. **No longer published to web** — `firebase.json` redirects `/app/**` → `/figure/`. Kept for an eventual Android release (which has never compiled — no SDK here). |
| **Backend** | Node/Express on Render (`crititrack-api.onrender.com`, free tier). `functions/lib/*`, node:test (240 tests), ESLint. A parallel Cloud Functions entry (`functions/index.js`) exists but is **not deployed** (needs a billed Firebase plan). |
| **Database** | Firestore. |
| **CI** | GitHub Actions: `ci.yml` (Flutter format/analyze/test/coverage + functions lint/test/audit + Flutter web build), `keep-warm.yml`, `refresh.yml` + `digest.yml` (need `REFRESH_SECRET`), `firebase-hosting.yml` (needs `FIREBASE_SERVICE_ACCOUNT`). |

### Backend routes

| Route | Auth | Purpose |
|---|---|---|
| `GET /getCelebrity?name=&qid=&fresh=` | App Check + Firebase ID token + per-uid quota + global daily cap | Assemble + cache a full profile |
| `GET /trending?limit=` | none (public, cached) | Most-looked-up figures |
| `GET /health?deep=&upstream=` | none | Liveness + credential/upstream probes |
| `POST /report-correction` | none (per-IP rate limit) | Dispute a profile fact |
| `POST /refresh` | shared secret `X-Refresh-Secret` | Scheduled re-assembly + snapshot + spike alerts |
| `POST /digest` | shared secret | Weekly per-device push summary |

### Firestore schema

| Collection | Owner | Shape |
|---|---|---|
| `celebrities/{slug}` | server (Admin SDK) | flattened profile: name, biography, sentiment fields, `facts` (Wikidata: birth/death/citizenship/occupations/awards/notableWorks/education/birthPlace/**links**), `imageUrl`, `wikidataId`, `verified`, `attention`, tracking metadata |
| `celebrities/{slug}/media_items/{id}` | server | one media card (type, title, url, source, publishedAt, sentimentScore, sentimentTag, `topic`, `archiveUrl`) |
| `celebrities/{slug}/sentiment_snapshots/{date}` | server | one measured day (score, counts, `measured: true`) |
| `celebrity_payloads/{slug}` | server | lossless JSON blob of the whole assembled payload (what the web endpoint serves on a cache hit) |
| `search_history/{uid}`, `watchlists/{uid}` | user (path-keyed) | per-user |
| `corrections`, `usage`, `counters` | server, **sealed to clients** | moderation queue, rate-limit counters |
| `devices/{installId}` | user (uid-checked on both stored + incoming doc) | push registration + quiet hours |
| `digests/{date}` | server | weekly digest run audit |

Rules: default-deny, `celebrities/*` read-only to authed clients, everything else path-keyed or sealed. **Solid.**

### Integrations

Groq (LLM: biography + controversies + 3-method sentiment ensemble +
per-source sentiment), NewsAPI, YouTube Data API v3, GDELT (keyless),
Reddit public search (keyless), **Wikidata** (`wbsearchentities` +
`wbgetentities` — entity resolution, disambiguation candidates,
structured facts, external IDs), Wikipedia REST summary (portrait +
extract), Wikimedia pageviews (attention series), FCM (push), reCAPTCHA
Enterprise (App Check).

### Environment variables

Backend: `GROQ_API_KEY`, `NEWS_API_KEY`, `YOUTUBE_API_KEY`,
`FIREBASE_SERVICE_ACCOUNT`, `REFRESH_SECRET`, `APP_CHECK_ENFORCED`
(optional), `ALLOWED_ORIGIN_EXTRA` (optional), `PORT`.
Site: `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` (both
optional, hardcoded fallbacks). **No secret is ever in the client
bundle** (CI scans for it).

### Search & profile systems today

- **Search** = the nav search box → `/figure/?q=<name>` → `getCelebrity`
  → Wikidata entity resolution. Disambiguation returns alternative
  candidates the reader can pick (pinned by `qid`). There is **no
  search index, no autocomplete, no filters, no entity-type awareness**
  on the web (the Flutter app has debounced suggestions from watchlist +
  history).
- **Profile** = `assembleCelebrity` → one big payload → `RealProfile`
  mapper in `site/lib/api.ts` → components. Sections: header (portrait,
  name, stats, watch, **accounts**), bio, Controversy Index (+ per-episode
  explanation), sentiment panel (split/trend/mentions tabs, confidence
  badge), timeline, attention chart, controversy records, media feed
  (topic filter + coverage search + archive links).
- **"CritiScore" equivalent** = the **Controversy Index** — a
  deterministic 0–100 score computed in TypeScript *and* Dart from the
  typed controversy records (severity, recency decay, diminishing
  returns, unresolved weighting). Explicitly **not** a model output.

### Mock / static / duplicated code

- `site/lib/demo-data.ts` — 3 **fabricated composite** profiles, used only
  for `/profile/[slug]` demo pages and the current Compare screen.
- `site/lib/catalog.ts` — a **251-figure roster** of real people
  ("labelled mock adapter" — name, field, birth year only, no scores).
  Drives category pages, "Top 10", featured cards.
- `functions/benchmark/` — 40-item labelled seed set (its README says the
  numbers aren't publishable).
- **Deliberately duplicated** (kept in sync by tests): Controversy Index
  (TS + Dart), safe-URL policy (JS + TS + Dart), correction validation
  (JS + TS + Dart).

### Known broken / unverified

- Android release build never compiled (no SDK).
- Push has never delivered a real notification.
- `deploy-site` and `refresh` GitHub workflows **skip** — the
  `FIREBASE_SERVICE_ACCOUNT` / `REFRESH_SECRET` Actions secrets are not
  landing in the repo's Actions bucket (site deploys are manual for now).
- reCAPTCHA Enterprise blocks automated browsers, so live end-to-end
  render can only be checked in a real browser.

---

## 2. Reality check on the upgrade

**What the prompt asks for is a product rebuild, not an upgrade.** Today
the model is "one type: celebrity/person". The target is a typed entity
graph (People, Companies, Orgs, Products, Events, Teams, Movies, Books,
Artists, Locations, Projects, Institutions), a six-level profession
taxonomy with *thousands* of occupations, universal search with entity
resolution, a persistent knowledge graph, a multi-signal CritiScore, an
on-profile AI assistant, and full homepage + profile redesigns.

**The good news:** the hard, defensible parts already exist and are
reusable — Wikidata entity resolution + disambiguation, the sentiment
ensemble with a real confidence band, the corroboration/citation gates,
evidence→article linking, structured facts, the attention series, the
deterministic index, and a genuinely solid security perimeter.

**The honest constraints:**

1. **The profession taxonomy is a data-engineering job, not typing.**
   Thousands of occupations with a 6-level hierarchy, synonyms, and
   country variants must be *sourced* — realistically from Wikidata's
   occupation graph (`P106` targets, `P279` subclass-of chains),
   ESCO, or O*NET — not hand-authored. Hand-authoring is how you get the
   `catalog.ts` problem at 100× scale.
2. **The knowledge graph needs a real source per edge.** Wikidata has
   `founded by` (P112), `chief executive officer` (P169), `member of
   sports team` (P54), `director` (P57), `author` (P50), `employer`
   (P108), etc. Those are extractable and citable. Anything *not* in a
   reliable source must not be inferred (the prompt says so too).
3. **A persistent graph implies a real datastore.** Firestore can do it
   (an `entities` collection + an `edges` collection), but "people
   connected to Tesla" is a graph traversal Firestore does not do
   natively — it needs denormalised edge documents and bounded fan-out.
4. **Static export limits SEO.** Dynamic per-entity metadata + Open Graph
   + JSON-LD for *arbitrary* entities needs either SSR/ISR (drop
   `output: "export"`, run Next on a Node host) or a build-time
   generation step over a known entity set. This is a deployment-model
   decision.
5. **CritiScore must be labelled derived, never factual** (the prompt
   agrees). It becomes a documented formula over available signals
   (sentiment, media volume, pageview momentum, source confidence),
   versioned like the existing method changelog.
6. **This is months of work.** Shipped as one PR it is unreviewable and
   repeats the pattern you disliked. It has to go phase by phase with a
   typecheck/test/verify gate between each — which is what the prompt's
   own step 21 says.

---

## 3. Proposed phased plan

Mapped to the prompt's implementation order. Each phase is a reviewable
slice: build → typecheck → test → verify existing features → you review →
next.

| Phase | Deliverable | Notes |
|---|---|---|
| **0** | This audit (done) | — |
| **1 — Entity data model** | `entity.type` added to the payload + Firestore (`person` for everything today). New `EntityRef` shape (id, type, name, image, description, aliases, country, website, externalIds, sources, confidence, timestamps). `celebrities/*` → generalised read path without breaking the current one. | Refactor, not rewrite. All 411 current tests stay green. |
| **2 — Profession taxonomy** | A generated `occupations` dataset from Wikidata's `P106`/`P279` graph (sector → … → specialization), with synonyms. `person.primaryProfession` + `secondaryProfessions[]` + `industries[]` + `specializations[]` populated from the resolved entity. Replaces the flat `catalog.ts` category model. | The build step is the real work here. |
| **3 — Universal search + entity resolution** | A search endpoint over the entity store: exact/partial/alias/synonym matching, entity-type filters, "same-name" disambiguation surfaced. Natural-language queries ("Indian AI researchers") = parse → filter. Debounced autocomplete on the web. | Firestore queries + a lightweight in-memory index, or an external search service if you want fuzzy ranking. |
| **4 — Profile redesign** | The premium profile structure (header + Overview / Professional Identity / Career Timeline / Achievements / Reputation / Sentiment / News / Social / Connections / Sources / Ask CritiTrack AI) as tabs + progressive disclosure. Reuses every existing component. | Pure frontend once phases 1–2 feed it. |
| **5 — Career / news / social / video** | Career timeline from Wikidata dated claims (positions held, awards). News re-categorised (Business/Career/Achievement/Controversy/…) + event-grouping of duplicate coverage. Social = the account links (done) + legitimately-available public metrics where an API allows, honest "unavailable" otherwise. Video = the YouTube feed re-labelled (interviews/podcasts/speeches). | Mostly re-shaping data we already fetch. |
| **6 — CritiScore + trending** | A documented, versioned composite score over available signals, clearly labelled derived. Trending/momentum from news + pageview + search-count deltas with ↑/→/↓. | Extends the existing method changelog. |
| **7 — Sentiment intelligence** | Windowed views (7d/30d/90d/1y/all), distribution, "major sentiment events" tied to timeline entries with source evidence. | Extends the snapshot history + timeline. |
| **8 — Knowledge graph + compare** | `edges` collection populated from Wikidata relationship properties, each edge citing its source. A bounded "Connections" view. Compare extended to 2–5 entities with an AI-generated explanation over available data. | Graph fan-out must be bounded. |
| **9 — Ask CritiTrack AI** | A scoped assistant per profile: answers from the assembled payload only (RAG over the entity's own sourced data), states uncertainty, cites. New backend route, App-Check gated, quota'd. | Reuses the Groq integration + system/user separation. |
| **10 — Watchlist / collections / alerts** | Follow + Favorites + Collections on top of the existing watchlist; "meaningful change" alerts (reuse spike detection), no noise. | Extends `watchlists/{uid}`. |
| **11 — Perf / a11y / SEO** | Pagination, lazy-load, debounced search, image handling, code-splitting; dynamic metadata + OG + JSON-LD (**requires the export-vs-SSR decision**); a11y pass. | — |
| **12 — Testing + polish** | Full regression, UI polish. | — |

---

## 4. What I need from you before writing code

1. **Deployment model** — keep the static export (SEO handled by a
   build-time generation step over a known entity set) **or** move Next
   to a Node host for SSR/ISR (proper dynamic SEO, per-request data)?
   This decision gates phases 4, 9 and 11.
2. **Datastore for the graph** — stay all-Firestore (works, some manual
   denormalisation) or add a dedicated store?
3. **Where to start.** My recommendation: **Phase 1 (entity data model)**
   — it is the foundation everything else sits on, it is a contained
   refactor, and it keeps every current test green. I can have that as
   one reviewable PR.
4. **Scope of "thousands of occupations"** — is a Wikidata-derived
   taxonomy (a few thousand real occupations with hierarchy + synonyms)
   the target, or a hand-curated smaller set?

I will not start Phase 1 until you confirm 1–4.
