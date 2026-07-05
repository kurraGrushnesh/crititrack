# 🧠 Criticism on Celebrietes using AI

**AI-Powered Celebrity Intelligence Platform** — A cross-platform Flutter app that provides real-time celebrity biography, media feed, and sentiment analysis powered by Groq AI, NewsAPI, YouTube, and Instagram.

![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter)
![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart)
![Firebase](https://img.shields.io/badge/Firebase-Cloud-FFCA28?logo=firebase)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

- **Smart Search** — Typewriter-animated search with debounced input and recent history
- **AI Biography** — Groq AI generated structured celebrity profiles with notable works and controversies
- **Media Feed** — Aggregated news (NewsAPI), YouTube videos, and Instagram posts in a filterable feed
- **Sentiment Dashboard** — Interactive Pie, Line, and Bar charts with AI-written analysis
- **Premium Dark UI** — Glassmorphism, gradient cards, micro-animations, and responsive layout
- **Smart Caching** — Firestore with 24h TTL + 5-min rate limiting to minimize API costs
- **Cross-Platform** — iOS, Android, and Web from a single codebase
- **Mock Mode** — Full demo with 5 pre-seeded celebrities, zero API keys required

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
git clone https://github.com/kurraGrushnesh/celeb-sentiment-tracker.git
cd celeb-sentiment-tracker
flutter pub get
```

### 2. Configure API Keys

```bash
cp lib/core/constants/api_keys.dart.example lib/core/constants/api_keys.dart
```

Edit `lib/core/constants/api_keys.dart` with your keys (see table below).

### 3. Run in Mock Mode (No Keys Needed!)

The app ships with `useMockData = true`, so you can run immediately:

```bash
flutter run -d chrome    # Web
flutter run              # Mobile
```

### 4. Switch to Real Mode

Set `useMockData = false` in `api_keys.dart` and provide valid API keys.

---

## 🔑 API Keys Reference

| Key | Where to Get | Used For |
|-----|-------------|----------|
| `groqApiKey` | https://console.groq.com | Biography generation + sentiment analysis |
| `newsApiKey` | https://newsapi.org/account | Latest news articles |
| `youtubeApiKey` | Google Cloud Console > YouTube Data API v3 | Video search |
| `instagramAccessToken` | https://developers.facebook.com/apps | Public post search |
| `instagramAppId` | https://developers.facebook.com/apps | Instagram Graph API auth |

> ⚠️ **NEVER commit `api_keys.dart` or `google-services.json` to GitHub.**
> These files are excluded via `.gitignore`. Use `api_keys.dart.example` as a template.

---

## 🎭 Mock Mode

When `useMockData = true` (default), the app uses pre-seeded realistic data for:

| Celebrity | Sentiment Score | Emotion | Trend |
|-----------|----------------|---------|-------|
| Taylor Swift | 78 | Joy | ⬆️ Up |
| Elon Musk | 45 | Controversy | ⬇️ Down |
| BTS | 88 | Admiration | ⬆️ Up |
| Cristiano Ronaldo | 62 | Excitement | ➡️ Stable |
| Zendaya | 72 | Admiration | ⬆️ Up |

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
