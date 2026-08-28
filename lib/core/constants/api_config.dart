/// Base URL for the CritiTrack backend.
///
/// The app holds no third-party API keys — every upstream call is made by
/// the Cloud Functions proxy, which reads its secrets from Secret Manager.
/// The only thing the client needs to know is which origin to talk to.
///
/// That origin is a compile-time constant rather than a bundled `.env`
/// file, because anything shipped as a Flutter asset is trivially readable
/// in a release build. Point the app at a local emulator with:
///
/// ```
/// flutter run --dart-define=API_BASE_URL=http://127.0.0.1:5001/crititrack-f7430/us-central1
/// ```
library;

abstract final class ApiConfig {
  /// Deployed backend, used whenever no override is supplied at build time.
  static const String _defaultBaseUrl =
      'https://us-central1-crititrack-f7430.cloudfunctions.net';

  /// Build-time override. Empty when the flag is not passed.
  static const String _override = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl => _override.isEmpty ? _defaultBaseUrl : _override;

  /// True when pointed at something other than the deployed backend —
  /// useful for surfacing a "local backend" badge in debug builds.
  static bool get isOverridden => _override.isNotEmpty;
}
