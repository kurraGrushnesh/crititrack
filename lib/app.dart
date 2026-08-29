/// Root application widget.
///
/// Configures the [MaterialApp.router] with the light and dark themes
/// and go_router navigation. The active [ThemeMode] comes from
/// [themeModeProvider], so choosing System / Light / Dark anywhere in
/// the app re-themes it instantly.
///
/// It is also where push alerts are attached, because the three delivery
/// paths (tapped from background, tapped from cold start, arrived while
/// visible) all need something that outlives any one screen.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';
import 'core/routing/app_router.dart';
import 'features/alerts/data/push_service.dart';
import 'features/alerts/presentation/providers/alert_providers.dart';

class CritiTrackApp extends ConsumerStatefulWidget {
  const CritiTrackApp({super.key});

  @override
  ConsumerState<CritiTrackApp> createState() => _CritiTrackAppState();
}

class _CritiTrackAppState extends ConsumerState<CritiTrackApp> {
  /// Held at the root so a foreground alert can show a banner without a
  /// BuildContext from whichever screen happens to be on top.
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();

  @override
  void initState() {
    super.initState();
    // After the first frame: `start` can deliver the launching message
    // synchronously, and routing before the router has mounted throws.
    WidgetsBinding.instance.addPostFrameCallback((_) => _attachPush());
  }

  Future<void> _attachPush() async {
    if (!mounted) return;

    await ref.read(pushServiceProvider).start(
      onOpened: _openFigure,
      onForeground: _showForegroundBanner,
      // A rotated token is useless to the server until it is told, and
      // rotation is silent — so this is the difference between alerts
      // working for a week and working indefinitely.
      onToken: (_) => ref.read(alertPreferencesProvider.notifier)
          .syncRegistration(),
    );

    if (!mounted) return;

    // Re-registering on every launch refreshes the stored UTC offset,
    // which is what bounds how long quiet hours can be wrong after a
    // daylight-saving change or a flight.
    await ref.read(alertPreferencesProvider.notifier).syncRegistration();
  }

  void _openFigure(AlertMessage alert) {
    appRouter.go('/dashboard/${alert.slug}');
  }

  /// A message that arrives while the app is open is not shown by the
  /// system tray, and a system notification would be the wrong affordance
  /// for something the user is already looking at. An in-app banner that
  /// taps through is both better behaved and one fewer platform channel
  /// to go wrong.
  void _showForegroundBanner(AlertMessage alert) {
    final messenger = _messengerKey.currentState;
    if (messenger == null) return;

    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          duration: const Duration(seconds: 6),
          content: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                alert.title,
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (alert.body.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(alert.body),
              ],
            ],
          ),
          action: SnackBarAction(
            label: 'View',
            onPressed: () => _openFigure(alert),
          ),
        ),
      );
  }

  @override
  void dispose() {
    ref.read(pushServiceProvider).stop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'CritiTrack',
      debugShowCheckedModeBanner: false,
      scaffoldMessengerKey: _messengerKey,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ref.watch(themeModeProvider),
      routerConfig: appRouter,
    );
  }
}
