// The demo notice on the published build.
//
// `ApiConfig.isDemo` is a compile-time constant, so a single test run
// cannot exercise both states. This file asserts the correct behaviour
// for whichever build it is compiled into, and is run both ways:
//
//   flutter test test/demo_banner_test.dart
//   flutter test test/demo_banner_test.dart --dart-define=DEMO_MODE=true
//
// The default run is the one that matters most: it is the guard against
// the notice leaking into a normal build.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/constants/api_config.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/widgets/demo_banner.dart';

Future<void> pump(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: const Scaffold(body: DemoBanner(child: Text('the app'))),
    ),
  );
  await tester.pump();
}

void main() {
  test('the flag defaults to off', () {
    // A build that does not pass --dart-define=DEMO_MODE is not a demo.
    // Inferring it from the backend URL instead would mean a real
    // deployment to the same origin quietly kept showing the notice.
    expect(ApiConfig.isDemo, const bool.fromEnvironment('DEMO_MODE'));
  });

  if (ApiConfig.isDemo) {
    testWidgets('states plainly that searches will return nothing', (
      tester,
    ) async {
      await pump(tester);

      expect(find.textContaining('Demo build'), findsOneWidget);
      expect(find.textContaining('No backend is deployed'), findsOneWidget);
      // A visitor who is not told this concludes the app is broken.
      expect(find.textContaining('searches return nothing'), findsOneWidget);
    });

    testWidgets('keeps the app below it', (tester) async {
      await pump(tester);
      expect(find.text('the app'), findsOneWidget);
    });

    testWidgets('is announced to a screen reader as one label', (tester) async {
      await pump(tester);

      final semantics = tester.getSemantics(
        find.byWidgetPredicate(
          (w) => w is Semantics && w.properties.liveRegion == true,
        ),
      );
      expect(semantics.label, contains('Demo build'));
      expect(semantics.label, contains('fully interactive'));
    });

    testWidgets('cannot be dismissed', (tester) async {
      // It stays true for the whole session, and one dismissed on the
      // home screen would leave the first failed search unexplained.
      await pump(tester);
      expect(find.byType(IconButton), findsNothing);
      expect(find.byIcon(Icons.close), findsNothing);
    });
  } else {
    testWidgets('adds nothing at all to a normal build', (tester) async {
      await pump(tester);

      expect(find.text('the app'), findsOneWidget);
      expect(find.textContaining('Demo build'), findsNothing);
      expect(find.textContaining('No backend'), findsNothing);
    });

    testWidgets('does not wrap the child in extra layout', (tester) async {
      // Returning the child untouched, so a normal build pays nothing —
      // not even a Column that could shift the layout by a pixel.
      await pump(tester);

      expect(
        find.descendant(
          of: find.byType(DemoBanner),
          matching: find.byType(Column),
        ),
        findsNothing,
      );
    });
  }
}
