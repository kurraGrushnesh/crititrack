# CritiTrack roadmap — UI/UX rebuild

The direction changed: **the website (`site/`) becomes the product.** The
Flutter app's search-style screen stops being the "preview." The
marketing page does the real thing — search a public figure, see the
same result the analysis produces, compare two figures side by side —
and it must feel like the product, not a demo of it.

One coherent slice per working day. Design it, build it, test it, deploy
it, then stop for review. No chained changes, no parallel reskins.

Quality bar, in order: **premium > consistent > responsive > fast >
flashy.** No excessive gradients, no glassmorphism-everywhere, no
decoration that costs usability or frames.

---

## Where things stand

- `site/` (Next.js static export, live at `crititrack-f7430.web.app`):
  light editorial look, floating pill nav with search, six categories,
  three fabricated demo profiles, method/about/privacy pages.
- **`/figure/?q=<name>` is the product now.** It initialises Firebase in
  the browser (anonymous auth + App Check via reCAPTCHA Enterprise) and
  calls the real `getCelebrity` backend — `site/lib/{firebase,api,
  use-celebrity}.ts` + `site/app/figure/page.tsx`. Every search entry
  point (pill nav, person cards, category rails) routes here.
- The Flutter web build is no longer published. `firebase.json`
  redirects `/app/**` → `/figure/`. The Flutter source and its 346 tests
  stay in the repo for the eventual Android release.
- Backend: Node/Express on Render (free tier). Endpoints: `getCelebrity`,
  `report-correction`, `trending` (public), `refresh` and `digest`
  (shared-secret, driven by the `refresh.yml` / `digest.yml` Actions
  workflows). reCAPTCHA / App Check configured. CI on `main` is green.
- **Unverified:** nobody has confirmed a real search on the deployed
  site renders a real profile end to end (the sandbox can't reach
  `onrender.com`).
- **Open branches** (not merged): `feature/editorial-profile-sections`
  (Flutter dashboard sections go flat), `feature/hero-variants` (four
  swappable hero backgrounds behind `?hero=`).
- `feature/roadmap-batch` (the 20-feature batch in Phase 6) is **merged**.

---

## Phase 0 — Ground truth (2 days)

| Day | Feature | Done when |
|---|---|---|
| 0.1 | You open the live app and run 8 real searches (musician, politician, athlete, business leader, creator, someone obscure, a misspelling, a non-Latin name). Screenshot each. | A written punch list of what is broken, slow, or wrong. |
| 0.2 | Fix the punch list. | Every search from 0.1 renders a complete profile. |

---

## Phase 1 — The design system (3 days)

Everything else depends on one set of tokens.

| Day | Feature | Done when |
|---|---|---|
| 1.1 | **Design tokens.** One file: colours, fonts, font sizes (fluid scale), spacing scale, radius scale, shadow scale, breakpoints, animation timings. Existing brand colours kept. Both `site/` and the Flutter app read from it (Dart mirror). | `site/lib/tokens.ts` + `lib/core/theme/tokens.dart`, every hardcoded value in the codebase replaced. |
| 1.2 | **Style-direction options, one at a time.** Each option is a *complete* coherent system — colour + type pairing + button/card style + radius + shadow + background treatment + hierarchy — applied to the home + one profile so you can judge it whole. Not random variants. | You pick one direction. |
| 1.3 | **Lock the system.** Apply the chosen direction across every page and the app; delete the losing token sets and any duplicated styles. | `grep` finds no raw hex / px outside the token file. |

---

## Phase 2 — Web calls the backend ✓ (built, not yet verified live)

| Day | Feature | Status |
|---|---|---|
| 2.1 | Firebase JS SDK + anonymous auth + App Check in `site/`, lazy-loaded. | Done — `site/lib/firebase.ts`. |
| 2.2 | `useCelebrity(name)` hook: request de-dup, short client cache, typed loading / not-found / error states, abort on change. Route-driven, so no keystroke debounce. | Done — `site/lib/use-celebrity.ts`, `site/app/figure/page.tsx`. Needs a real end-to-end check (Phase 0.1). |

