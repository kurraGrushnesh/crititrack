/// Root application widget.
///
/// Configures the [MaterialApp.router] with the light and dark themes
/// and go_router navigation. The active [ThemeMode] comes from
/// [themeModeProvider], so choosing System / Light / Dark anywhere in
/// the app re-themes it instantly.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'core/routing/app_router.dart';

class CritiTrackApp extends ConsumerWidget {
  const CritiTrackApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'CritiTrack',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ref.watch(themeModeProvider),
      routerConfig: appRouter,
    );
  }
}
