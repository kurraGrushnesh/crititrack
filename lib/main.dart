library;

import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart' show kDebugMode, kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/constants/api_config.dart';
import 'core/platform/url_strategy.dart';
import 'core/theme/theme_controller.dart';
import 'features/alerts/data/alert_preferences_store.dart';
import 'features/alerts/data/push_service.dart';
import 'features/watchlist/data/watchlist_repository.dart';
import 'features/research/data/research_repository.dart';
import 'features/research/data/report_repository.dart';
import 'features/research/data/compare_repository.dart';
import 'firebase_options.dart';

/// reCAPTCHA Enterprise site key for App Check on the web.
///
/// Public by design — it is bound to our domains and is useless from
/// anywhere else. Supply with --dart-define=RECAPTCHA_SITE_KEY=... at
/// build time.
///
/// Enterprise rather than the classic v3 provider because that is how
/// App Check is registered in the Firebase console (the current
/// reCAPTCHA console issues Enterprise keys even for "score based v3").
/// The two must match or every attestation fails.
const String _recaptchaSiteKey = String.fromEnvironment('RECAPTCHA_SITE_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Real paths instead of hash URLs on the web, so a deep link
  // arrives with its route intact. A no-op everywhere else.
  configureUrlStrategy();

  // The app ships with no secrets: every upstream call is made by the
  // backend proxy, and the only client-side configuration is the backend
  // origin, supplied at compile time via --dart-define. See [ApiConfig].
  if (ApiConfig.isLocal) {
    debugPrint('Using local backend: ${ApiConfig.baseUrl}');
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
    // and anyone who finds the endpoint URL.
    //
    // Web and native are activated separately because the web SDK has no
    // debug provider to fall back on: passing a null providerWeb makes it
    // call `initialize` on nothing and throw. Without a site key there is
    // simply nothing to activate on web, so we skip it rather than crash.
    if (kIsWeb) {
      if (_recaptchaSiteKey.isNotEmpty) {
        await FirebaseAppCheck.instance.activate(
          providerWeb: ReCaptchaEnterpriseProvider(_recaptchaSiteKey),
        );
      } else {
        debugPrint(
          'App Check skipped on web: no RECAPTCHA_SITE_KEY supplied. '
          'Deployed calls will be rejected until one is provided.',
        );
      }
    } else {
      await FirebaseAppCheck.instance.activate(
        providerAndroid:
            kDebugMode
                ? AndroidDebugProvider()
                : AndroidPlayIntegrityProvider(),
        providerApple:
            kDebugMode ? AppleDebugProvider() : AppleAppAttestProvider(),
      );
    }
    // Registering this is what makes Flutter wake for a notification
    // delivered while the app is not running. Without it the message
    // is handed to the system tray and the app never learns it
    // happened, so a cold-start tap has nothing to route from. Not on
    // web, which has no background isolate.
    if (!kIsWeb) {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    }
  } catch (e, st) {
    // A missing console configuration must not stop the app from starting:
    // the backend answers 401 and the UI renders a typed failure instead.
    debugPrint('Firebase initialisation failed: $e\n$st');
  }

  // ── Local cache & preferences ──────────────────────────────────────
  await Hive.initFlutter();
  // Untyped: Hive returns a stored list as List<dynamic>, so a
  // Box<List<String>> throws on every read after a restart.
  await Hive.openBox<dynamic>('search_recents');
  // Holds the user's appearance choice (system / light / dark).
  await Hive.openBox<dynamic>(settingsBoxName);
  // The watchlist is local-first, so it must be open before first paint.
  await Hive.openBox<dynamic>(watchlistBoxName);
  // Alert preferences and this install's push identity.
  await Hive.openBox<dynamic>(alertPrefsBoxName);
  // Research Workspaces: local-first, same as the watchlist above.
  await Hive.openBox<dynamic>(researchWorkspacesBoxName);
  await Hive.openBox<dynamic>(researchItemsBoxName);
  await Hive.openBox<dynamic>(researchActivityBoxName);
  // Professional Research Reports, generated from a workspace.
  await Hive.openBox<dynamic>(reportsBoxName);
  await Hive.openBox<dynamic>(reportSectionsBoxName);
  await Hive.openBox<dynamic>(reportCitationsBoxName);
  // Saved comparisons (Advanced Compare).
  await Hive.openBox<dynamic>(comparisonsBoxName);

  runApp(const ProviderScope(child: CritiTrackApp()));
}
