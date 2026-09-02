# CritiTrack site

The product. Next.js 16, statically exported (`output: "export"`), no
server. It is the whole Firebase Hosting deploy.

Most routes are static reference pages. `/figure/?q=<name>` is the live
one: it initialises Firebase in the browser (anonymous auth + App Check
via reCAPTCHA Enterprise, lazy-loaded) and calls the real `getCelebrity`
backend, then renders the sourced profile — bio, Controversy Index,
sentiment breakdown, evidence, coverage. The Flutter web build is no
longer published; `/app/**` redirects here.

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # static export to ./out
npm run lint       # eslint (flat config)
npm run typecheck  # tsc --noEmit
npm test           # vitest run -- the lib/ layer
```

`npm run build` needs network access the first time so `next/font`
can fetch and self-host the Newsreader family. After that the font
files are cached under `.next/`. A build that fails only on
`fonts.googleapis.com` is a blocked network, not a code fault.

## Layout

```
app/
  page.tsx                    landing page (hero + globe)
  figure/                     LIVE profile — ?q=<name>, calls the backend
  explore/                    grid of illustrative profiles
  profile/[slug]/             illustrative composite: index gauge, trend, records
  profile/[slug]/evidence/    the fragments and sources behind the numbers
  compare/                    two profiles, same scales
  methodology/                resolve / gather / score / gate / record
  controversy-index/          the deterministic formula, worked example
  about/                      what it is, who it covers, what it does not claim
  report-correction/          the correction form
  watchlist/                  device-local, localStorage only
  privacy/                    the policy
  globals.css + reference.css single dark theme, violet accent, 14px radius
components/                   shared server + client components
lib/                          the tested logic layer (see below)
```

## The `lib/` layer

Deterministic logic, unit-tested with Vitest. Three modules are
duplicated by necessity and must stay in agreement with their twins:

| Web | Flutter | Node backend |
|---|---|---|
| `lib/controversy-index.ts` | `lib/core/utils/controversy_index.dart` | (n/a) |
| `lib/safe-url.ts` | `lib/core/security/safe_url.dart` | `functions/lib/safeUrl.js` |
| `lib/correction.ts` | `lib/core/security/correction.dart` | `functions/lib/correction.js` (authoritative) |

A change to a formula, a bound, or an allowed value in one copy needs
the same change in the others, plus a matching test case in each suite.

`lib/demo-data.ts` is fabricated composite profiles. A static export
has no backend, so it cannot show a live profile; every profile page
says so.

## Environment

| Variable | Used by | Effect |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | `lib/api.ts`, correction form | Backend origin. Defaults to `https://crititrack-api.onrender.com`. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | `lib/firebase.ts` | App Check reCAPTCHA Enterprise site key. Has a baked-in default (it ships in every client anyway). |

## Deploy

See the "Web hosting" section of `docs/RELEASE.md`. In short:

```bash
(cd site && npm run build)
node tool/assemble_hosting.js          # site/out -> dist/
npx firebase deploy --only hosting
```
