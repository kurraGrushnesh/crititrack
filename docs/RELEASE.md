# Release engineering

Everything needed to produce a publishable Android build, and the parts
that still need a human.

> **Verification status.** The Gradle and manifest changes described here
> have **not been built**, because no Android SDK is installed on the
> machine they were written on. The XML was validated as well-formed and
> the Dart side still analyses and tests clean, but the first real
> `flutter build appbundle` may surface something. Treat the first build
> as part of the work, not as a formality.

---

## One-time setup

### 1. Create an upload keystore

```bash
keytool -genkey -v -keystore upload-keystore.jks \
  -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Store the `.jks` **outside the repository** and back it up somewhere you
will still have access to in two years. Losing it means you cannot ship an
update to an existing listing without going through Play's key-reset
process.

### 2. Point the build at it

```bash
cp android/key.properties.example android/key.properties
```

Fill in the passwords, alias and absolute path. `android/key.properties`,
`*.jks` and `*.keystore` are gitignored.

### 3. Enable Play App Signing

Let Google hold the app signing key and keep your upload key for uploads
only. If the upload key is ever lost or compromised it can be rotated;
the app signing key cannot.

---

## Building

```bash
# App Bundle — what you upload to Play.
flutter build appbundle --release \
  --obfuscate --split-debug-info=build/symbols

# APK, for sideloading or a direct download.
flutter build apk --release --split-per-abi \
  --obfuscate --split-debug-info=build/symbols
```

`--split-debug-info` writes the symbol files that turn an obfuscated
stack trace back into something readable. **Keep the `build/symbols`
directory for every release you ship** — without the matching symbols, a
crash report from that version is unreadable forever.

---

## What the build config does

| Setting | Why |
|---|---|
| `isMinifyEnabled = true` | R8 shrinks and obfuscates. Without it the APK decompiles to readable logic and every class name hints at how the app works. |
| `isShrinkResources = true` | Drops unreferenced resources; meaningful on install size. |
| `proguard-rules.pro` | Keeps what R8 cannot prove is used — the Flutter embedding, Firebase reflection, JavaScript interfaces. |
| ABI splits | Each device downloads only its own native code. |
| `usesCleartextTraffic="false"` | No plaintext HTTP at the platform level, matching `SafeUrl` in the app. |
| Backup exclusion rules | Keeps the watchlist and search history off cloud backup and device transfer, as the privacy policy states. |
| CI guard in `build.gradle.kts` | Fails a release build in CI when `key.properties` is missing, rather than silently signing with the debug key. |

### The failure mode to expect

R8 removes anything it cannot prove is used. Code reached only
reflectively looks unused and disappears, and **the symptom is always at
runtime, never at build time** — a plugin silently does nothing in release
while working perfectly in debug.

So: **test the release build on a real device before uploading.** Not the
debug build. Specifically exercise the paths that cross a platform
channel — Firebase init, anonymous sign-in, App Check, the WebView, the
share sheet.

If something breaks, add a targeted keep rule to `proguard-rules.pro`.
Do not add a blanket `-keep class ** { *; }`; that disables the shrinking
the file exists to make safe.

---

## Deep links

The manifest declares `https://crititrack.app/c/<slug>` with
`autoVerify="true"`, and `/c/:slug` redirects to the dashboard in
`app_router.dart`.

For Android to verify the link rather than showing a chooser, serve this
at `https://crititrack.app/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.crititrack.app",
    "sha256_cert_fingerprints": ["<from Play Console → App signing>"]
  }
}]
```

Use the fingerprint of the **Play app signing key**, not your upload key,
or verification fails for every user who installed from the store.

---

## Still outstanding

| Item | Needs |
|---|---|
| App icon and splash | Source artwork. The default Flutter icon is still in place; `flutter_launcher_icons` and `flutter_native_splash` can generate every density once a 1024×1024 source exists. |
| First real release build | An installed Android SDK. |
| Baseline Profiles | Worth adding for cold-start once the app is otherwise stable. |
| `assetlinks.json` | A domain to host it on. |
| Store listing | Screenshots, description, content rating. |

---

## Pre-submission checklist

- [ ] `flutter build appbundle --release` succeeds
- [ ] Release build installed on a real device and exercised end to end
- [ ] Firebase, sign-in, WebView and share verified **in release**, not debug
- [ ] `build/symbols` archived for this version
- [ ] Privacy policy hosted, with a real contact address
- [ ] Data Safety form filled in from `docs/DATA_SAFETY.md`
- [ ] Real app icon in place
- [ ] Internal → closed → production, with a staged rollout

## Web hosting

The web app **is** the product. Firebase Hosting serves one thing: the
`site/` Next.js static export at the root. `/figure/?q=<name>` is the
live profile — it obtains a Firebase anonymous ID token and an App Check
token in the browser and calls the same `getCelebrity` backend the
Flutter app used to.

The Flutter web build is no longer published. `firebase.json` redirects
`/app` and `/app/**` (301) to `/figure/` so any old link still lands
somewhere sensible.

```bash
(cd site && npm run build)
node tool/assemble_hosting.js          # site/out -> dist/
npx firebase deploy --only hosting
```

`assemble_hosting.js` stages `site/out` into `dist/` (disposable,
gitignored) so a later `next build` can't wipe the directory Hosting is
serving.

### Content-Security-Policy

`firebase.json` sets one CSP on `**`. It allows, beyond `'self'`:

- `script-src` / `frame-src` — `https://www.google.com`,
  `https://www.gstatic.com`, `https://recaptcha.net` for the reCAPTCHA
  Enterprise widget App Check uses.
- `connect-src` — `https://crititrack-api.onrender.com` (the analysis
  backend) plus the Firebase Auth / App Check / Firestore / Installations
  endpoints the JS SDK talks to.
- `img-src https:` — profile portraits come from Wikimedia and other
  upstream hosts that aren't known ahead of time.

If a dependency bump adds another third-party host, the relevant call
fails silently — check the browser console and the network tab after any
`firebase` or App Check upgrade.

### The redirect, and why there's no catch-all rewrite

The static export has a real file for every route and its own
`404.html`, so there is no SPA fallback rewrite — a catch-all would
answer every wrong URL with a `200` and tell crawlers the page exists.
`/figure/` is the one client-rendered route and it is a real file too;
the `?q=` is read on the client.

### What still needs a person

Nobody has yet confirmed a real search on the deployed site renders a
real profile end to end — the sandbox can't reach `onrender.com`. Phase
0.1 in `ROADMAP.md` is exactly that check. The backend sleeps when idle,
so the first search after a quiet spell takes 20–30s; `/figure/` shows a
"waking up" note during the wait.
