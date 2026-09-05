// Widget tests for the mobile Data Coverage & Confidence Center.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/data_coverage_card.dart';

Widget host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

Celebrity celebrity({
  String? wikidataId = 'Q1',
  bool verified = true,
  List<MediaItem> mediaItems = const [],
  int? sampleSize,
}) => Celebrity(
  slug: 'jane-doe',
  name: 'Jane Doe',
  wikidataId: wikidataId,
  verified: verified,
  biography: const Biography(
    profession: 'Executive',
    summary: 'Jane Doe is an executive.',
    background: '',
    notableWorks: [],
    controversies: [],
  ),
  sentimentData: SentimentData(
    overallScore: 40,
    positiveRatio: 0.2,
    negativeRatio: 0.5,
    neutralRatio: 0.3,
    trendDirection: 'down',
    explanation: '',
    trendData: const [],
    dominantEmotion: 'anger',
    sampleSize: sampleSize,
  ),
  mediaItems: mediaItems,
  fetchedAt: DateTime.utc(2024, 1, 1),
  facts: PersonFacts.empty,
);

void main() {
  testWidgets('shows the compact summary with dimension levels', (tester) async {
    await tester.pumpWidget(host(DataCoverageCard(celebrity: celebrity())));

    expect(find.text('Data Coverage'), findsOneWidget);
    expect(find.text('Entity Identity'), findsOneWidget);
    expect(find.text('HIGH'), findsWidgets);
    expect(find.text('UNAVAILABLE'), findsWidgets);
    expect(find.text('View data coverage'), findsOneWidget);
  });

  testWidgets('tapping the card opens the detail sheet with a limitations note', (
    tester,
  ) async {
    await tester.pumpWidget(host(DataCoverageCard(celebrity: celebrity())));

    await tester.tap(find.text('View data coverage'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Entity Identity').last);
    await tester.pumpAndSettle();
    expect(find.textContaining('Stable entity ID'), findsOneWidget);

    await tester.fling(find.byType(ListView), const Offset(0, -600), 2000);
    await tester.pumpAndSettle();

    expect(find.text('LIMITATIONS'), findsOneWidget);
    expect(find.textContaining('unavailable'), findsWidgets);
  });

  testWidgets('an unresolved profile shows UNAVAILABLE rather than fabricating a level', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(DataCoverageCard(celebrity: celebrity(wikidataId: null, verified: false))),
    );

    expect(find.text('UNAVAILABLE'), findsWidgets);
  });
}
