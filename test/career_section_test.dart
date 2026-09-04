// Widget tests for the mobile Career section.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/career_section.dart';

Widget _host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

PersonFacts _facts(
  List<Map<String, Object?>> rows, {
  List<String> orgs = const [],
}) => PersonFacts.fromMap({'career': rows, 'organizations': orgs});

void main() {
  testWidgets('empty state uses the exact spec copy', (tester) async {
    await tester.pumpWidget(_host(CareerSection(facts: PersonFacts.empty)));

    expect(
      find.text("Career information isn't available yet."),
      findsOneWidget,
    );
  });

  testWidgets('renders the timeline and keeps it compact by default', (
    tester,
  ) async {
    final facts = _facts([
      for (var y = 2000; y <= 2012; y += 2)
        {'role': 'Role $y', 'organization': 'Org $y', 'start': y, 'end': y + 2},
    ]);

    await tester.pumpWidget(_host(CareerSection(facts: facts)));

    // 7 rows, only the first 4 shown until "Show all".
    expect(find.text('Role 2000'), findsOneWidget);
    expect(find.text('Role 2012'), findsNothing);
    expect(find.text('Show all 7 roles'), findsOneWidget);

    await tester.tap(find.text('Show all 7 roles'));
    await tester.pumpAndSettle();
    expect(find.text('Role 2012'), findsOneWidget);
    expect(find.text('Show less'), findsOneWidget);
  });

  testWidgets('tapping a role opens the detail bottom sheet with a source', (
    tester,
  ) async {
    final facts = _facts([
      {
        'role': 'Chief Executive Officer',
        'organization': 'Firm C',
        'start': 2021,
        'end': null,
        'location': 'London',
        'source': {
          'name': 'Wikidata',
          'url': 'https://www.wikidata.org/wiki/Q42',
        },
      },
    ]);

    await tester.pumpWidget(_host(CareerSection(facts: facts)));

    await tester.tap(find.text('Chief Executive Officer').first);
    await tester.pumpAndSettle();

    // Sheet content.
    expect(find.text('ORGANIZATION'), findsOneWidget);
    expect(find.text('London'), findsOneWidget);
    expect(find.textContaining('View source'), findsOneWidget);
    expect(find.byTooltip('Close'), findsOneWidget);
  });

  testWidgets('a source-less row shows a non-actionable source label', (
    tester,
  ) async {
    final facts = _facts([
      {'role': 'Reporter', 'organization': 'Paper', 'start': 1999},
    ]);

    await tester.pumpWidget(_host(CareerSection(facts: facts)));
    await tester.tap(find.text('Reporter'));
    await tester.pumpAndSettle();

    expect(find.text('Source: Wikidata'), findsOneWidget);
  });
}
