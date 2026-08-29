// The compare screen, rendered with fixtures.
//
// Worth pumping rather than only unit-testing the analytics, because the
// two defects fixed alongside this feature were both presentation ones:
// a correlation reported from two shared days, and an overlay chart whose
// axis was labelled with one figure's dates while every series was
// plotted by its own index.
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/sentiment/presentation/screens/compare_screen.dart';

/// `n` days before today, as the ISO key the snapshots use.
///
/// Relative to now rather than a fixed date because the screen's default
/// window is the last 30 days — hard-coded January dates would fall
/// outside it and every assertion would pass for the wrong reason.
String daysAgo(int n) {
  final d = DateTime.now().toUtc().subtract(Duration(days: n));
  final date = DateTime.utc(d.year, d.month, d.day);
  return date.toIso8601String().substring(0, 10);
}

SentimentSnapshot snap(String date, double score) => SentimentSnapshot(
  date: date,
  positiveCount: 1,
  negativeCount: 0,
  neutralCount: 0,
  totalMentions: 1,
  dominantEmotion: 'neutral',
  score: score,
);

Celebrity figure({
  required String slug,
  required String name,
  required List<SentimentSnapshot> trend,
  List<Controversy> controversies = const [],
}) => Celebrity(
  slug: slug,
  name: name,
  wikidataId: 'Q1',
  verified: true,
  biography: Biography(
    profession: 'Actor',
    summary: 'A performer.',
    background: 'Background.',
    notableWorks: const ['Film A'],
    controversies: controversies,
  ),
  sentimentData: SentimentData(
    overallScore: 70,
    positiveRatio: 0.5,
    negativeRatio: 0.2,
    neutralRatio: 0.3,
    trendDirection: 'up',
    explanation: 'Coverage skews positive.',
    trendData: trend,
    dominantEmotion: 'admiration',
    confidence: 0.6,
    confidenceLabel: 'Moderate confidence',
    scoreLow: 60,
    scoreHigh: 80,
    sampleSize: 12,
  ),
  mediaItems: const [],
  fetchedAt: DateTime.now(),
);

Controversy episode(String category, int severity) => Controversy(
  title: 't',
  summary: 's',
  category: category,
  severity: severity,
  status: ControversyStatus.resolved,
);

