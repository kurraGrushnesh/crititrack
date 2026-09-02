# CritiTrack roadmap

One vertical slice per working day: design it, build it, test it, deploy
it, then stop and review it live before starting the next. No chaining
two big changes into one session.

A "feature" here means something you can open in the deployed app and
judge — not a refactor, not a colour change.

---

## Where things stand today

**Deployed**

- Web (`site/`): Next.js static export at `crititrack-f7430.web.app`.
  Light editorial look, floating nav with search, six categories with a
  curated Top 10 (mock adapter), three fabricated demo profiles, method
  / about / privacy pages. 6 Vitest suites.
- Mobile (Flutter) under `/app/`: sage theme, light by default, editorial
  dashboard header, bottom nav (Search / Browse / Compare), category
  browse. Talks to the real backend. 38 test files.
- Backend: Node/Express on Render free tier — `getCelebrity`,
  `POST /report-correction` (open, per-IP rate limited), scheduled
  refresh. reCAPTCHA Enterprise + App Check wired.
- Firestore rules deployed. Keep-warm GitHub Action every ~5 min.

**Not proven**

- **No human has confirmed the real app works end to end.** Every build
  assumes search → real figure → profile renders with real sourced data,
  but the test browser blocks the Render backend, so it has only ever
  been checked by `curl` against the API, never through the client.
- The web can't call the backend itself — category and person links hand
  off to `/app/?q=`. So "explore on the web" is really "explore, then
  bounce to the app".
- Dashboard sections below the header (bio, controversy, sentiment,
  media) still use the old card styling, not the editorial one.
- Android release build has never run (no Android SDK on the build
  machine). Benchmark figures are from a 40-item seed and are not
  publishable.

---

## Phase 0 — Ground truth (3 days, do this first)

Nothing new until we know the current thing works.

| Day | Feature | Done when |
|---|---|---|
| 0.1 | **Real-search walkthrough.** You open the live app and run 8 searches: a musician, a politician, an athlete, a business leader, a creator, someone obscure, a misspelled name, a non-Latin name. Screenshot each. | There is a written punch list of everything broken, slow, or wrong. |
| 0.2 | **Fix the punch list.** Whatever 0.1 surfaced — most likely an App Check domain mismatch, the cold-start error being too blunt, or one section throwing. | Every search from 0.1 now renders a complete profile. |
| 0.3 | **Lock it with a test.** One integration test that runs the real assembler against a recorded backend response and asserts a full `Celebrity` parses with sources, confidence, and per-source scores intact. | `flutter test` covers the happy path end to end; it would fail if a field silently dropped. |

---

## Phase 1 — Decide what the product is (2 days)

Right now it is half website, half app, and the seam shows.

| Day | Feature | Done when |
|---|---|---|
| 1.1 | **Pick the primary client.** Web-primary: add the Firebase JS SDK + anonymous auth + App Check to `site/` so a category card opens a real profile *on the web*. App-primary: strip `site/` back to marketing + SEO and move explore/category/profile entirely into Flutter. Write the decision and the reason in this file. | The decision is recorded and the losing half has a one-paragraph scope. |
| 1.2 | **Build the handoff or the integration.** If web-primary: a `/figure/[slug]` route that fetches and renders a real profile client-side. If app-primary: deep links from every marketing CTA into the right app screen. | Clicking a real name anywhere lands on that figure's real, sourced profile with no dead end. |

---

## Phase 2 — Evidence & trust (5 days, the actual differentiator)

The pitch is "evidence over generated claims." These features are the
product, not polish.

| Day | Feature | Done when |
|---|---|---|
| 2.1 | **Corroboration-gate audit.** Run 20 real figures through the pipeline, list every severity 4-5 claim and its sources, confirm each is real and on-topic. Tune `corroborate.js` thresholds if claims slip through or good ones are dropped. | A short report: N claims checked, M dropped correctly, 0 unsupported claims shown. |
| 2.2 | **Source link health.** A checker (script + CI job) that resolves every source URL the app would render. Broken links render as plain text with the publication name, never as a dead anchor. | No 404 source link reaches a screen. |
| 2.3 | **Confidence, front and centre.** The confidence band appears on every score with a one-line plain-language explanation ("three methods, they mostly agreed"). Low confidence visibly changes the presentation. | You can tell at a glance how much to trust each number. |
| 2.4 | **Honest empty states.** "No recent coverage found." "This name did not resolve to a documented person." "Not enough history for a trend yet." Each is a designed state, not a blank card. | Every section has a real empty state; none just disappears. |
| 2.5 | **Benchmark expansion.** Grow `functions/benchmark/labelled.json` from 40 to 150+ items across all six categories, re-run, record accuracy / macro-F1 / latency / cost. Decide in writing whether the figures are publishable. | `functions/benchmark/README.md` states the new numbers and the publish/no-publish call. |

