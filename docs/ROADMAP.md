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
- Backend: Node/Express on Render (free tier), `getCelebrity` +
  `report-correction`. reCAPTCHA / App Check configured.
- **Unverified:** nobody has confirmed a real search on the deployed
  site renders a real profile end to end (the sandbox can't reach
  `onrender.com`).
- **Open branches** (not merged): `feature/editorial-profile-sections`
  (Flutter dashboard sections go flat), `feature/hero-variants` (four
  swappable hero backgrounds behind `?hero=`).

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

## Phase 3 — The product UI, one feature per day (7 days)

| Day | Feature | Done when |
|---|---|---|
| 3.1 | **Search** component + results: the real profile rendered on the site (bio, index, sentiment, sourced timeline, evidence links, confidence). Mobile-first. | Search → full real profile on any screen size. |
| 3.2 | **Compare** — two figures side by side, same scales, differences marked. Stacks (or swipes) on mobile. | Compare works and adapts cleanly at 375px. |
| 3.3 | **Celebrity card** + **Comparison card** as reusable components; used on home, category, compare. | One card component, three placements. |
| 3.4 | **Stats / info sections** component — the index gauge, the score breakdown, the confidence meter, all one system. | Consistent everywhere a score appears. |
| 3.5 | **Navigation** unified — the pill nav responsive down to mobile (no hidden links), same on every page. | Nav is one component, works at every breakpoint. |
| 3.6 | **Loading / skeleton, empty, error** states — designed, matching the final skeleton shape, for every async surface. | No blank flashes, no raw spinners, no disappearing sections. |
| 3.7 | **Badges / inputs / buttons** — the last primitives into the system; audit and remove any style that isn't from a token. | The component library is complete. |

---

## Phase 4 — Motion (2 days)

| Day | Feature | Done when |
|---|---|---|
| 4.1 | **Cursor-tracking object** around the "add person" / search area: lerped, `transform: translate3d`, driven by `requestAnimationFrame`, no reflow, pauses when the tab is hidden and under `prefers-reduced-motion`. Subtle. | It follows the cursor smoothly at 60fps and adds nothing to layout cost. |
| 4.2 | **Hero background** — pick one of the four in `feature/hero-variants` (`?hero=a/b/c/d`), or none. Whatever's chosen must not drop frames on a mid phone. | One hero treatment, measured, with a static fallback. |

---

## Phase 5 — Ship-ready (4 days)

| Day | Feature | Done when |
|---|---|---|
| 5.1 | Full responsive + interaction audit: 375 / 768 / 1024 / 1440 / large. Overflow, text wrapping, comparison on small screens, animation smoothness, re-render counts, network waterfall. | The pre-ship checklist in this file passes. |
| 5.2 | Android release build on a machine with the SDK; exercise it on a real device. | Signed App Bundle runs. |
| 5.3 | Real icon + splash; backend off the cold path (or a proper "waking" state). | First search never looks broken. |
| 5.4 | Custom domain, SEO, Lighthouse 90+, axe with no criticals. | Submittable. |

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
