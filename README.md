# CritiTrack

**An accountability tracker for public figures.** CritiTrack turns
scattered news, video and social coverage into a structured, evidence-linked
record of what someone has been criticised for, how serious it was, and
whether public sentiment is moving.

![Flutter](https://img.shields.io/badge/Flutter-3.41-02569B?logo=flutter)
![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart)
![Firebase](https://img.shields.io/badge/Backend-Cloud%20Functions-FFCA28?logo=firebase)
![Tests](https://img.shields.io/badge/tests-271%20passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-green)

---

## What makes it different

The easy version of this app asks a language model about a celebrity and
renders the answer. That version falls apart the moment someone asks *how
do you know that's true?* CritiTrack is built around answering it.

**Structure over prose.** Controversies are typed records — title,
category, severity 1–5, status, year, sources — not a paragraph. Structure
is what makes them sortable, comparable, auditable and testable.

**Deterministic scoring.** The Controversy Index is computed in Dart from
those records, not asked from a model. The same input always produces the
same score, and unit tests pin the curve.

**Measured uncertainty.** Two independent methods score every headline: a
lexicon and a batched LLM call. How much they *disagree* becomes a
confidence band. A single-method score has nothing to disagree with, so it
can only assert.

**Corroboration before display.** A severity 4–5 claim that no retrieved
article supports is dropped, not rendered. That is a technical control, not
a disclaimer — it prevents the harm rather than apologising for it.

---

## Features

| | |
|---|---|
| **Search** | Debounced input, recent history, and Wikidata entity resolution — "ntr" resolves to *N. T. Rama Rao*, and every spelling of a name shares one cache entry |
| **Profile** | Portrait, profession, background, notable works, and a verification badge when the subject is a documented public figure |
| **Controversy Tracker** | Typed episodes with a deterministic 0–100 index, severity-sorted timeline, and category breakdown |
| **Sentiment** | Ensemble score with a confidence band, per-source breakdown, spike detection and a linear forecast |
| **Media coverage** | GDELT, NewsAPI and YouTube, deduplicated across sources so a syndicated story counts once |
| **Compare** | Overlaid trajectories, date-aligned Pearson correlation, and side-by-side controversy indexes |
| **Watchlist** | Local-first, works offline, syncs across devices under an anonymous identifier |
| **Export** | Full record as JSON, or controversies and media as RFC 4180 CSV |
| **Share cards** | A 1080×1350 image carrying the numbers, the top episodes and its own provenance |
| **Themes** | Light, dark and system, meeting WCAG AA contrast in both |

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
                                              ensemble scoring
                                              corroboration gate
                                                          │
                                                          ▼
                                        Firestore  ──▶  scheduled refresher
                                        server-owned     writes dated snapshots
```

```
lib/
├── core/            theme, routing, models, errors, security, export, utils
└── features/
    ├── search/          home screen and history
    ├── dashboard/       profile, media feed, sentiment
    ├── controversy/     the tracker and its index
    ├── sentiment/       compare
    ├── watchlist/       local-first following
    ├── share/           card rendering
    └── privacy/         data deletion

functions/
├── lib/             assemble · groq · entity · media · wiki
│                    sentiment/ (lexicon · ensemble · reach)
│                    corroborate · validate · guard · store · alerts
└── benchmark/       harness, labelled set, committed results
```

---

## Quick start

**Prerequisites:** Flutter 3.41+, Node 22+, and the Firebase CLI.

```bash
git clone https://github.com/kurraGrushnesh/crititrack.git
cd crititrack
flutter pub get
```

The app ships with **no secrets**. Upstream keys live only in the backend.
For local development put them in `functions/.secret.local`:

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
backend instead.

---

## Testing

```bash
flutter test                              # 184 widget and unit tests
flutter test --coverage
dart run tool/check_coverage.dart         # enforces the coverage floors

cd functions && npm test                  # 87 backend tests
```

CI gates formatting, `flutter analyze --fatal-infos --fatal-warnings`,
both test suites, the coverage floors, `npm audit`, and a scan of the
built web bundle for anything credential-shaped.

---

## Documentation

| Document | Contents |
|---|---|
| [docs/CONFIG.md](docs/CONFIG.md) | Configuration and why there is no `.env` |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Privacy policy, written against the code |
| [docs/DATA_SAFETY.md](docs/DATA_SAFETY.md) | Play Data Safety, mapped to evidence |
| [docs/RELEASE.md](docs/RELEASE.md) | Signing, R8, deep links, release checklist |
| [functions/benchmark/README.md](functions/benchmark/README.md) | Benchmark method, and why the current numbers are not publishable |

---

## Editorial position

CritiTrack reports on **public figures** using published reporting.
Sentiment scores, controversy severities and the controversy index are
**algorithmically assessed, not verified fact**, and the app labels them as
such wherever they appear. Every serious claim must cite a source, and a
severity 4–5 claim unsupported by retrieved coverage is discarded before it
is ever shown.

If you are the subject of a profile and believe something is inaccurate,
there is a report control on the entry.

---

## Status

Built and verified: the backend proxy, entity resolution, the ensemble and
corroboration gate, persistence, the watchlist, export, share cards, the
accessibility pass, and the release build configuration.

Known limitations, stated rather than implied:

- The **trend line** reads stored snapshots, but those only accumulate once
  the scheduled refresher is deployed. Until then a new figure has little
  history.
- The **benchmark** harness works and its results are committed, but the
  numbers come from a 40-item seed set and are **not publishable**. See its
  README for what a defensible run requires.
- **Alerts** detect spikes server-side; delivery needs push registration.
- The **release build** configuration is written but has not been built,
  and the app icon is still the Flutter default.

---

## License

MIT
