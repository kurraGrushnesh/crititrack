# CritiTrack Functions

Server-side proxy so third-party API keys never ship in the app.

## Endpoints

| Function | Route | Purpose |
|---|---|---|
| `getCelebrity` | `GET ?name=<name>` | Biography + structured controversies + sentiment + media, assembled from Groq / NewsAPI / YouTube. |

## Secrets

Production keys live in Google Secret Manager. Set them once:

```bash
firebase functions:secrets:set GROQ_API_KEY
firebase functions:secrets:set NEWS_API_KEY
firebase functions:secrets:set YOUTUBE_API_KEY
```

## Local development

```bash
cd functions
cp .env.example .env.local   # fill in real keys
npm install
npm run serve                # firebase emulators:start --only functions
```

The emulator prints the local URL, e.g.
`http://127.0.0.1:5001/crititrack-f7430/us-central1/getCelebrity?name=Zendaya`

## Deploy

```bash
firebase deploy --only functions
```

Deployed URL:
`https://us-central1-crititrack-f7430.cloudfunctions.net/getCelebrity`
