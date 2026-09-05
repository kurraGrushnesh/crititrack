// Widget tests for the mobile Recent Changes card and history sheet.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/recent_changes_card.dart';

Celebrity celebrity({List<Controversy> controversies = const []}) => Celebrity(
  slug: 'jane-doe',
  name: 'Jane Doe',
  biography: Biography(
    profession: 'Executive',
    summary: 'Jane Doe is an executive.',
    background: '',
    notableWorks: const [],
    controversies: controversies,
  ),
  sentimentData: SentimentData(
    overallScore: 50,
    positiveRatio: 0.3,
    negativeRatio: 0.3,
    neutralRatio: 0.4,
    trendDirection: 'stable',
    explanation: '',
    trendData: const [],
    dominantEmotion: 'neutral',
  ),
  mediaItems: const [],
  fetchedAt: DateTime.utc(2026, 9, 5),
  facts: PersonFacts.empty,
);

class _FakeRepo extends CelebrityRepository {
  _FakeRepo(this.previous);
  final Celebrity? previous;

  @override
  Future<Celebrity?> previousSnapshot(String name) async => previous;
}

Widget host(Widget child, CelebrityRepository repo) => ProviderScope(
  overrides: [celebrityRepositoryProvider.overrideWithValue(repo)],
  child: MaterialApp(
    theme: AppTheme.darkTheme,
    home: Scaffold(body: SingleChildScrollView(child: child)),
  ),
);

void main() {
  testWidgets('no previous snapshot -> renders nothing, never fabricates a change', (
    tester,
  ) async {
    await tester.pumpWidget(host(RecentChangesCard(celebrity: celebrity()), _FakeRepo(null)));
    await tester.pump();
    expect(find.text('Recent Changes'), findsNothing);
  });

  testWidgets('a new controversy since the previous snapshot shows on the card', (
    tester,
  ) async {
    final controversy = Controversy(
      title: 'Fraud allegations',
      summary: 'The executive was accused of misrepresenting finances.',
      category: ControversyCategory.financial,
      severity: 4,
      status: ControversyStatus.ongoing,
      year: 2024,
      sources: const ['https://reuters.com/1'],
    );
    final previous = celebrity(controversies: const []);
    final current = celebrity(controversies: [controversy]);

    await tester.pumpWidget(host(RecentChangesCard(celebrity: current), _FakeRepo(previous)));
    await tester.pump();

    expect(find.text('Recent Changes'), findsOneWidget);
    expect(find.textContaining('New supported controversy'), findsOneWidget);

    await tester.tap(find.text('View all changes'));
    await tester.pumpAndSettle();
    expect(find.text('Change History'), findsOneWidget);
  });
}
