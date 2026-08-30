/// Base URL for the CritiTrack backend.
///
/// The app holds no third-party API keys — every upstream call is made by
/// the backend, which reads its secrets from the host's environment. The
/// only thing the client needs to know is which origin to talk to.
///
/// That origin is a compile-time constant rather than a bundled `.env`
/// file, because anything shipped as a Flutter asset is trivially readable
/// in a release build.
///
/// Resolution order:
///   1. `--dart-define=API_BASE_URL=...` when supplied — always wins.
///   2. In debug builds, the local Functions emulator, so `flutter run`
///      works with no flags and development never spends production
///      quota by accident.
///   3. The deployed backend.
///
/// To debug against the deployed backend, or to run on a physical device
/// where `127.0.0.1` is the device itself rather than your machine, pass
/// the flag explicitly:
///
/// ```
/// flutter run --dart-define=API_BASE_URL=https://crititrack-api.onrender.com
/// flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5001/crititrack-f7430/us-central1
/// ```
library;

import 'package:flutter/foundation.dart' show kDebugMode;

abstract final class ApiConfig {
  /// Deployed backend.
  ///
  /// Not a Cloud Functions URL: deploying functions needs a billed
  /// Firebase plan, so the same handlers run as a plain Node service
  /// (see functions/server.js) on a host with a free tier.
  static const String _prodBaseUrl = 'https://crititrack-api.onrender.com';

  /// Local Functions emulator, as started by
  /// `firebase emulators:start --only functions`.
  static const String _emulatorBaseUrl =
      'http://127.0.0.1:5001/crititrack-f7430/us-central1';

  /// Build-time override. Empty when the flag is not passed.
  static const String _override = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_override.isNotEmpty) return _override;
    return kDebugMode ? _emulatorBaseUrl : _prodBaseUrl;
  }

  /// OAuth client id for Google sign-in on the web.
  ///
  /// The web plugin cannot start a sign-in without one, and this project
  /// has no Google provider enabled — google-services.json contains no
  /// oauth_client entries at all. Supplying it is what makes the feature
  /// available:
  ///
  /// ```
  /// flutter build web --dart-define=GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
  /// ```
  ///
  /// Empty means sign-in is not offered, rather than offered and failing.
  static const String googleClientId = String.fromEnvironment(
    'GOOGLE_CLIENT_ID',
  );

  /// Whether this build is the public demo, published with no backend
  /// behind it.
  ///
  /// A build-time flag rather than something inferred. The app cannot
  /// tell an unreachable backend from a missing one without trying, and
  /// inferring it from the URL would mean a real deployment to the same
  /// origin quietly kept showing a demo notice. Passing the flag is an
  /// explicit statement by whoever published the build:
  ///
  /// ```
  /// flutter build web --release --base-href /app/ \
  ///   --dart-define=DEMO_MODE=true
  /// ```
  static const bool isDemo = bool.fromEnvironment(
    'DEMO_MODE',
    defaultValue: false,
  );

  /// Whether the app is pointed at a local emulator rather than the
  /// deployed backend. Useful for surfacing a "local backend" hint when a
  /// request fails during development.
  static bool get isLocal =>
      baseUrl.contains('127.0.0.1') || baseUrl.contains('localhost');
}
