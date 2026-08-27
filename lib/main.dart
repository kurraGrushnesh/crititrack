library;

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Environment ────────────────────────────────────────────────────
  // API keys and other config are read from a local, gitignored .env.
  // A missing file is non-fatal: services surface a typed ApiKeyFailure.
  try {
    await dotenv.load(fileName: '.env');
  } catch (e) {
    debugPrint(
      'No .env file loaded ($e) — API calls will fail until keys are set.',
    );
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

  // ── Local cache ────────────────────────────────────────────────────
  await Hive.initFlutter();
  await Hive.openBox<List<String>>('search_recents');

  runApp(const ProviderScope(child: CritiTrackApp()));
}
