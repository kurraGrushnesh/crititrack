library;

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/constants/api_config.dart';
import 'core/theme/theme_controller.dart';
import 'firebase_options.dart';

/// reCAPTCHA v3 site key for App Check on the web. Public by design — it
/// is bound to our domains and is useless from anywhere else. Supply with
/// --dart-define=RECAPTCHA_SITE_KEY=... at build time.
const String _recaptchaSiteKey = String.fromEnvironment('RECAPTCHA_SITE_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // The app ships with no secrets: every upstream call is made by the
  // backend proxy, and the only client-side configuration is the backend
  // origin, supplied at compile time via --dart-define. See [ApiConfig].
  if (ApiConfig.isOverridden) {
    debugPrint('Backend override active: ${ApiConfig.baseUrl}');
  }

  // ── Firebase ───────────────────────────────────────────────────────
  // Wrapped so a Firebase outage or misconfiguration degrades gracefully
  // rather than blocking app start. Features that need Firebase check
  // [Firebase.apps] before using it.
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    // SEC-02: App Check proves a call came from a build we published
    // rather than a script, which is what stands between our API budget
    // and anyone who finds the endpoint URL. Debug providers are used in
    // debug builds so local development needs no real attestation.
    await FirebaseAppCheck.instance.activate(
      androidProvider:
          kDebugMode ? AndroidProvider.debug : AndroidProvider.playIntegrity,
      appleProvider: kDebugMode ? AppleProvider.debug : AppleProvider.appAttest,
      webProvider:
          kDebugMode || _recaptchaSiteKey.isEmpty
              ? null
              : ReCaptchaV3Provider(_recaptchaSiteKey),
    );
  } catch (e, st) {
    // A missing console configuration must not stop the app from starting:
    // the backend answers 401 and the UI renders a typed failure instead.
    debugPrint('Firebase initialisation failed: $e\n$st');
  }

  // ── Local cache & preferences ──────────────────────────────────────
  await Hive.initFlutter();
  await Hive.openBox<List<String>>('search_recents');
  // Holds the user's appearance choice (system / light / dark).
  await Hive.openBox<dynamic>(settingsBoxName);

  runApp(const ProviderScope(child: CritiTrackApp()));
}
