// F09 lists "honoured reduced-motion" among the accessibility rules. It
// was not honoured anywhere: the explanation typed itself out character
// by character and the loading skeleton swept a gradient, both
// regardless of the system setting.
//
// The typewriter is the one that mattered most. It is not only motion —
// it withholds information while it runs, so a screen reader announces a
// paragraph that is still being written and anyone who reads faster than
// the timer is made to wait.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shimmer/shimmer.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/dashboard/presentation/screens/dashboard_screen.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/sentiment_section.dart';

const explanation =
    'Coverage this week leaned positive, driven by award nominations '
    'and a well-received interview.';

SentimentData data() => const SentimentData(
  overallScore: 71,
  positiveRatio: 0.6,
  negativeRatio: 0.2,
  neutralRatio: 0.2,
  trendDirection: 'up',
  explanation: explanation,
  trendData: [],
  dominantEmotion: 'admiration',
  confidence: 0.7,
  confidenceLabel: 'Moderate confidence',
  scoreLow: 64,
  scoreHigh: 78,
  sampleSize: 14,
);

Future<void> pumpSection(
  WidgetTester tester, {
  required bool disableAnimations,
}) async {
  tester.view.physicalSize = const Size(900, 2000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: MediaQuery(
        data: MediaQueryData(disableAnimations: disableAnimations),
        child: Scaffold(
          body: SingleChildScrollView(
            child: SentimentSection(sentimentData: data()),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('the explanation typewriter', () {
    testWidgets('shows the whole text at once under reduced motion', (
      tester,
    ) async {
      await pumpSection(tester, disableAnimations: true);

      // Present on the very first frame, with no pumping at all.
      expect(find.text(explanation), findsOneWidget);
    });

    testWidgets('still reveals gradually when motion is wanted', (
      tester,
    ) async {
      // The guard must be conditional, not a quiet removal of the effect.
      await pumpSection(tester, disableAnimations: false);

      expect(find.text(explanation), findsNothing);

      await tester.pump(const Duration(seconds: 5));
      expect(find.text(explanation), findsOneWidget);
    });

    testWidgets('leaves no timer running under reduced motion', (tester) async {
      // A periodic timer that outlives the test fails the binding, which
      // is the check that the early return really did return.
      await pumpSection(tester, disableAnimations: true);
      await tester.pump(const Duration(seconds: 1));
    });
  });

  group('the loading skeleton', () {
    Future<void> pumpLoading(
      WidgetTester tester, {
      required bool disableAnimations,
    }) async {
      tester.view.physicalSize = const Size(900, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // Never completes, so the screen stays in its loading state.
            dashboardProvider.overrideWith(
              (ref, slug) => Completer<Celebrity>().future,
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.darkTheme,
            home: MediaQuery(
              data: MediaQueryData(disableAnimations: disableAnimations),
              child: const DashboardScreen(slug: 'jane-doe'),
            ),
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('sweeps a highlight when motion is wanted', (tester) async {
      await pumpLoading(tester, disableAnimations: false);
      expect(find.byType(Shimmer), findsOneWidget);
    });

    testWidgets('drops the sweep under reduced motion', (tester) async {
      await pumpLoading(tester, disableAnimations: true);
      expect(find.byType(Shimmer), findsNothing);
    });

    testWidgets('still indicates loading either way', (tester) async {
      // What is removed is the movement, not the indication. The layout
      // is written once, so the two paths cannot drift apart.
      await pumpLoading(tester, disableAnimations: true);
      expect(find.byType(SingleChildScrollView), findsWidgets);
      expect(find.text('Jane Doe'), findsOneWidget);
    });
  });
}