/// Pumps the screen with two figures already added.
Future<void> pumpWith(
  WidgetTester tester,
  Map<String, Celebrity> bySlug,
) async {
  // A generous surface: the screen stacks a chart, bars, a radar and a
  // pair list, and a cramped one fails on layout rather than on the
  // behaviour under test.
  tester.view.physicalSize = const Size(1200, 3600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardProvider.overrideWith((ref, slug) async {
          final celeb = bySlug[slug];
          if (celeb == null) throw StateError('no fixture for $slug');
          return celeb;
        }),
      ],
      child: const MaterialApp(home: CompareScreen()),
    ),
  );

  for (final celeb in bySlug.values) {
    await tester.enterText(find.byType(TextField).first, celeb.name);
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
  }
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('refuses to report a correlation from two shared days', (
    tester,
  ) async {
    // Pearson's r over two points is always exactly ±1, so the old matrix
    // announced "Strongly moving together" from the thinnest possible
    // overlap. This is the regression guard for that.
    await pumpWith(tester, {
      'ada-north': figure(
        slug: 'ada-north',
        name: 'Ada North',
        trend: [
          snap(daysAgo(4), 40),
          snap(daysAgo(3), 45),
          snap(daysAgo(2), 50),
          snap(daysAgo(1), 55),
          snap(daysAgo(0), 60),
        ],
      ),
      'bo-vance': figure(
        slug: 'bo-vance',
        name: 'Bo Vance',
        trend: [snap(daysAgo(1), 20), snap(daysAgo(0), 90)],
      ),
    });

    expect(find.text('Who moved together'), findsOneWidget);
    expect(find.textContaining('Not enough overlapping days'), findsOneWidget);
    expect(find.textContaining('needs 1 more'), findsOneWidget);
    // No coefficient is shown at all, rather than a misleading one.
    expect(find.textContaining('r = 1.00'), findsNothing);
    expect(find.textContaining('r = -1.00'), findsNothing);
  });

  testWidgets('reports a correlation once three days are shared', (
    tester,
  ) async {
    await pumpWith(tester, {
      'ada-north': figure(
        slug: 'ada-north',
        name: 'Ada North',
        trend: [
          snap(daysAgo(2), 10),
          snap(daysAgo(1), 20),
          snap(daysAgo(0), 30),
        ],
      ),
      'bo-vance': figure(
        slug: 'bo-vance',
        name: 'Bo Vance',
        trend: [
          snap(daysAgo(2), 30),
          snap(daysAgo(1), 20),
          snap(daysAgo(0), 10),
        ],
      ),
    });

    // A perfect inverse: a strong divergence is as much a finding as a
    // strong agreement, and the label has to say which.
    expect(find.textContaining('r = -1.00'), findsOneWidget);
    expect(find.textContaining('diverging'), findsOneWidget);
    expect(find.textContaining('3 shared days'), findsOneWidget);
  });

  testWidgets('offers every window and narrows the data when one is picked', (
    tester,
  ) async {
    await pumpWith(tester, {
      'ada-north': figure(
        slug: 'ada-north',
        name: 'Ada North',
        trend: [
          snap(daysAgo(20), 10),
          snap(daysAgo(19), 20),
          snap(daysAgo(18), 30),
        ],
      ),
      'bo-vance': figure(
        slug: 'bo-vance',
        name: 'Bo Vance',
        trend: [
          snap(daysAgo(20), 30),
          snap(daysAgo(19), 20),
          snap(daysAgo(18), 10),
        ],
      ),
    });

    expect(find.text('Last 7 days'), findsOneWidget);
    expect(find.text('Last 30 days'), findsOneWidget);
    expect(find.text('All time'), findsOneWidget);

    // Inside the default 30-day window these three shared days report.
    expect(find.textContaining('3 shared days'), findsOneWidget);

    // Narrowing to a week puts all of them out of range, and the screen
    // has to say so rather than render an empty chart.
    await tester.tap(find.text('Last 7 days'));
    await tester.pumpAndSettle();

    expect(find.textContaining('3 shared days'), findsNothing);
    expect(find.textContaining('No snapshots in last 7 days'), findsOneWidget);
  });

  testWidgets('profiles controversy categories by share, not volume', (
    tester,
  ) async {
    await pumpWith(tester, {
      'ada-north': figure(
        slug: 'ada-north',
        name: 'Ada North',
        trend: [snap(daysAgo(1), 50), snap(daysAgo(0), 55)],
        controversies: [
          episode(ControversyCategory.legal, 5),
          episode(ControversyCategory.political, 2),
        ],
      ),
      'bo-vance': figure(
        slug: 'bo-vance',
        name: 'Bo Vance',
        trend: [snap(daysAgo(1), 40), snap(daysAgo(0), 42)],
        controversies: [episode(ControversyCategory.financial, 3)],
      ),
    });

    expect(find.text('Category profile'), findsOneWidget);

    // Spoke labels are painted onto the canvas rather than built as Text
    // widgets, so the data reaching the chart is asserted directly --
    // which is the part that could actually be wrong.
    final radar = tester.widget<RadarChart>(find.byType(RadarChart));
    final sets = radar.data.dataSets;
    expect(sets.length, 2);

    final legal = ControversyCategory.all.indexOf(ControversyCategory.legal);
    final political = ControversyCategory.all.indexOf(
      ControversyCategory.political,
    );
    final financial = ControversyCategory.all.indexOf(
      ControversyCategory.financial,
    );

    // Ada: severity 5 legal and severity 2 political, so shares of 5/7
    // and 2/7 -- severity-weighted, not one-episode-one-vote.
    expect(sets[0].dataEntries[legal].value, closeTo(5 / 7, 1e-9));
    expect(sets[0].dataEntries[political].value, closeTo(2 / 7, 1e-9));

    // Bo has a single episode, so it is his whole profile. Shares, not
    // totals: his one severity-3 record must not read as smaller than
    // Ada's severity-5 one, because this chart answers "what kind of
    // trouble", and "how much" is the bars above.
    expect(sets[1].dataEntries[financial].value, closeTo(1.0, 1e-9));
    expect(sets[1].dataEntries[legal].value, 0);

    // Every category is a spoke, including the empty ones, so the shape
    // is comparable between figures.
    for (final set in sets) {
      expect(set.dataEntries.length, ControversyCategory.all.length);
    }
  });

  testWidgets('says so plainly when there is nothing to profile', (
    tester,
  ) async {
    await pumpWith(tester, {
      'ada-north': figure(
        slug: 'ada-north',
        name: 'Ada North',
        trend: [snap(daysAgo(0), 50)],
      ),
      'bo-vance': figure(
        slug: 'bo-vance',
        name: 'Bo Vance',
        trend: [snap(daysAgo(0), 40)],
      ),
    });

    // Every share is zero here, which is both meaningless to draw and a
    // division by zero waiting to happen inside the chart.
    expect(
      find.textContaining('No documented episodes to profile'),
      findsOneWidget,
    );
  });
}
