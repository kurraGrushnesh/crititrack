# Deploying the backend without Firebase

Cloud Functions requires a billed Firebase plan, so the API runs as a
plain Node service (`functions/server.js`) on a host with a real free
tier. The request logic is shared with the Cloud Functions entry point
via `functions/lib/handlers.js`, so the two cannot drift, and moving back
to Cloud Functions later is a one-line change.

## Host: Render (free tier)

The free plan sleeps a service after 15 minutes of inactivity, so the
first request after a lull takes ~40s while it wakes. For a demo backend
that is acceptable.

1. **render.com** → New → Blueprint → connect this repository. Render
   reads `render.yaml` and creates a service named `crititrack-api`.
2. Open the service → **Environment** → set these five values:

   | Variable | Value | Where it comes from |
   |---|---|---|
   | `FIREBASE_SERVICE_ACCOUNT` | the entire service-account JSON, pasted as one value | Firebase console → ⚙ → Service accounts → Generate new private key |
   | `GROQ_API_KEY` | your Groq key | console.groq.com |
   | `NEWS_API_KEY` | your NewsAPI key | newsapi.org |
   | `YOUTUBE_API_KEY` | your YouTube Data API key | Google Cloud console |
   | `REFRESH_SECRET` | any random string | you choose it |

   Render mangles multi-line values inconsistently. If the service logs
   `FIREBASE_SERVICE_ACCOUNT is not valid JSON`, base64-encode the file
   and paste that instead — `server.js` accepts either form.
3. Deploy. The health check is `GET /health`; the service is up when it
   returns `{"ok":true}`.
4. Note the public URL Render assigns, e.g.
   `https://crititrack-api.onrender.com`.

## Point the app at it

The web app reads its backend origin from a build flag, so no code
changes:

```bash
flutter build web --release --base-href /app/ \
  --dart-define=API_BASE_URL=https://crititrack-api.onrender.com \
  --dart-define=RECAPTCHA_SITE_KEY=<your reCAPTCHA v3 site key>
```

Note the absence of `--dart-define=DEMO_MODE=true` — this build is the
real one. Then reassemble and redeploy hosting:

```bash
(cd site && npm run build)
node tool/assemble_hosting.js
npx firebase deploy --only hosting
```

## App Check

The endpoint's SEC-02 guard chain requires an App Check token on every
call, and fails closed without one. On the web that means a reCAPTCHA v3
site key:

1. **google.com/recaptcha/admin** → register a site → **Score based
   (v3)** → domains `crititrack-f7430.web.app` and
   `crititrack-f7430.firebaseapp.com`. Free: 10,000 assessments/month, no
   card.
2. You get a **site key** (public — it goes in the build flag above) and
   a **secret key**.
3. Firebase console → **App Check** → register the web app → provider
   **reCAPTCHA v3** → paste the secret key.

Without this the app loads and every search returns
`attestation_required`.

## Firestore rules

Deploy once (free, no Blaze):

```bash
npx firebase deploy --only firestore:rules
```

The client only ever reads `celebrities/*`; the backend writes with the
Admin SDK, which bypasses rules. Anonymous auth satisfies the read rule.

## The scheduled refresh (optional)

`POST /refresh` runs `runScheduledRefresh` — the job that records one
dated sentiment snapshot per figure and fires spike alerts. Search works
without it; the trend chart just stays empty until history accumulates.

To enable it, point a free external cron at the endpoint every 30
minutes:

```
POST https://crititrack-api.onrender.com/refresh
Header: X-Refresh-Secret: <the REFRESH_SECRET you set>
```

**cron-job.org** (free) or a GitHub Actions `schedule:` workflow both
work. The job is bounded to 10 figures per call regardless of how the
collection grows, so the secret only needs to deter idle traffic.
