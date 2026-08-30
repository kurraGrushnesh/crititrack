// F03: "No record reaches the UI without a source", and the ordering the
// timeline offers.
//
// The citation gate that enforces the first half lives on the server and
// is tested in functions/test/groq.sanitize.test.js. What is tested here
// is what the app does with the sources that survive it: shows them, and
// makes the ones that are links openable — through SafeUrl, because these
// strings came from a model.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_card.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_section.dart';

Controversy episode({
  String title = 'Contract dispute',
  int severity = 3,
  int? year = 2021,
  String status = ControversyStatus.resolved,
  List<String> sources = const ['Variety'],
}) => Controversy(
  title: title,
  summary: 'A disagreement that continued for months.',
  category: ControversyCategory.legal,
  severity: severity,
  status: status,
  year: year,
  sources: sources,
);

Future<void> pumpCard(WidgetTester tester, Controversy c) async {
  tester.view.physicalSize = const Size(900, 1600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: Scaffold(
        body: SingleChildScrollView(child: ControversyCard(controversy: c)),
      ),
    ),
  );

  // Sources live in the expanded body.
  await tester.tap(find.text(c.title));
  await tester.pumpAndSettle();
}

Future<void> pumpSection(
  WidgetTester tester,
  List<Controversy> controversies,
) async {
  tester.view.physicalSize = const Size(900, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.darkTheme,
      home: Scaffold(
        body: SingleChildScrollView(
          child: ControversySection(
            controversies: controversies,
            name: 'Jane Doe',
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Titles in the order the timeline currently lists them.
List<String> orderOf(WidgetTester tester, List<String> titles) {
  final positions = <String, double>{
    for (final t in titles) t: tester.getTopLeft(find.text(t)).dy,
  };
  return titles.toList()
    ..sort((a, b) => positions[a]!.compareTo(positions[b]!));
}

/// Whether the source chip carrying [label] is offered as a link.
///
/// Asserted on the chip's own icon rather than on an InkWell ancestor:
/// the whole card is wrapped in one for expand/collapse, so every chip
/// has an InkWell above it whether or not it is itself tappable.
bool isLinked(WidgetTester tester, String label) {
  final row =
      find.ancestor(of: find.text(label), matching: find.byType(Row)).first;
  final icon = tester.widget<Icon>(
    find.descendant(of: row, matching: find.byType(Icon)).first,
  );
  return icon.icon == Icons.link_rounded;
}

void main() {
  group('source chips', () {
    testWidgets('shows a publication name as a plain label', (tester) async {
      await pumpCard(tester, episode(sources: const ['Variety']));

      expect(find.text('SOURCES'), findsOneWidget);
      expect(find.text('Variety'), findsOneWidget);
      // Nothing to open, so nothing pretends to be openable.
      expect(isLinked(tester, 'Variety'), isFalse);
    });

    testWidgets('shows a URL by its host and makes it tappable', (
      tester,
    ) async {
      await pumpCard(
        tester,
        episode(sources: const ['https://www.reuters.com/article/12345']),
      );

      // The host, not the full URL — a chip is not the place for a
      // tracking-parameter-laden path.
      expect(find.text('reuters.com'), findsOneWidget);
      expect(isLinked(tester, 'reuters.com'), isTrue);
    });

    testWidgets('refuses to linkify a non-https scheme', (tester) async {
      // SEC-06. These strings come from a model, so a javascript: or
      // file: source is exactly what must never reach a launcher.
      await pumpCard(
        tester,
        episode(
          sources: const [
            'javascript:alert(1)',
            'file:///etc/passwd',
            'http://insecure.example.com',
          ],
        ),
      );

      for (final raw in [
        'javascript:alert(1)',
        'file:///etc/passwd',
        'http://insecure.example.com',
      ]) {
        expect(find.text(raw), findsOneWidget, reason: raw);
        expect(isLinked(tester, raw), isFalse, reason: '$raw must be inert');
      }
    });

    testWidgets('shows every source, linkable or not', (tester) async {
      // The gate requires a source to be named, not to be linkable.
      // Hiding the unlinkable ones would misrepresent what backs a record.
      await pumpCard(
        tester,
        episode(sources: const ['Variety', 'https://www.bbc.co.uk/news/1']),
      );

      expect(find.text('Variety'), findsOneWidget);
      expect(find.text('bbc.co.uk'), findsOneWidget);
      expect(isLinked(tester, 'Variety'), isFalse);
      expect(isLinked(tester, 'bbc.co.uk'), isTrue);
    });
  });

  group('timeline ordering', () {
    final recentMinor = episode(title: 'Recent minor', severity: 1, year: 2024);
    final oldSevere = episode(title: 'Old severe', severity: 5, year: 2015);
    final undated = episode(title: 'Undated', severity: 3, year: null);

    testWidgets('defaults to most serious first', (tester) async {
      await pumpSection(tester, [recentMinor, oldSevere, undated]);

      expect(orderOf(tester, ['Old severe', 'Undated', 'Recent minor']), [
        'Old severe',
        'Undated',
        'Recent minor',
      ]);
    });

    testWidgets('switches to newest first', (tester) async {
      await pumpSection(tester, [recentMinor, oldSevere, undated]);

      await tester.tap(find.text('By date'));
      await tester.pumpAndSettle();

      // Severity ordering actively obscures how a record built up over
      // time, which is the question this ordering answers.
      final order = orderOf(tester, ['Recent minor', 'Old severe', 'Undated']);
      expect(order.first, 'Recent minor');
      expect(order[1], 'Old severe');
    });

    testWidgets('puts undated episodes last and says so', (tester) async {
      await pumpSection(tester, [recentMinor, oldSevere, undated]);

      await tester.tap(find.text('By date'));
      await tester.pumpAndSettle();

      // Not sorted as year zero: an unrecorded year is unknown, not
      // ancient.
      expect(
        orderOf(tester, ['Recent minor', 'Old severe', 'Undated']).last,
        'Undated',
      );
      expect(
        find.textContaining('no recorded year are listed last'),
        findsOneWidget,
      );
    });

    testWidgets('offers no ordering for a single episode', (tester) async {
      await pumpSection(tester, [oldSevere]);

      expect(find.text('By date'), findsNothing);
      expect(find.text('Most serious'), findsNothing);
    });

    testWidgets('the ordering can be switched back', (tester) async {
      await pumpSection(tester, [recentMinor, oldSevere, undated]);

      await tester.tap(find.text('By date'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Most serious'));
      await tester.pumpAndSettle();

      expect(
        orderOf(tester, ['Old severe', 'Recent minor']).first,
        'Old severe',
      );
    });
  });
}
