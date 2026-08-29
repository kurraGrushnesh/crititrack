// The trend chart, now that history is recorded rather than generated.
//
// Snapshots used to be written seven at a time, backdated from a series
// the model invented. They are now one observation per refresh, so a
// figure looked up for the first time genuinely has none — and the chart
// has to say that rather than draw a confident line or look broken.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/sentiment_section.dart';

SentimentSnapshot snap(String date, double score) => SentimentSnapshot(
  date: date,
  positiveCount: 2,
  negativeCount: 1,
  neutralCount: 1,
  totalMentions: 4,
  dominantEmotion: 'neutral',
  score: score,
);

SentimentData data(List<SentimentSnapshot> trend) => SentimentData(
  overallScore: 62,
  positiveRatio: 0.5,
  negativeRatio: 0.25,
  neutralRatio: 0.25,
  trendDirection: 'stable',
  explanation: 'Coverage is mixed.',
  trendData: trend,
  dominantEmotion: 'neutral',
  confidence: 0.6,
  confidenceLabel: 'Moderate confidence',
  scoreLow: 55,
  scoreHigh: 69,
  sampleSize: 4,
);

Future<void> showTrend(WidgetTester tester, SentimentData d) async {
  tester.view.physicalSize = const Size(1000, 2000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: Scaffold(
        body: SingleChildScrollView(child: SentimentSection(sentimentData: d)),
      ),
    ),
  );

  // The section runs a typewriter animation on its explanation, so
  // pumpAndSettle would wait on something that is not the chart.
  await tester.pump(const Duration(milliseconds: 100));
  // A Tab renders its label in two Text widgets, so target the Tab.
  await tester.tap(find.widgetWithText(Tab, 'Trend'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 500));
  await tester.pump(const Duration(milliseconds: 500));
}

void main() {
  testWidgets('says nothing has been recorded yet, rather than failing', (
    tester,
  ) async {
    await showTrend(tester, data(const []));

    expect(find.textContaining('No history recorded yet'), findsOneWidget);
    // "No data available" reads as a fault. This is not a fault.
    expect(find.textContaining('next refresh'), findsOneWidget);
  });

  testWidgets('names how little history a short line is drawn from', (
    tester,
  ) async {
    // Without this a two-point line is indistinguishable from a
    // two-week one.
    await showTrend(
      tester,
      data([snap('2026-03-01', 60), snap('2026-03-02', 64)]),
    );

    expect(find.textContaining('2 days recorded so far'), findsOneWidget);
  });

  testWidgets('uses the singular for a single day', (tester) async {
    await showTrend(tester, data([snap('2026-03-01', 60)]));
    expect(find.textContaining('1 day recorded so far'), findsOneWidget);
  });

  testWidgets('drops the caveat once there is enough history', (tester) async {
    await showTrend(
      tester,
      data([
        snap('2026-03-01', 60),
        snap('2026-03-02', 62),
        snap('2026-03-03', 64),
        snap('2026-03-04', 66),
        snap('2026-03-05', 68),
      ]),
    );

    expect(find.textContaining('recorded so far'), findsNothing);
  });

  testWidgets('the tab no longer promises seven days', (tester) async {
    // The label was tied to the fixed-length generated series. History is
    // now however much has actually accumulated.
    await showTrend(tester, data(const []));
    expect(find.widgetWithText(Tab, '7-Day Trend'), findsNothing);
    expect(find.widgetWithText(Tab, 'Trend'), findsOneWidget);
  });
}
