library;

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/constants/api_config.dart';
import 'core/theme/theme_controller.dart';
import 'firebase_options.dart';

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
  } catch (e, st) {
    debugPrint('Firebase initialisation failed: $e\n$st');
  }

  // ── Local cache & preferences ──────────────────────────────────────
  await Hive.initFlutter();
  await Hive.openBox<List<String>>('search_recents');
  // Holds the user's appearance choice (system / light / dark).
  await Hive.openBox<dynamic>(settingsBoxName);

  runApp(const ProviderScope(child: CritiTrackApp()));
}
