# CritiTrack

**An accountability tracker for public figures.** CritiTrack turns
scattered news, video and social coverage into a structured,
evidence-linked record of what someone has been criticised for, how
serious it was, and whether sentiment is moving.

![Flutter](https://img.shields.io/badge/Flutter-3.47-02569B?logo=flutter)
![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart)
![Node](https://img.shields.io/badge/Node-24-339933?logo=nodedotjs)
![Firebase](https://img.shields.io/badge/Backend-Cloud%20Functions-FFCA28?logo=firebase)
![Tests](https://img.shields.io/badge/tests-462%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/core%20coverage-84%25-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What makes it different

The easy version of this app asks a language model about a celebrity and
renders the answer. That version falls apart the moment someone asks *how
do you know that's true?* Everything below exists to answer it.

**Structure over prose.** Controversies are typed records — title,
category, severity 1–5, status, year, sources — not a paragraph.
Structure is what makes them sortable, comparable, auditable and
testable.

**Deterministic scoring.** The Controversy Index is computed in Dart from
those records, not asked from a model. The same input always produces the
same score, and unit tests pin the shape of the curve.

**Measured uncertainty.** Three independent methods score every headline:
a general-purpose lexicon, a reputation lexicon, and a batched LLM call.
How much they *disagree* becomes a confidence band. A single-method score
has nothing to disagree with, so it can only assert.

**Facts from sources, prose from models.** Birth date, death, citizenship
and occupation are read off Wikidata claims and rendered at exactly the
precision Wikidata asserts. Only the summary is generated, and the screen
says which is which.

**Corroboration before display.** A severity 4–5 claim that no retrieved
article supports is discarded, not rendered. That is a technical control
rather than a disclaimer: it prevents the harm instead of apologising for
it.

---

## Features

| | |
|---|---|
| **Search** | Debounced suggestions from your watchlist and past searches; Wikidata entity resolution, so "ntr" resolves to *N. T. Rama Rao* and every spelling shares one cache entry |
| **Disambiguation** | When a name matches several people, the app says which one it chose and offers the rest — pinned by Wikidata id, because re-searching a label is circular when two people share one |
| **Profile** | Portrait, structured facts from Wikidata, generated summary, notable works, and a verification badge when the subject is a documented public figure |
| **Controversy Tracker** | Typed episodes with a deterministic 0–100 index, orderable by severity or by date, with per-record source links |
| **Sentiment** | Three-method ensemble with a confidence band, per-item scores, per-source breakdown, spike detection and a linear forecast |
| **Evidence → article** | Tapping a cited fragment scrolls the media feed to the article it came from and highlights it |
| **Media coverage** | GDELT, NewsAPI and YouTube, deduplicated across sources so a syndicated story counts once, each item carrying its own sentiment |
| **Compare** | Overlaid trajectories on one shared date axis, co-movement ranking, a severity-weighted category radar, and a selectable date window |
| **Watchlist** | Local-first, works offline, syncs across devices under an anonymous identifier |
| **Alerts** | Server-side spike detection with per-figure settings and quiet hours enforced *before* a message is sent |
| **Accounts** | Anonymous on first launch, no signup wall ever; optional Google sign-in that links rather than replaces, so the watchlist survives |
| **Export** | Full record as JSON, or controversies and media as RFC 4180 CSV |
| **Share cards** | A 1080×1350 image carrying the numbers, the top episodes and its own provenance |
| **Themes** | Light, dark and system, meeting WCAG AA contrast in both, honouring reduced motion |

---

## Architecture

Two rules govern the design: **no secret ever reaches the client**, and
**every layer degrades instead of failing**.

```
Flutter app  ──HTTPS + ID token + App Check──▶  Cloud Functions
  no keys                                          the only place
  Riverpod · go_router · typed Result              third-party keys exist
                                                          │
                                                          ▼
                                              entity resolution
                                              source fetch + dedup
                                              three-method ensemble
                                              corroboration gate
                                              evidence → article match
                                                          │
                                                          ▼
                                        Firestore  ──▶  scheduled refresher
                                        server-owned     one dated snapshot
                                                         per refresh, then
                                                         spike detection → FCM
```

```
lib/
├── core/            theme, routing, models, errors, security, export, utils
└── features/
    ├── search/          home, history, suggestion ranking
    ├── dashboard/       profile, facts, media feed, sentiment, disambiguation
    ├── controversy/     the tracker, its index, source links
    ├── sentiment/       compare — windows, radar, co-movement
    ├── watchlist/       local-first following
    ├── alerts/          preferences, quiet hours, push registration
    ├── account/         the optional upgrade
    ├── share/           card rendering
    └── privacy/         data deletion

functions/
├── lib/             assemble · groq · entity · media · wiki · evidence
│                    sentiment/ (lexicon · domain · ensemble · reach)
│                    corroborate · validate · guard · store · alerts · push
└── benchmark/       harness, labelled set, committed results

site/                marketing site — Next 16, React 19, static export
```

---

## Quick start

**Prerequisites:** Flutter 3.47+, Node 24, and the Firebase CLI.

```bash
git clone https://github.com/kurraGrushnesh/celeb-sentiment-tracker.git
cd celeb-sentiment-tracker
flutter pub get
```

The app ships with **no secrets**. Upstream keys live only in the
backend. For local development put them in `functions/.secret.local`:

```bash
cd functions
cp .env.example .secret.local   # then fill in the three keys
npm install
```

Run the backend in one terminal:

```bash
npx firebase emulators:start --only functions
```

And the app in another — debug builds point at the local emulator
automatically, so no flags are needed:

```bash
flutter run -d chrome
```

See [docs/CONFIG.md](docs/CONFIG.md) for pointing the app at a deployed
backend, and for what push notifications need before they can arrive.

---

## Testing

```bash
flutter test                              # 299 widget and unit tests
flutter test --coverage
dart run tool/check_coverage.dart         # enforces the coverage floors

cd functions && npm test                  # 163 backend tests
```

**462 tests.** Coverage is 84.4% on core and 68.1% overall, against
floors of 75% and 65%.

CI gates formatting, `flutter analyze --fatal-infos --fatal-warnings`,
both suites, the coverage floors, `npm audit`, and a scan of the built
web bundle for anything credential-shaped.

The tests are written to fail for a reason rather than to raise a number.
A representative sample of what they pin: that a correlation is refused
below three shared days, because Pearson's *r* over two points is always
exactly ±1; that a year-precision birth date is never padded out to a
day; that an ambiguous evidence match resolves to nothing rather than to
a plausible guess; that quiet hours agree between the client and the
server, which implement the same rule twice.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/CONFIG.md](docs/CONFIG.md) | Configuration, why there is no `.env`, media sources, what push needs |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Privacy policy, written against the code |
| [docs/DATA_SAFETY.md](docs/DATA_SAFETY.md) | Play Data Safety, mapped to evidence |
| [docs/RELEASE.md](docs/RELEASE.md) | Signing, R8, deep links, release checklist |
| [functions/benchmark/README.md](functions/benchmark/README.md) | Benchmark method, and why the current numbers are not publishable |

---

## Editorial position

CritiTrack reports on **public figures** using published reporting.
Sentiment scores, controversy severities and the controversy index are
**algorithmically assessed, not verified fact**, and the app labels them
as such wherever they appear. Every record must cite a source, and a
severity 4–5 claim unsupported by retrieved coverage is discarded before
it is ever shown.

If you are the subject of a profile and believe something is inaccurate,
there is a report control on the entry.

---

## Status

### Built and verified

The backend proxy and its guard chain; entity resolution and
disambiguation; structured facts; the three-method ensemble and its
confidence band; the corroboration and citation gates; evidence-to-article
matching; Firestore persistence; the watchlist; compare; export; share
cards; alert preferences and quiet-hours arithmetic; the account upgrade;
the accessibility pass; and the marketing site, which builds and
statically exports with no vulnerable dependencies.

### Written but never run

These are stated plainly because the difference matters:

- **The Android release build has never compiled.** Signing, R8, ProGuard
  and the manifest hardening are written and have not met a compiler; no
  Android SDK is installed here. The app icon is still the Flutter
  default.
- **Push has never delivered a notification.** Every pure decision behind
  it is tested — recipient selection, quiet hours across timezones and
  midnight, payload construction, token batching, dead-token pruning — but
  the delivery path needs a deploy and a real device.
- **The pipeline has not run end to end against live APIs** from this
  machine. GDELT is unreachable from it — it times out rather than
  refusing, which looks identical to having no coverage — and the
  ensemble's LLM arm needs a key.

### Known limitations

- **The trend line is honest and therefore short.** Snapshots are
  recorded one day per refresh rather than backfilled from a generated
  series, so a newly tracked figure genuinely has no history and the app
  says so. It fills in once the scheduled refresher is deployed, which
  needs the Blaze plan.
- **The benchmark cannot yet support its own claim.** The harness works
  and its results are committed, but they come from a 40-item seed set,
  there is no single-LLM arm without a key, and the apparent gain from
  blending is two correct answers out of forty — inside the noise. Its
  README says so rather than quoting the flattering figure.
- **There is no trending list.** The search suggests from your watchlist
  and your own history. Producing a trending row honestly needs a backend
  ranking what people actually look up; a hard-coded list of famous names
  would be a claim about other users that nothing measured.
- **Overall coverage is 68.1%**, down from a peak of 77% as presentation
  code was added faster than its tests. Core logic remains at 84.4%.

---

## License

MIT