---

## Phase 3 — The product UI, one feature per day

Done so far:

| # | Feature | Status |
|---|---|---|
| 3.1 | Real profile rendered on `/figure` — bio, index, sentiment, evidence, confidence. | Done. |
| 3.2 | ~~Classification section from Wikidata~~ | **Removed** at the user's call — Wikidata entity resolution matched the wrong person for ambiguous names (a niche "Tony Stark"), and the user chose to drop the section rather than add an entity picker. `lib/classification.*` and `entity.facts` mapping deleted. |
| 3.3 | Sentiment composition donut (positive / neutral / negative). | Done — `SentimentDonut`. |
| 3.4 | Public-attention chart — Wikipedia pageview area chart + stat row. | Done — `AttentionChart`. Uses Wikipedia *pageviews* (engagement), not Wikidata facts — kept. |
| 3.5 | **Dark theme + Light/Dark/System toggle**. | Done — `lib/theme.ts`, `ThemeToggle`. |
| 3.6 | **Sentiment section, carded + tabbed** — stat cards, source-breakdown cards, Split / Trend / Daily-mentions tabs, collapsible evidence, generated-analysis callout. | Done — `SentimentPanel`. |

| 3.7 | **Media as cards** — news + YouTube as 16:9 thumbnail-led cards, per-item sentiment score, All / News / Videos tabs. | Done — `MediaCoverage` / `MediaCard`. |
| 3.8 | **Bio inline** — summary + background paragraphs + notable-work tags, no "Read more". | Done — `BioSection`. |
| 3.9 | **Stat tile** — one `Stat` / `StatRow` for every KPI number. | Done — `Stat`. |
| 3.10 | **Loading / not-found / error** — shape-matched skeleton, designed empty/error states, image fallbacks. | Done — `FigureStates`, `Skeleton`. |
| 3.11 | **Button primitive + severity tokens** — one `Button`, `.tag-sev-*` off raw hex. | Done — `Button`. |

Also shipped from feedback: watchlist keeps real figures; a 6h backend
payload cache (`~20s → ~2s` on a repeat); a confidence explainer line.

A later 20-feature batch built on top of this phase — timeline, index
explanation, coverage search + topic filter, saved comparisons,
watchlist tags, confidence badges, offline cache, deep links, a locale
switcher and more. See **Phase 6**.

---

## Phase 4 — Motion

| Day | Feature | Status |
|---|---|---|
| 4.0 | Hero load-in entrance (anime.js, staggered, reduced-motion safe). | Done — `HeroReveal`. |
| 4.0 | Section reveals on `/figure` (IntersectionObserver, `translate3d`, one-shot). | Done — `Reveal`. |
| 4.1 | **Cursor-follow glow** in the hero: lerped toward the pointer, `translate3d` on a `pointer-events: none` layer, rAF loop that self-terminates, pauses on tab-hidden, skipped under `prefers-reduced-motion` and on coarse pointers. | Done — `CursorGlow`. |
| 4.2 | **Hero background** — kept the ShaderGradient, gated it to `min-width: 768px` and not reduced-motion. Phones and reduced-motion get a static CSS wash in the same cream → orange composition; the WebGL canvas never mounts there. | Done — `HeroGradient`. |

---

## Phase 5 — Ship-ready (4 days)

| Day | Feature | Done when |
|---|---|---|
| 5.1 | Full responsive + interaction audit: 375 / 768 / 1024 / 1440 / large. Overflow, text wrapping, comparison on small screens, animation smoothness, re-render counts, network waterfall. | The pre-ship checklist in this file passes. |
| 5.2 | Android release build on a machine with the SDK; exercise it on a real device. | Signed App Bundle runs. |
| 5.3 | Real icon + splash; backend off the cold path (or a proper "waking" state). | First search never looks broken. |
| 5.4 | Custom domain, SEO, Lighthouse 90+, axe with no criticals. | Submittable. |

