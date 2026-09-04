// Widget tests for the mobile Intelligence Timeline section.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/figure_timeline_section.dart';

Widget host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets('shows the empty state with nothing dated', (tester) async {
    await tester.pumpWidget(
      host(
        const FigureTimelineSection(
          controversies: [],
          mediaItems: [],
          career: [],
          trend: [],
        ),
      ),
    );

    expect(find.textContaining('fills in as controversies'), findsOneWidget);
  });

  testWidgets('renders a controversy event and opens its detail sheet', (
    tester,
  ) async {
    const controversies = [
      Controversy(
        title: 'Tax filing dispute',
        summary: 'A disagreement over reported income.',
        category: ControversyCategory.financial,
        severity: 4,
        status: ControversyStatus.ongoing,
        year: 2024,
        sources: ['https://reuters.com/story'],
      ),
    ];

    await tester.pumpWidget(
      host(
        const FigureTimelineSection(
          controversies: controversies,
          mediaItems: [],
          career: [],
          trend: [],
        ),
      ),
    );

    expect(find.text('Tax filing dispute'), findsOneWidget);

    await tester.tap(find.text('Tax filing dispute'));
    await tester.pumpAndSettle();

    expect(find.text('SEVERITY'), findsOneWidget);
    expect(find.text('4/5'), findsOneWidget);
    expect(find.byTooltip('Close'), findsOneWidget);
  });

  testWidgets('a single article does not appear on the timeline', (
    tester,
  ) async {
    final mediaItems = [
      MediaItem(
        id: '1',
        type: MediaType.news,
        title: 'Lone headline',
        url: 'https://a.example/1',
        source: 'AP',
        publishedAt: DateTime.utc(2026, 3, 12),
      ),
    ];

    await tester.pumpWidget(
      host(
        FigureTimelineSection(
          controversies: const [],
          mediaItems: mediaItems,
          career: const [],
          trend: const [],
        ),
      ),
    );

    expect(find.text('Lone headline'), findsNothing);
    expect(find.textContaining('fills in as controversies'), findsOneWidget);
  });

  testWidgets('filter chips only list kinds actually present', (tester) async {
    const career = [
      CareerEntry(
        role: 'Chief Executive Officer',
        organization: 'Firm C',
        start: 2018,
      ),
    ];

    await tester.pumpWidget(
      host(
        const FigureTimelineSection(
          controversies: [],
          mediaItems: [],
          career: career,
          trend: [],
        ),
      ),
    );

    expect(find.text('All'), findsOneWidget);
    expect(find.text('Career'), findsOneWidget);
    expect(find.text('News'), findsNothing);
    expect(find.text('Sentiment'), findsNothing);
  });
}
