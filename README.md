# ⚖️ CritiTrack

**AI-powered celebrity criticism & controversy tracker** — A cross-platform Flutter app that combines real-time biography, media coverage, sentiment analysis, and a structured **Controversy Tracker** for any public figure, powered by Groq AI, NewsAPI, YouTube, and Instagram.

![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter)
![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart)
![Firebase](https://img.shields.io/badge/Firebase-Cloud-FFCA28?logo=firebase)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Smart Search** — Typewriter-animated search with debounced input and recent history
- **AI Biography** — Groq-generated structured profiles with profession, background, and notable works
- **Controversy Tracker** — Structured controversy episodes (title, category, 1–5 severity, status, year, sources) with a deterministic 0–100 **Controversy Index**, severity-sorted timeline, and category breakdown
- **Media Feed** — Aggregated news (NewsAPI), YouTube videos, and Instagram posts in a filterable feed
- **Sentiment Dashboard** — Interactive Pie, Line, and Bar charts with AI-written analysis, spike detection, and forecast
- **Compare** — Overlay sentiment trajectories for multiple figures with Pearson correlation
- **Premium Dark UI** — Glassmorphism, gradient cards, micro-animations, and responsive layout
- **Cross-Platform** — iOS, Android, and Web from a single codebase

---

## 🏗️ Architecture

```
Clean Architecture (Feature-First)
├── core/         → Theme, routing, models, error handling, utilities
└── features/
    ├── search/       → Home screen, search history
    ├── dashboard/    → Biography card, celebrity profile
    ├── media_feed/   → News, YouTube, Instagram cards + WebView
    └── sentiment/    → Charts, stat cards, AI analysis
```

---

## 🚀 Quick Start (under 15 minutes)

### Prerequisites
- Flutter 3.x+ (https://docs.flutter.dev/get-started/install)
- A Firebase project (https://console.firebase.google.com)

### 1. Clone and Install

```bash
git clone https://github.com/kurraGrushnesh/crititrack.git
cd crititrack
flutter pub get
```

### 2. Configure API Keys

```bash
cp .env.example .env
```

Edit `.env` with your keys (see table below). `.env` is gitignored — never commit it.

### 3. Run

```bash
flutter run -d chrome    # Web
flutter run              # Mobile
```

The app makes 100% real API calls — there is no mock mode. Without valid keys
it shows typed error states rather than fake data.

---

## 🔑 API Keys Reference

| Key | Where to Get | Used For |
|-----|-------------|----------|
| `GROQ_API_KEY` | https://console.groq.com | Biography, controversies, sentiment analysis |
| `NEWS_API_KEY` | https://newsapi.org/account | Latest news articles |
| `YOUTUBE_API_KEY` | Google Cloud Console > YouTube Data API v3 | Video search |
| `INSTAGRAM_ACCESS_TOKEN` | https://developers.facebook.com/apps | Public post search |
| `INSTAGRAM_APP_ID` | https://developers.facebook.com/apps | Instagram Graph API auth |

> ⚠️ **NEVER commit `.env` or `google-services.json` to GitHub.**
> Both are excluded via `.gitignore`. Use `.env.example` as a template.
> Client-side keys are a stopgap — see the roadmap for moving them behind a server proxy.

---

## 🔥 Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Add your app platforms (Android, iOS, Web)
3. Download config files:
   - `google-services.json` → place in `android/app/`
   - `GoogleService-Info.plist` → place in `ios/Runner/`
4. Deploy Firestore rules: `firebase deploy --only firestore:rules`
5. Enable Anonymous Authentication in Firebase Console → Authentication → Sign-in Methods

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Flutter 3.x (Dart) |
| State Management | Riverpod 2.x |
| Navigation | go_router |
| Charts | fl_chart (Pie, Line, Bar) |
| Database | Firebase Cloud Firestore |
| Auth | Firebase Auth (Anonymous + Google) |
| HTTP | Dart http package |
| Local Cache | Hive Flutter |
| UI | shimmer, cached_network_image, lottie |
| WebView | webview_flutter |

---

## 🧪 Testing

```bash
flutter test                    # Run all tests
flutter test --coverage         # With coverage report
flutter analyze                 # Static analysis
```

---

## 📦 Deployment

### Web (Firebase Hosting)

```bash
flutter build web --release --web-renderer=canvaskit
firebase deploy --only hosting
```

### CI/CD

GitHub Actions workflow runs on every PR:
- `flutter analyze`
- `flutter test --coverage`
- `flutter build web`

---

## 🔒 Security

- All API keys stored locally in `api_keys.dart` — excluded from version control
- `google-services.json` — excluded from version control
- See `api_keys.dart.example` for the required key format
- Never share or commit real credentials

---

## 📁 Project Structure

```
lib/
├── core/
│   ├── constants/       # API keys & app constants
│   ├── domain/models/   # Data models
│   ├── error/           # Error handling
│   ├── routing/         # App navigation
│   ├── theme/           # App theme
│   └── utils/           # Helper functions
├── features/
│   ├── dashboard/       # Main dashboard
│   ├── media_feed/      # News/YouTube/Instagram
│   ├── search/          # Celebrity search
│   └── sentiment/       # Sentiment analysis
└── main.dart
```

---

## 📄 License

MIT License — feel free to use, modify and distribute.

---

## 👨‍💻 Author

**kurraGrushnesh** — [GitHub](https://github.com/kurraGrushnesh)