// Accessibility guards.
//
// These are regression tests, not a one-off audit. Flutter's own
// guideline matchers check tap-target size, contrast and labelling, so a
// future change that drops a label or shrinks a control fails here rather
// than reaching a user who depends on it.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/theme/theme_controller.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_section.dart';
import 'package:crititrack/features/search/presentation/screens/home_screen.dart';

Widget host(Widget child, {Brightness brightness = Brightness.dark}) {
  return ProviderScope(
    child: MaterialApp(
      theme:
          brightness == Brightness.dark
              ? AppTheme.darkTheme
              : AppTheme.lightTheme,
      home: child,
    ),
  );
}

const controversies = [
  Controversy(
    title: 'Tax filing dispute',
    summary: 'A disagreement over reported income, later settled.',
    category: ControversyCategory.financial,
    severity: 3,
    status: ControversyStatus.resolved,
    year: 2022,
    sources: ['Variety'],
  ),
];

void main() {
  setUpAll(() async {
    Hive.init('./.dart_tool/test_hive_a11y');
    await Hive.openBox<dynamic>(settingsBoxName);
  });

  tearDownAll(() async {
    await Hive.deleteBoxFromDisk(settingsBoxName);
    await Hive.close();
  });

  group('home screen meets the platform guidelines', () {
    testWidgets('in dark mode', (tester) async {
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(host(const HomeScreen()));

      await expectLater(tester, meetsGuideline(textContrastGuideline));
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      handle.dispose();
    });

    testWidgets('in light mode', (tester) async {
      // Contrast is the failure mode most likely to appear in only one
      // theme, so both are checked rather than assuming symmetry.
      final handle = tester.ensureSemantics();
      await tester.pumpWidget(
        host(const HomeScreen(), brightness: Brightness.light),
      );

      await expectLater(tester, meetsGuideline(textContrastGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));

      handle.dispose();
    });
  });

  group('controversy section meets the platform guidelines', () {
    testWidgets('with episodes, in both themes', (tester) async {
      for (final brightness in [Brightness.dark, Brightness.light]) {
        final handle = tester.ensureSemantics();
        await tester.pumpWidget(
          host(
            const Scaffold(
              body: SingleChildScrollView(
                child: ControversySection(
                  controversies: controversies,
                  name: 'Jane Doe',
                ),
              ),
            ),
            brightness: brightness,
          ),
        );

        await expectLater(tester, meetsGuideline(textContrastGuideline));
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));

        handle.dispose();
      }
    });
  });

  testWidgets('the app is usable at a large text scale', (tester) async {
    // Someone who has turned text size up must still be able to operate
    // the app; overflow here would mean unreachable controls.
    tester.view.physicalSize = const Size(1200, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.darkTheme,
          builder:
              (context, child) => MediaQuery.withClampedTextScaling(
                minScaleFactor: 1.6,
                maxScaleFactor: 1.6,
                child: child!,
              ),
          home: const HomeScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
