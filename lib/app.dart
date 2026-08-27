/// Root application widget.
///
/// Configures the [MaterialApp.router] with the app's dark theme
/// and go_router navigation. This is a [ConsumerWidget] to allow
/// future auth-state-based redirect logic in Phase 4.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'core/routing/app_router.dart';

class CritiTrackApp extends ConsumerWidget {
  const CritiTrackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'CritiTrack',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: appRouter,
    );
  }
}
