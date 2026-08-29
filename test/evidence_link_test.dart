// F05's acceptance criterion, end to end in the widget tree:
// "Tapping an evidence fragment in the sentiment panel scrolls to and
// highlights its source article."
//
// The two halves are separate widgets that know nothing about each other,
// so this is the only place the whole path is exercised: a fragment
// carrying a mediaId, through the focus controller, to a highlighted row
// in the feed.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/evidence_panel.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/media_feed_section.dart';

MediaItem article(String id, String title, {int? score, String? tag}) =>
    MediaItem(
      id: id,
      type: MediaType.news,
      title: title,
      url: 'https://example.com/$id',
      source: 'The Example',
      publishedAt: DateTime.now().subtract(const Duration(hours: 3)),
      sentimentScore: score,
      sentimentTag: tag,
    );

MediaItem video(String id, String title) => MediaItem(
  id: id,
  type: MediaType.youtube,
  title: title,
  url: 'https://example.com/$id',
  source: 'A Channel',
  publishedAt: DateTime.now().subtract(const Duration(hours: 5)),
);

final linked = const SentimentEvidence(
  fragment: 'lengthy legal dispute over creative control',
  source: 'news',
  mediaId: 'n1',
);

final unlinked = const SentimentEvidence(
  fragment: 'commentators remained divided',
  source: 'news',
);

Future<void> pump(
  WidgetTester tester, {
  required List<SentimentEvidence> evidence,
  required List<MediaItem> items,
}) async {
  tester.view.physicalSize = const Size(1000, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        home: Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: EvidencePanel(evidence: evidence)),
              SliverToBoxAdapter(
                child: MediaFeedSection(mediaItems: items, slug: 'x'),
              ),
            ],
          ),
        ),
      ),
    ),
  );

  // The panel ships collapsed, so the fragments are not reachable until
  // its header is tapped.
  await tester.tap(find.text('What the model pointed to'));
  await tester.pumpAndSettle();
}

/// Whether the feed row carrying [title] is drawn in its highlighted
/// state — a thicker, accented border.
bool highlighted(WidgetTester tester, String title) {
  final container = tester.widget<AnimatedContainer>(
    find
        .ancestor(
          of: find.text(title),
          matching: find.byType(AnimatedContainer),
        )
        .first,
  );
  final border = (container.decoration! as BoxDecoration).border! as Border;
  return border.top.width > 1;
}

void main() {
  const cited = 'Studio confirms lengthy legal dispute over creative control';
  const other = 'Charity gala raises record sum';

  testWidgets('tapping a linked fragment highlights its source article', (
    tester,
  ) async {
    await pump(
      tester,
      evidence: [linked],
      items: [article('n1', cited), article('n2', other)],
    );

    expect(highlighted(tester, cited), isFalse);

    await tester.tap(find.text('"${linked.fragment}"'));
    await tester.pumpAndSettle();

    expect(highlighted(tester, cited), isTrue);
    // Only the cited one: a highlight on everything points at nothing.
    expect(highlighted(tester, other), isFalse);
  });

  testWidgets('the highlight clears itself rather than becoming a selection', (
    tester,
  ) async {
    await pump(
      tester,
      evidence: [linked],
      items: [article('n1', cited), article('n2', other)],
    );

    await tester.tap(find.text('"${linked.fragment}"'));
    await tester.pumpAndSettle();
    expect(highlighted(tester, cited), isTrue);

    // It is a pointer, not state the user has to dismiss.
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(highlighted(tester, cited), isFalse);
  });

  testWidgets('a fragment that matched nothing is not offered as a link', (
    tester,
  ) async {
    await pump(
      tester,
      evidence: [unlinked],
      items: [article('n1', cited), article('n2', other)],
    );

    // No InkWell wraps it, so there is nothing to tap. Rendering it as
    // tappable and doing nothing would be worse than rendering it plain.
    expect(
      find.ancestor(
        of: find.textContaining('commentators remained divided'),
        matching: find.byType(InkWell),
      ),
      findsNothing,
    );
    expect(highlighted(tester, cited), isFalse);
  });

  testWidgets('an active type filter gives way to the cited article', (
    tester,
  ) async {
    await pump(
      tester,
      evidence: [linked],
      items: [article('n1', cited), video('y1', 'An interview')],
    );

    // Filter down to video, which hides the cited article entirely.
    await tester.tap(find.textContaining('Videos'));
    await tester.pumpAndSettle();
    expect(find.text(cited), findsNothing);

    await tester.tap(find.text('"${linked.fragment}"'));
    await tester.pumpAndSettle();

    // Scrolling to a row that is not being built would do nothing and
    // read as a dead link, so the filter yields to the more specific ask.
    expect(find.text(cited), findsOneWidget);
    expect(highlighted(tester, cited), isTrue);
  });

  testWidgets('a scored item shows its own sentiment, unscored ones do not', (
    tester,
  ) async {
    await pump(
      tester,
      evidence: [linked],
      items: [
        article('n1', cited, score: 31, tag: 'negative'),
        article('n2', other),
      ],
    );

    // The number is shown, not just a colour — a coloured dot alone is
    // unreadable to anyone with a colour vision deficiency.
    expect(find.text('31'), findsOneWidget);

    // The unscored item renders without a chip rather than as neutral:
    // neutral is a measurement, and absence is not.
    expect(find.text('50'), findsNothing);
  });
}
