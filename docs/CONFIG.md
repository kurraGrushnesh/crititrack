# Configuration

CritiTrack ships **no secrets in the app**. There is no `.env` file and no
bundled credential of any kind — every third-party call is made by the
Cloud Functions backend, which reads its keys from Google Secret Manager.

## The app

The only client-side configuration is which backend origin to talk to.
It is a compile-time constant, not an asset, so it cannot be read out of a
shipped build.

Run against the deployed backend (the default — no flag needed):

```bash
flutter run -d chrome
```

Run against a local Functions emulator:

```bash
flutter run -d chrome --dart-define=API_BASE_URL=http://127.0.0.1:5001/crititrack-f7430/us-central1
```

## The backend

Production keys live in Secret Manager:

```bash
firebase functions:secrets:set GROQ_API_KEY
firebase functions:secrets:set NEWS_API_KEY
firebase functions:secrets:set YOUTUBE_API_KEY
```

For the emulator, put the same keys in `functions/.secret.local`
(gitignored, one `KEY=value` per line). Copy `functions/.env.example` as a
starting point.

## Why not `.env`

A file listed under `flutter: assets:` is packaged verbatim into the APK
and the web bundle. Anyone who downloads the app can read it. Build-time
`--dart-define` values are compiled into the binary and are appropriate
for non-secret configuration such as a public backend URL — which is all
the client needs.
