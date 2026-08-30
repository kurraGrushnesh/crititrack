// F01's second acceptance criterion: "an ambiguous name presents a
// chooser rather than guessing."
//
// The backend takes the top-ranked human from Wikidata's search, which is
// a guess. These tests pin that the guess is stated, the alternatives are
// offered, and choosing one pins the lookup by id rather than by label.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/disambiguation_bar.dart';

const footballer = EntityCandidate(
  qid: 'Q1928176',
  label: 'Michael Jordan',
  description: 'English footballer',
);

const professor = EntityCandidate(
  qid: 'Q92466',
  label: 'Michael I. Jordan',
  description: 'American computer scientist',
);

Future<ProviderContainer> pumpBar(
  WidgetTester tester, {
  required List<EntityCandidate> candidates,
}) async {
  final container = ProviderContainer();
  addTearDown(container.dispose);

  tester.view.physicalSize = const Size(900, 1200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: Scaffold(
          body: SingleChildScrollView(
            child: DisambiguationBar(
              slug: 'michael-jordan',
              resolvedName: 'Michael Jordan',
              resolvedDescription: 'American basketball player',
              candidates: candidates,
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pump();

  return container;
}

/// Whether the chip carrying [text] is drawn in its selected state.
bool chipIsSelected(WidgetTester tester, String text) {
  final container = tester.widget<Container>(
    find.ancestor(of: find.text(text), matching: find.byType(Container)).first,
  );
  final border = (container.decoration! as BoxDecoration).border! as Border;
  return border.top.color == AppTheme.primary;
}

void main() {
  testWidgets('states which person was chosen', (tester) async {
    await pumpBar(tester, candidates: const [footballer, professor]);

    // The pick is shown rather than left implicit.
    expect(find.textContaining('Showing Michael Jordan'), findsOneWidget);
    expect(find.textContaining('American basketball player'), findsOneWidget);
  });

  testWidgets('offers every other person the name matched', (tester) async {
    await pumpBar(tester, candidates: const [footballer, professor]);

    expect(find.textContaining('also matches'), findsOneWidget);
    expect(find.text('English footballer'), findsOneWidget);
    expect(find.text('Michael I. Jordan'), findsOneWidget);
    expect(find.text('American computer scientist'), findsOneWidget);
  });

  testWidgets('renders nothing when the name was unambiguous', (tester) async {
    // No alternatives and no pin: there is no choice to present, and a bar
    // saying so would be noise on every profile.
    await pumpBar(tester, candidates: const []);

    expect(find.textContaining('Showing'), findsNothing);
    expect(find.byType(SizedBox), findsWidgets);
  });

  testWidgets('choosing an alternative pins it by Wikidata id', (tester) async {
    // By id, not by label — searching the label again would be circular,
    // because two people can share a label exactly.
    final container = await pumpBar(
      tester,
      candidates: const [footballer, professor],
    );

    expect(container.read(pinnedEntityProvider), isEmpty);

    await tester.tap(find.text('Michael I. Jordan'));
    await tester.pump();

    expect(container.read(pinnedEntityProvider), {'michael-jordan': 'Q92466'});
  });

  testWidgets('the pinned choice is marked as selected', (tester) async {
    await pumpBar(tester, candidates: const [footballer, professor]);

    expect(chipIsSelected(tester, 'English footballer'), isFalse);

    await tester.tap(find.text('English footballer'));
    await tester.pump();

    // Asserted on what is drawn rather than on the Semantics node: the
    // framework injects its own Semantics ancestors around InkWell, so
    // the nearest one is not necessarily ours.
    expect(chipIsSelected(tester, 'English footballer'), isTrue);
    expect(chipIsSelected(tester, 'American computer scientist'), isFalse);
  });

  testWidgets('the choice can be undone', (tester) async {
    // A reader who picks the wrong alternative must be able to get back
    // to the automatic pick without retyping the search.
    final container = await pumpBar(
      tester,
      candidates: const [footballer, professor],
    );

    await tester.tap(find.text('English footballer'));
    await tester.pump();
    expect(container.read(pinnedEntityProvider), isNotEmpty);

    await tester.tap(find.text('Use the best match instead'));
    await tester.pump();

    expect(container.read(pinnedEntityProvider), isEmpty);
  });

  testWidgets('only one slug is affected by a pin', (tester) async {
    final container = await pumpBar(tester, candidates: const [professor]);
    container.read(pinnedEntityProvider.notifier).state = {
      'someone-else': 'Q1',
    };
    await tester.pump();

    await tester.tap(find.text('Michael I. Jordan'));
    await tester.pump();

    expect(container.read(pinnedEntityProvider), {
      'someone-else': 'Q1',
      'michael-jordan': 'Q92466',
    });
  });
}