**Progress:** 5.3 — a real vector adaptive launcher icon shipped in Phase
6 (`android/.../mipmap-anydpi-v26/ic_launcher.xml`); the release build
itself (5.2) still needs an SDK. The `keep-warm.yml` + `refresh.yml`
workflows keep the Render service warm, which softens but does not remove
the cold-start problem in 5.3.

---

## Phase 6 — Roadmap feature batch (shipped 2026-09-04)

Twenty features in one batch on `feature/roadmap-batch`, merged to `main`
(commits `b364bb1..7d96d1f`, merge `f124914`, format-reconcile `f8da7ad`).
Departs from "one slice per day" at the user's explicit direction. Every
item has backend/pure-logic + tests; the UI column notes how far the
visible surface got.

### Data & backend

| # | Feature | Where | UI |
|---|---|---|---|
| 1 | Scheduled refresh — records one measured snapshot per figure twice daily, turning the trend line into real history | `.github/workflows/refresh.yml` | n/a (needs a `REFRESH_SECRET` repo secret) |
| 2 | Trending rail — `GET /trending` ranks the most-looked-up figures by the `requestCount` the scheduler maintains; empty until searches accumulate, never a hard-coded list | `functions/lib/{store,handlers}.js`, `site/lib/trending.ts` | `TrendingRail` on the home page |
| 3 | Reddit discussion source — keyless public search JSON, deduped into the media list | `functions/lib/media.js` | surfaces in the existing feed |
| 4 | Reliability-weighted aggregation — tabloids (Mail, Sun, TMZ…) and Reddit threads weighted below wire services | `functions/lib/sentiment/reach.js` | — |
| 5 | Weekly digest — one collapsed FCM summary per device of how its followed figures moved; skips quiet weeks | `functions/lib/digest.js`, `.github/workflows/digest.yml` | n/a |
| 6 | Figure timeline — controversies + attention spikes + sentiment shifts on one dated axis; attention stays unsigned | `functions/lib/timeline.js`, `site/lib/timeline.ts` | `FigureTimeline` — new "Timeline" section on the profile |
| 9 | Topical media classification — legal / financial / political / personal / professional / other, per headline | `functions/lib/media.js`, `site/lib/api.ts` | topic chips in `MediaCoverage` |
| 14 | Subject response on the correction form — optional `kind: response` across the three validator twins | `functions/lib/correction.js`, `site/lib/correction.ts`, `lib/core/security/correction.dart` | "who are you?" choice on `CorrectionForm` |
| 16 | Wayback archive link for every cited source (no outbound request) | `functions/lib/archive.js` | "· archived" link on each media card |

### Site — pure logic + UI

| # | Feature | Where | UI |
|---|---|---|---|
| 7 | Explain the Controversy Index — per-episode severity × recency × unresolved breakdown that sums to the score | `site/lib/controversy-index.ts` | `IndexExplanation` — collapsible under the gauge |
| 8 | Saved comparisons — named, reusable figure sets; the pair now lives in `?figures=a,b` so a comparison is a shareable link | `site/lib/comparisons.ts`, `components/comparisons-store.ts` | `SavedComparisons` on the compare page (operates on the demo composites, since compare is still demo-only) |
| 10 | Keyword search within a figure's coverage — accent/case-insensitive AND-term filter, no request | `site/lib/coverage-search.ts` | search box in `MediaCoverage` |
| 11 | Watchlist tags (folders) — migration-safe `tags[]` on each entry | `site/lib/watchlist.ts` | filter bar + inline tag/untag in `WatchlistView` |
| 12 | i18n scaffold — `en` / `hi` catalogue for the shell only; analytical copy stays English by design | `site/lib/i18n.ts`, `components/locale-store.ts` | `LocaleSwitcher` in `PillNav`; `<html lang>` synced |
| 13 | Public method changelog + version stamp for dating share cards | `site/lib/methodology-version.ts` | changelog list on the Method page |
| 15 | Unified confidence badges — one high/moderate/low vocabulary for sentiment confidence, fact precision, corroboration | `site/lib/confidence.ts` | `ConfidenceBadge` on the sentiment section |
| 18 | Offline / last-visit profile cache — localStorage LRU of the last 12 payloads | `site/lib/profile-cache.ts`, `use-celebrity.ts` | "cached copy" notice when the backend is unreachable |
| 19 | Shareable deep links — `#<section>`, `#controversy-<anchor>`, `#event-<date>` | `site/lib/deep-link.ts` | section + record ids and scroll-on-load in `figure/page.tsx` |
| 20 | Accessibility pass 2 — SVG `<title>`/`<desc>` and visually-hidden data tables for the charts | `components/{VisuallyHidden,SentimentTrend,AttentionChart}.tsx` | — |

