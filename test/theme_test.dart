// Tests for the light/dark/system theming system.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/theme/theme_controller.dart';
import 'package:crititrack/core/theme/theme_toggle.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_section.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/features/search/presentation/screens/home_screen.dart';

void main() {
  _toggleSizing();
  group('AppTheme', () {
    test('both themes register an AppPalette with matching brightness', () {
      final dark = AppTheme.darkTheme;
      final light = AppTheme.lightTheme;

      expect(dark.brightness, Brightness.dark);
      expect(light.brightness, Brightness.light);
      expect(dark.extension<AppPalette>(), AppTheme.darkPalette);
      expect(light.extension<AppPalette>(), AppTheme.lightPalette);
      expect(dark.scaffoldBackgroundColor, AppTheme.darkPalette.background);
      expect(light.scaffoldBackgroundColor, AppTheme.lightPalette.background);
    });

    testWidgets('context.palette resolves per-brightness tokens', (
      tester,
    ) async {
      late AppPalette resolved;

      Future<void> pump(ThemeData theme) => tester.pumpWidget(
        MaterialApp(
          theme: theme,
          home: Builder(
            builder: (context) {
              resolved = context.palette;
              return const SizedBox();
            },
          ),
        ),
      );

      await pump(AppTheme.lightTheme);
      expect(resolved.card, AppTheme.lightPalette.card);

      // MaterialApp animates between themes, so settle before asserting.
      await pump(AppTheme.darkTheme);
      await tester.pumpAndSettle();
      expect(resolved.card, AppTheme.darkPalette.card);
    });

    testWidgets('dashboard sections render under the light theme', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: SingleChildScrollView(
              child: ControversySection(
                controversies: [
                  Controversy(
                    title: 'Tax filing dispute',
                    summary: 'A disagreement over reported income.',
                    category: ControversyCategory.financial,
                    severity: 3,
                    status: ControversyStatus.resolved,
                    year: 2022,
                  ),
                ],
                name: 'Jane Doe',
              ),
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('Controversy Tracker'), findsOneWidget);
    });
  });

  testWidgets('home screen lays out cleanly in both skins', (tester) async {
    for (final theme in [AppTheme.lightTheme, AppTheme.darkTheme]) {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(theme: theme, home: const HomeScreen()),
        ),
      );
      await tester.pump();

      expect(tester.takeException(), isNull);
      expect(find.text('CritiTrack'), findsOneWidget);
      expect(find.byType(ThemeToggle), findsOneWidget);
    }
  });

  group('ThemeModeController', () {
    test('defaults to system when no preference is stored', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(themeModeProvider), ThemeMode.system);
    });

    test('cycles system → light → dark → system', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final controller = container.read(themeModeProvider.notifier);

      await controller.cycle();
      expect(container.read(themeModeProvider), ThemeMode.light);
      await controller.cycle();
      expect(container.read(themeModeProvider), ThemeMode.dark);
      await controller.cycle();
      expect(container.read(themeModeProvider), ThemeMode.system);
    });
  });

  testWidgets('ThemeToggle offers all three modes and applies a choice', (
    tester,
  ) async {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          home: const Scaffold(
            appBar: null,
            body: Center(child: ThemeToggle()),
          ),
        ),
      ),
    );

    await tester.tap(find.byType(ThemeToggle));
    await tester.pumpAndSettle();

    expect(find.text('System'), findsWidgets);
    expect(find.text('Light'), findsOneWidget);
    expect(find.text('Dark'), findsOneWidget);

    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();

    expect(container.read(themeModeProvider), ThemeMode.dark);
  });
}

// Regression: the non-compact toggle used to swallow the page.
//
// It was a Container with `alignment: Alignment.center` and no explicit
// size. A Container given an alignment expands to fill whatever bounded
// constraints it receives, so on the home screen it stretched to the full
// height of the Stack and drew an empty panel down the right edge. Only
// visible by loading the deployed app — every widget test pumped it in a
// tight box where there was nothing to expand into.
void _toggleSizing() {
  testWidgets('the non-compact toggle sizes to its content', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            // Deliberately roomy: the bug only appears when the toggle is
            // handed constraints far larger than it needs.
            body: SizedBox(
              width: 900,
              height: 700,
              child: Align(
                alignment: Alignment.topRight,
                child: ThemeToggle(),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    final size = tester.getSize(find.byType(ThemeToggle));
    expect(size.height, lessThanOrEqualTo(56), reason: 'must not fill height');
    expect(size.width, lessThan(300), reason: 'must not fill width');
  });
}
