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

## Push notifications (F07)

Spike alerts are delivered with Firebase Cloud Messaging. Nothing here is
a secret, but three things must exist before a notification can arrive,
and each fails silently rather than loudly.

**`google-services.json`.** Gitignored, per the note above. Without it the
Android build has no FCM sender id and `getToken()` returns null, so the
device is never registered. The app still runs; alerts simply never
appear.

**The `devices` security rule.** Deployed with
`firebase deploy --only firestore:rules`. A device row is keyed by a
random per-install id rather than by uid, because one account can have
several devices whose quiet hours differ. Update requires the uid to
match on both the stored row and the incoming one — checking only the
incoming one would let anyone who guessed an install id take over that
row and silently stop the real owner's alerts.

**The scheduler.** `refreshTrackedCelebrities` is what detects a spike in
the first place, and scheduled functions require the Blaze plan. On Spark
the alert path is never entered at all.

### What is enforced where

Which figures produce alerts, and when the user may not be disturbed, are
enforced on the **server**, in `selectRecipients`. This is why the app
addresses devices individually instead of subscribing them to an FCM topic
per figure: a topic subscriber is anonymous, so the backend could not know
whether it was the middle of the night for them. Quiet hours would then
only be able to suppress a notification after the phone had already made a
noise, which is not a quiet-hours feature.

The client holds a copy of the same predicate so the settings screen can
say "quiet until 07:00" without a round trip. The two are pinned against
identical cases in `functions/test/push.test.js` and
`test/alert_preferences_test.dart` — if you change one, change both.

### Not verified

The delivery path has never run. It needs a deploy on Blaze and a real
device, neither of which exists in this checkout. What *is* verified is
every pure decision behind it: recipient selection, quiet-hours arithmetic
across timezones and midnight, payload construction, token batching, dead-
token pruning, and the parse that turns a tapped notification into a
route. The plumbing between them — permission, token retrieval, channel
creation — is written and analysed but unproven.

## Media sources (F05)

Three are wired, in this order of preference:

**GDELT** is queried first and needs no key or quota, so its results are
put ahead of NewsAPI's in the deduper — where the two overlap, GDELT's
copy is kept and the NewsAPI quota goes further. Its timestamps are
`20260828T164028Z`, which `Date.parse` cannot read, so `parseGdeltDate`
handles them; that is covered by fixture tests rather than by a live call,
because GDELT is not reachable from every network. It was unreachable from
the machine this was written on, verified again at the time of writing:
the endpoint times out rather than refusing, which looks identical to
having no coverage.

**NewsAPI** free tier is developer-only and delayed 24 hours, so it is a
supplement rather than the spine.

**YouTube** supplies video coverage and is reach-weighted by view count.

### Deliberately not used

**Reddit.** The unauthenticated JSON endpoints return `403` — confirmed
again while writing this, with a descriptive user agent. Using it properly
means OAuth, and Reddit's terms restrict what may then be done with the
data. It is listed as a candidate in the feature specification; this is
the reason it is not wired.

**Google News RSS.** Its own copyright notice restricts it to personal,
non-commercial use.

### Per-item scoring

Every retrieved item carries the score the ensemble gave it, and the band
that score falls in. Both come from `tagFor`, which is also what computes
the positive and negative ratios in the sentiment panel — one definition,
so a card in the feed and the summary above it cannot disagree.

An item the ensemble did not score has no tag and renders without a chip,
rather than defaulting to neutral. Neutral is a measurement; absence is
not.

### Evidence to article

A model-cited fragment is matched back to the single retrieved item it
came from, and the panel then makes it tappable. The model is not asked
for an id and would not be trusted with one: an invented id would link a
quote to an unrelated article with complete confidence.

The match is by containment first, then by share of distinctive terms,
and **any tie resolves to null**. Two headlines can share an opening
clause and still be different stories, so guessing would attribute a
quote to coverage that never carried it, under that outlet's name. An
unmatched fragment simply renders as plain text.
