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
      expect(find.text('Celeb Sentiment Tracker'), findsOneWidget);
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
