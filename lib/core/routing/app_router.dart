/// Application router using [go_router] with deep-link support.
///
/// Route tree:
///   /                       → HomeScreen (search)
///   /dashboard/:slug        → DashboardScreen (celebrity detail)
///   /dashboard/:slug/media  → WebViewScreen (in-app browser)
///   /error                  → Generic error screen
///
/// The router is provided as a Riverpod provider so it can react
/// to auth state changes if needed in Phase 4.
library;

import 'package:go_router/go_router.dart';

import '../../features/search/presentation/screens/home_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/media_feed/presentation/screens/webview_screen.dart';
import '../../features/dashboard/presentation/screens/error_screen.dart';
import '../../features/sentiment/presentation/screens/compare_screen.dart';
import '../../features/alerts/presentation/screens/alert_settings_screen.dart';
import '../../features/browse/presentation/screens/browse_screen.dart';
import '../../features/browse/presentation/screens/category_detail_screen.dart';
import '../widgets/main_shell.dart';

/// Named route constants to avoid magic strings.
abstract final class AppRoutes {
  static const String home = '/';
  static const String browse = '/browse';
  static const String category = '/browse/:category';
  static const String compare = '/compare';
  static const String dashboard = '/dashboard/:slug';
  static const String mediaWebView = '/dashboard/:slug/media';
  static const String alerts = '/alerts';
  static const String error = '/error';
}

/// Central router configuration.
///
/// Depends on no external state in Phase 1 — auth-aware redirects
/// will be layered in Phase 4.
final GoRouter appRouter = GoRouter(
  initialLocation: AppRoutes.home,
  debugLogDiagnostics: true,
  routes: [
    // Primary sections share a persistent bottom navigation. Detail
    // views (dashboard, webview, alerts) are pushed over the shell and
    // are full-screen.
    StatefulShellRoute.indexedStack(
      builder:
          (context, state, navigationShell) =>
              MainShell(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/',
              name: 'home',
              builder:
                  (context, state) =>
                      HomeScreen(initialQuery: state.uri.queryParameters['q']),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/browse',
              name: 'browse',
              builder: (context, state) => const BrowseScreen(),
              routes: [
                GoRoute(
                  path: ':category',
                  name: 'category',
                  builder:
                      (context, state) => CategoryDetailScreen(
                        slug: state.pathParameters['category']!,
                      ),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/compare',
              name: 'compare',
              builder: (context, state) => const CompareScreen(),
            ),
          ],
        ),
      ],
    ),
    // Short public URL, used by App Links and by shared cards:
    // https://crititrack.app/c/<slug>. Redirects rather than duplicating
    // the screen, so there is one canonical in-app location for a figure
    // and back-navigation behaves the same however you arrived.
    GoRoute(
      path: '/c/:slug',
      name: 'figureLink',
      redirect:
          (context, state) => '/dashboard/${state.pathParameters['slug']}',
    ),
    GoRoute(
      path: '/dashboard/:slug',
      name: 'dashboard',
      builder: (context, state) {
        final slug = state.pathParameters['slug']!;
        return DashboardScreen(slug: slug);
      },
      routes: [
        GoRoute(
          path: 'media',
          name: 'mediaWebView',
          builder: (context, state) {
            final url = state.uri.queryParameters['url'] ?? '';
            final title = state.uri.queryParameters['title'] ?? 'Media';
            return WebViewScreen(url: url, title: title);
          },
        ),
      ],
    ),
    GoRoute(
      path: '/alerts',
      name: 'alerts',
      builder: (context, state) => const AlertSettingsScreen(),
    ),
    GoRoute(
      path: '/error',
      name: 'error',
      builder: (context, state) {
        final message =
            state.uri.queryParameters['message'] ?? 'Something went wrong.';
        final type = state.uri.queryParameters['type'] ?? 'generic';
        return ErrorScreen(message: message, errorType: type);
      },
    ),
  ],
  errorBuilder:
      (context, state) => ErrorScreen(
        message: 'Page not found: ${state.uri.path}',
        errorType: 'notFound',
      ),
);
