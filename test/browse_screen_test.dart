// Smoke tests for the category browse screens.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/data/catalog.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/browse/presentation/screens/categories_screen.dart';
import 'package:crititrack/features/browse/presentation/screens/category_detail_screen.dart';

Widget _wrap(Widget child) => MaterialApp(
      theme: AppTheme.darkTheme,
      home: Scaffold(body: child),
    );

void main() {
  testWidgets('CategoriesScreen lists the categories', (tester) async {
    await tester.pumpWidget(_wrap(const CategoriesScreen()));
    await tester.pumpAndSettle();

    expect(find.text('Browse by category'), findsOneWidget);
    expect(find.text('Actors'), findsOneWidget);

    // The last card is below the fold; scroll it into view.
    await tester.scrollUntilVisible(find.text('Creators'), 200);
    expect(find.text('Creators'), findsOneWidget);
  });

  testWidgets('CategoryDetailScreen shows a Top 10 and opens the filter sheet',
      (tester) async {
    await tester.pumpWidget(_wrap(const CategoryDetailScreen(slug: 'athletes')));
    await tester.pumpAndSettle();

    expect(find.text('Top 10'), findsOneWidget);
    // The first prominence entry for athletes.
    expect(
      find.text(CatalogAdapter.topTen('athletes').first.name),
      findsWidgets,
    );

    await tester.tap(find.byIcon(Icons.tune).first);
    await tester.pumpAndSettle();
    expect(find.text('Born'), findsOneWidget);
    expect(find.text('Sort'), findsOneWidget);
  });

  testWidgets('an unknown category renders a graceful message', (tester) async {
    await tester.pumpWidget(_wrap(const CategoryDetailScreen(slug: 'nope')));
    await tester.pumpAndSettle();
    expect(find.text('Unknown category.'), findsOneWidget);
  });
}