---

## Phase 3 — Core UX, one feature per day (7 days)

From the original brief. Each depends on Phase 1 being done.

| Day | Feature | Done when |
|---|---|---|
| 3.1 | **Home with live featured figures.** The featured grid shows real current index + sentiment, not the mock catalogue. | Six real figures on the home page with real numbers, cached sensibly. |
| 3.2 | **Category Top 10 with real scores.** A batch endpoint (or a bounded client fan-out) so the Top 10 shows real index scores and can be sorted by them, clearly labelled as a live ranking. | Opening a category shows ten real figures ranked by a real number. |
| 3.3 | **Profile: sourced timeline.** The controversies rendered as a real vertical timeline — year on the spine, severity as weight, status as state, sources inline. | The timeline reads chronologically and every entry links its sources. |
| 3.4 | **Profile: restyle the remaining sections** (bio, controversy list, sentiment, media) to the editorial look so the page is consistent below the header. | The whole profile is one visual language, top to bottom. |
| 3.5 | **Compare two real figures.** Side by side, same scales, difference highlighted. | You can compare any two catalogue figures and see who scores higher on what, with the inputs shown. |
| 3.6 | **Watchlist that means something.** Synced across devices when signed in, and it surfaces when a watched figure's score moved. | Adding to the watchlist and reopening the app later shows what changed. |
| 3.7 | **Related figures from real data.** "Same field" pulled from Wikidata occupation, not the mock roster, each a live profile link. | Related figures are real and open real profiles. |

---

## Phase 4 — Motion & depth (3 days, deliberately near the end)

Only once the content is right. Perf budget: no regression in Lighthouse
mobile, everything collapses under `prefers-reduced-motion`.

| Day | Feature | Done when |
|---|---|---|
| 4.1 | **Page transitions.** A shared-element move from a person card to their profile header (name and portrait animate into place). Everywhere else, a plain fade. | Navigating into a profile feels continuous; nothing janks on a mid-range phone. |
| 4.2 | **Scroll-reveal on profile sections** and a subtle parallax on the header portrait. | Sections arrive as you scroll; reduced-motion shows them all at once. |
| 4.3 | **One 3D moment.** Either the index gauge as a rotating ring or a small globe on the home page. Measured: it must not cost more than 8 ms/frame on a Pixel-class device or it does not ship. | The 3D element is on one screen, is measured, and has a static fallback. |

---

## Phase 5 — Ship-ready (5 days)

| Day | Feature | Done when |
|---|---|---|
| 5.1 | **Android release build.** On a machine with the Android SDK: `flutter build appbundle --release --obfuscate`. Fix whatever R8 breaks. Install the release build on a real device and exercise Firebase, sign-in, App Check, the WebView, the share sheet. | A signed App Bundle runs correctly on a physical device. |
| 5.2 | **Icon and splash.** A real 1024x1024 source; generate every density with `flutter_launcher_icons` and `flutter_native_splash`. | The default Flutter icon is gone everywhere. |
| 5.3 | **Backend off the cold path.** Either move the Node service to a tier that does not sleep, or keep the free tier and make the "waking up" state a proper 20-second progress experience instead of a network error. | The first search of a session never looks broken. |
| 5.4 | **Custom domain + SEO pass.** Register a domain, point Hosting at it, fix the canonical URLs, submit the sitemap. Run Lighthouse and the accessibility audit; fix anything below AA. | The site scores 90+ on Lighthouse mobile and passes axe with no criticals. |
| 5.5 | **Store listing + Data Safety.** Screenshots, description, content rating, the Data Safety form filled from `docs/DATA_SAFETY.md`, privacy policy hosted with a real contact address. Internal -> closed -> production with a staged rollout. | The listing is submittable. |

---

## Ground rules for every day

1. Start from this file; take the next unchecked item.
2. Branch, build, test (`flutter analyze` + `flutter test`, or
   `npm run build`/`lint`/`typecheck`/`test`), deploy.
3. Hand over the live URL and stop. Wait for "next".
4. Keep the three duplicated modules in sync (Controversy Index,
   safe-URL policy, correction validation) across Dart, Node, and
   TypeScript — a formula or bound change needs the same change plus a
   test in all three.
5. Never show an unsourced severity 4-5 claim. Never let an LLM set the
   Controversy Index. Never commit a credential.
