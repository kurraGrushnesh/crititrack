// Widget tests for the mobile Evidence & Source Explorer.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/evidence_section.dart';

Widget host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets('shows the honest empty state with nothing retrieved', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const EvidenceSection(
          media: [],
          controversies: [],
          career: [],
          sentimentEvidence: [],
        ),
      ),
    );

    expect(find.text('No supporting source found.'), findsOneWidget);
  });

  testWidgets('opens the explorer sheet with a real source card', (
    tester,
  ) async {
    final media = [
      MediaItem(
        id: 'm1',
        type: MediaType.news,
        title: 'Star faces new allegations',
        url: 'https://reuters.com/story',
        source: 'Reuters',
        independentSourceCount: 3,
      ),
    ];

    await tester.pumpWidget(
      host(
        EvidenceSection(
          media: media,
          controversies: const [],
          career: const [],
          sentimentEvidence: const [],
        ),
      ),
    );

    expect(find.text('Browse 1 evidence item'), findsOneWidget);
    await tester.tap(find.text('Browse 1 evidence item'));
    await tester.pumpAndSettle();

    expect(find.text('Star faces new allegations'), findsOneWidget);
    expect(find.text('Strong'), findsOneWidget);
    expect(find.text('Open source'), findsOneWidget);
  });

  testWidgets(
    'a controversy-linked item is filterable and shows conflict note',
    (tester) async {
      const controversies = [
        Controversy(
          title: 'New allegations',
          summary: 'Serious claims were reported.',
          category: ControversyCategory.legal,
          severity: 4,
          status: ControversyStatus.ongoing,
          year: 2024,
          sources: ['https://apnews.com/report'],
        ),
      ];
      final media = [
        MediaItem(
          id: 'm1',
          type: MediaType.news,
          title: 'Star faces new allegations',
          url: 'https://a.example/1',
          source: 'A',
          sentimentTag: 'negative',
        ),
        MediaItem(
          id: 'm2',
          type: MediaType.news,
          title: 'Star cleared of new allegations',
          url: 'https://b.example/2',
          source: 'B',
          sentimentTag: 'positive',
        ),
      ];

      await tester.pumpWidget(
        host(
          EvidenceSection(
            media: media,
            controversies: controversies,
            career: const [],
            sentimentEvidence: const [],
          ),
        ),
      );

      await tester.tap(find.textContaining('Browse'));
      await tester.pumpAndSettle();

      expect(find.textContaining('Conflicting evidence'), findsOneWidget);

      await tester.tap(find.text('Controversies'));
      await tester.pumpAndSettle();
      expect(find.text('Star faces new allegations'), findsOneWidget);
    },
  );
}
