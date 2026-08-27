// Widget tests for the Controversy Tracker dashboard section.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_section.dart';

Widget _host(Widget child) => MaterialApp(
  theme: AppTheme.darkTheme,
  home: Scaffold(body: SingleChildScrollView(child: child)),
);

void main() {
  testWidgets('empty state shows the reassuring message', (tester) async {
    await tester.pumpWidget(
      _host(const ControversySection(controversies: [], name: 'Jane Doe')),
    );

    expect(
      find.textContaining('No major documented controversies'),
      findsOneWidget,
    );
    expect(find.text('Controversy Tracker'), findsNothing);
  });

  testWidgets('populated state renders index, timeline and cards', (
    tester,
  ) async {
    const items = [
      Controversy(
        title: 'Tax filing dispute',
        summary: 'A disagreement over reported income, later settled.',
        category: ControversyCategory.financial,
        severity: 3,
        status: ControversyStatus.resolved,
        year: 2022,
      ),
      Controversy(
        title: 'Ongoing defamation suit',
        summary:
            'A lawsuit filed by a former associate is still before the courts.',
        category: ControversyCategory.legal,
        severity: 5,
        status: ControversyStatus.ongoing,
        year: 2025,
      ),
    ];

    await tester.pumpWidget(
      _host(const ControversySection(controversies: items, name: 'Jane Doe')),
    );

    expect(find.text('Controversy Tracker'), findsOneWidget);
    expect(find.textContaining('Timeline'), findsOneWidget);
    expect(find.text('Tax filing dispute'), findsOneWidget);
    expect(find.text('Ongoing defamation suit'), findsOneWidget);
    // The ongoing, higher-severity episode sorts above the resolved one.
    final ongoingY = tester.getTopLeft(find.text('Ongoing defamation suit')).dy;
    final resolvedY = tester.getTopLeft(find.text('Tax filing dispute')).dy;
    expect(ongoingY, lessThan(resolvedY));
  });

  testWidgets('tapping a card reveals its summary', (tester) async {
    const items = [
      Controversy(
        title: 'Award show remark',
        summary: 'A comment on stage drew criticism the following week.',
        category: ControversyCategory.socialMedia,
        severity: 2,
        status: ControversyStatus.historical,
        year: 2018,
      ),
    ];

    await tester.pumpWidget(
      _host(const ControversySection(controversies: items, name: 'Jane Doe')),
    );

    expect(find.textContaining('drew criticism'), findsNothing);
    await tester.tap(find.text('Award show remark'));
    await tester.pumpAndSettle();
    expect(find.textContaining('drew criticism'), findsOneWidget);
  });
}
