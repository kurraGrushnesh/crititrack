/// Base URL for the CritiTrack backend (Cloud Functions proxy).
///
/// All third-party API keys live server-side now — the app only ever
/// talks to this origin. Override `API_BASE_URL` in `.env` to point at
/// the local Firebase emulator during development, e.g.
/// `http://127.0.0.1:5001/crititrack-f7430/us-central1`.
library;

import 'package:flutter_dotenv/flutter_dotenv.dart';

abstract final class ApiConfig {
  static const String _prodBaseUrl =
      'https://us-central1-crititrack-f7430.cloudfunctions.net';

  static String get baseUrl {
    // dotenv throws if load() was never called (e.g. in unit tests), so
    // guard with isInitialized and fall back to the production URL.
    final override =
        dotenv.isInitialized ? dotenv.maybeGet('API_BASE_URL') : null;
    return (override != null && override.isNotEmpty) ? override : _prodBaseUrl;
  }
}