### Platform

| # | Feature | Where | Status |
|---|---|---|---|
| 17 | Real adaptive launcher icon (replaces the Flutter default) | `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` + `drawable/ic_launcher_foreground.xml` | Resource XML only — **the release build still has not compiled** (no Android SDK in the build environment). Legacy mipmap PNG remains the pre-API-26 fallback. |

### Known gaps in this batch

- Deep-link *builders* exist (`deep-link.ts`) but there is no copy-link
  button on each section yet — only landing on a link works.
- Saved comparisons and the compare screen still use the demo composites;
  the store carries over unchanged to a real-figure compare screen.
- Tests: backend 238, site 168, all green; Dart `flutter analyze` clean.
  The `f8da7ad` commit ran `dart format .` repo-wide to clear a
  long-standing CI format-gate failure (12 files, formatting only).

---

## Phase 10 — Catalogue Category Expansion + Smart Sorting (STEP 9)

Grow the 6-category catalogue into a 35-category global discovery
system, then layer sorting, filters and a time range on top. **No new
API** — everything is built from the existing roster, the profession
taxonomy, and the one real per-figure signal the backend already tracks
(`GET /trending`'s `requestCount`, sourced from Firestore `usage`).

**The hard constraint that shapes every later day:** the roster is a
static, editorial list — it carries no per-person score, sentiment or
mention count, because computing one means calling the paid per-figure
pipeline (Groq + News + YouTube) for all ~250 people, which nothing in
this app does today. So:
- **Trending / Rising / Most Discussed / Recently Updated** can only be
  computed for the (small, changing) set of figures someone has actually
  looked up — exactly what `/trending` already measures. A catalogue
  sorted this way is mostly "not enough data yet" until usage accumulates.
- **Highest CritiScore / Most Positive / Most Negative** need a live
  profile per person; sorting the *whole* catalogue by them without a new
  bulk endpoint would mean fetching ~250 profiles client-side (slow,
  costly, and out of scope for "use existing APIs only").
- **A–Z, Most Popular (prominence), and category/country/decade filters**
  need nothing new — they work today.

Given "never fabricate metrics" and "show a clear limited-data state
instead of inventing trends," the plan below ships the honest version:
sorts that need live data operate over whatever subset already has it
(cached Firestore profiles) and say so, rather than silently only
"working" for a lucky few or being faked for the rest. A bulk ranking
endpoint is a possible future phase, not assumed here.

### Data layer

| Day | Feature | Done when |
|---|---|---|
| 10.1 ✓ | **35-category taxonomy layer** (`site/lib/categories.ts`). Categories are matched from the existing roster descriptor via `resolveCatalogueOccupation`, layered occupation → industry → sector; a person can land in several categories, never duplicated (one `RosterEntry`, many tags). The 6 legacy slugs alias onto their replacements so existing `/category/*` links keep resolving. Nothing invented: a profession absent from today's roster is an honest zero-count category. | 14 new tests; every roster entry classified into ≥1 category; `tsc`/`build` clean; **not yet wired into any page**. |
| 10.2 | **Roster expansion.** Add real people (verifiable public figures, neutral descriptors, no scores) for the categories 10.1 left at zero — AI/ML, healthcare, academia, law, journalism, finance, engineering, etc. — so the new categories are not empty shelves. | Every category has ≥5 people; `catalogue.test.ts` extended. |
| 10.3 | **Category counts + metadata surface.** Export `categoryCounts` results and blurbs in the shape the Explore UI and Flutter both consume. | One typed module both platforms read; no duplication of the count logic. |

### Web — discovery UI

| Day | Feature | Done when |
|---|---|---|
| 10.4 | **Explore Categories page.** Replaces `/explore`'s current alias-to-home. Featured category cards, full grid, category search (client-side over the 35 labels/blurbs), people-count per card, responsive. Editorial-minimal, matches existing card/chip styling. | `/explore` is a real page; old `/category/:slug` links still work via the alias map. |
| 10.5 | **Rich category-page cards.** Portrait, name, primary profession, country, and — only when a cached Firestore profile exists for that person — CritiScore/sentiment/trend chip; otherwise the card says "Open profile for live analysis" instead of a blank or fake number. | No card ever shows an invented score. |
| 10.6 | **Smart sorting.** Trending / Most Popular / Most Discussed / Rising / Highest CritiScore / Most Positive / Most Negative / Recently Updated / A–Z, default Trending. Sorts backed by real data operate over the subset that has it and label the rest "not ranked — no data yet"; A–Z and prominence work over the full list. | Switching sort never triggers a new profile fetch; empty/limited states designed. |
| 10.7 | **Filters + time range.** Country, profession, sector, industry, specialization, entity type, sentiment, career status (from `professional-identity.ts`), time period — combinable, e.g. Technology → India → Entrepreneurs → Trending → 30 Days. 24h/7d/30d/90d/All time only affects the data-backed sorts; filters otherwise apply instantly. | Filter combination reflected in the URL; back/forward preserves it. |

### Flutter — native discovery

| Day | Feature | Done when |
|---|---|---|
| 10.8 | **Category browsing.** Horizontal category chips, responsive grid/list, category search, touch-friendly cards; no horizontal overflow at 320–430 dp. | Parity with 10.4/10.5; `flutter analyze` clean. |
| 10.9 | **Sorting + filter bottom sheets + time-range selector.** Native bottom sheets (not new pages) for sort and filters; time-range chips; pull-to-refresh; selected filters and scroll position preserved on navigation back. | Parity with 10.6/10.7; back navigation and scroll restore verified. |

### Cross-cutting

| Day | Feature | Done when |
|---|---|---|
| 10.10 | **Consistency + guardrails.** Web and Flutter share the same 35 categories, the same classification, and the same sort/filter *logic* (UI may differ). Controversy Index is never read by the ranking code — verified by a test that asserts the sorter module has no import from `controversy-index.ts`. | Shared category/sort logic covered by one shared spec (ported to Dart tests); no controversy coupling. |

---

## Pre-ship checklist (run before calling any phase done)

- [ ] Breakpoints 375 / 768 / 1024 / 1440 tested
- [ ] Compare with two figures tested, adapts on mobile
- [ ] Loading / error / empty states present on every async surface
- [ ] No horizontal overflow; long names and long source titles wrap
- [ ] Animations hold 60fps on a mid phone; all respect reduced-motion
- [ ] No unnecessary re-renders (React DevTools profiler) or duplicate network calls
- [ ] No raw hex or px outside the token file
- [ ] Marketing page and app share colours, type, components, spacing

## Standing rules

1. Take the next unchecked item from this file.
2. Branch, build, `analyze`/`test` or `build`/`lint`/`typecheck`/`test`, deploy.
3. Hand over the live URL and stop. Wait for "next".
4. Keep the three duplicated modules in sync (Controversy Index,
   safe-URL policy, correction validation) across Dart, Node, TypeScript.
5. Never show an unsourced severity 4-5 claim. Never let an LLM set the
   Controversy Index. Never commit a credential. Don't change the data
   logic for a UI change.
