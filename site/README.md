# CritiTrack site

The marketing and reference site. Next.js 16, statically exported
(`output: "export"`), no server. Hosted at the root of the Firebase
Hosting site; the Flutter web app is mounted under `/app/` by
`tool/assemble_hosting.js`.

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
  explore/                    grid of illustrative profiles
  profile/[slug]/             one profile: index gauge, trend, records
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
| `NEXT_PUBLIC_API_BASE` | the correction form | When set, `POST {base}/report-correction` is called on submit. When unset (the static demo), the form validates the input and then says plainly that nothing was submitted. |

## Deploy

See the "Web hosting" section of `docs/RELEASE.md`. In short:

```bash
flutter build web --release --base-href /app/ \
  --dart-define=DEMO_MODE=true --no-web-resources-cdn
(cd site && npm run build)
node tool/assemble_hosting.js          # -> dist/
npx firebase deploy --only hosting
```

`--no-web-resources-cdn` keeps CanvasKit local so the `Content-Security-
Policy` in `firebase.json` does not block it. See `docs/RELEASE.md`.
