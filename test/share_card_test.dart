// Share cards: the card renders its own context, and the renderer really
// produces a PNG at the intended size.
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/features/share/data/card_renderer.dart';
import 'package:crititrack/features/share/presentation/widgets/share_card.dart';

Celebrity sample({
  List<Controversy> controversies = const [],
  String name = 'Jane Doe',
  double score = 71,
  bool withBand = true,
}) {
  return Celebrity(
    slug: 'jane-doe',
    name: name,
    verified: true,
    biography: Biography(
      profession: 'Actor and producer',
      summary: 'A performer.',
      background: 'Background.',
      notableWorks: const ['Film A'],
      controversies: controversies,
    ),
    sentimentData: SentimentData(
      overallScore: score,
      positiveRatio: 0.5,
      negativeRatio: 0.2,
      neutralRatio: 0.3,
      trendDirection: 'up',
      explanation: 'Coverage skews positive.',
      trendData: const [],
      dominantEmotion: 'admiration',
      confidence: withBand ? 0.62 : null,
      confidenceLabel: withBand ? 'Moderate confidence' : null,
      scoreLow: withBand ? 63 : null,
      scoreHigh: withBand ? 79 : null,
      sampleSize: withBand ? 12 : null,
    ),
    mediaItems: const [],
    fetchedAt: DateTime.utc(2026, 8, 28, 12),
  );
}

Controversy controversy(String title, int severity, {int? year}) {
  return Controversy(
    title: title,
    summary: 'A summary.',
    category: ControversyCategory.legal,
    severity: severity,
    status: ControversyStatus.resolved,
    year: year,
    sources: const ['Variety'],
  );
}

Widget host(Widget child) => MaterialApp(home: Scaffold(body: child));

void main() {
  group('ShareCard content', () {
    testWidgets('carries the name, both headline numbers and provenance', (
      tester,
    ) async {
      await tester.pumpWidget(host(ShareCard(celebrity: sample())));

      expect(find.text('Jane Doe'), findsOneWidget);
      expect(find.text('71'), findsOneWidget, reason: 'sentiment score');
      expect(find.text('CritiTrack'), findsOneWidget);
      expect(
        find.textContaining('Algorithmically assessed'),
        findsOneWidget,
        reason:
            'the disclaimer must travel with the image, not sit behind '
            'a tap in an app the viewer may never open',
      );
    });

    testWidgets('shows the confidence band rather than a bare score', (
      tester,
    ) async {
      await tester.pumpWidget(host(ShareCard(celebrity: sample())));
      expect(find.textContaining('likely 63'), findsOneWidget);
    });

    testWidgets('falls back to a label when there is no band', (tester) async {
      await tester.pumpWidget(
        host(ShareCard(celebrity: sample(withBand: false))),
      );
      expect(find.textContaining('likely'), findsNothing);
      expect(find.text('CritiTrack'), findsOneWidget);
    });

    testWidgets('states plainly when nothing was found', (tester) async {
      await tester.pumpWidget(host(ShareCard(celebrity: sample())));
      expect(find.text('NO DOCUMENTED CONTROVERSIES'), findsOneWidget);
      expect(
        find.textContaining('No significant, well-documented episodes'),
        findsOneWidget,
      );
    });

    testWidgets('lists episodes worst-first and counts the remainder', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          ShareCard(
            celebrity: sample(
              controversies: [
                controversy('Minor remark', 1, year: 2019),
                controversy('Serious lawsuit', 5, year: 2025),
                controversy('Contract dispute', 3, year: 2022),
                controversy('Another small thing', 2),
                controversy('One more', 2),
              ],
            ),
          ),
        ),
      );

      expect(find.text('5 EPISODES TRACKED'), findsOneWidget);
      // Worst three only; the card points at the record, it is not a
      // replacement for it.
      expect(find.text('Serious lawsuit'), findsOneWidget);
      expect(find.text('Contract dispute'), findsOneWidget);
      expect(find.text('Minor remark'), findsNothing);
      expect(find.text('+2 more in the app'), findsOneWidget);
    });

    testWidgets('singular wording for a single episode', (tester) async {
      await tester.pumpWidget(
        host(
          ShareCard(
            celebrity: sample(controversies: [controversy('Only one', 3)]),
          ),
        ),
      );
      expect(find.text('1 EPISODE TRACKED'), findsOneWidget);
    });

    testWidgets('a long name does not overflow the fixed layout', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          ShareCard(
            celebrity: sample(
              name: 'A Very Considerably Overlong Public Figure Name Indeed',
              controversies: [
                controversy(
                  'An extremely long controversy headline that keeps going '
                  'well past any reasonable length',
                  4,
                  year: 2024,
                ),
              ],
            ),
          ),
        ),
      );

      // The card is exported at a fixed size, so an overflow here would
      // ship as a visible yellow-and-black stripe in the shared image.
      expect(tester.takeException(), isNull);
    });
  });

  group('ShareCardRenderer.capture', () {
    testWidgets('produces a real PNG at the intended pixel size', (
      tester,
    ) async {
      // The boundary is mounted directly rather than through render(),
      // which mounts it in an overlay and awaits frames — a widget test
      // cannot pump those while awaiting the call. This exercises the half
      // where anything can actually go wrong: the encode.
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: RepaintBoundary(
                key: key,
                child: ShareCard(celebrity: sample()),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;

      late final Uint8List? bytes;
      await tester.runAsync(() async {
        bytes = await ShareCardRenderer.capture(boundary);
      });

      expect(bytes, isNotNull);
      expect(bytes!.length, greaterThan(1000));

      // PNG magic number — proves it is really an image, not just bytes.
      expect(bytes!.sublist(0, 8), [137, 80, 78, 71, 13, 10, 26, 10]);

      // Dimensions are big-endian at offsets 16 and 20 of the IHDR chunk.
      int readInt(int offset) =>
          (bytes![offset] << 24) |
          (bytes![offset + 1] << 16) |
          (bytes![offset + 2] << 8) |
          bytes![offset + 3];

      expect(
        readInt(16),
        (shareCardSize.width * ShareCardRenderer.pixelRatio).round(),
        reason: 'exported width must not depend on the device',
      );
      expect(
        readInt(20),
        (shareCardSize.height * ShareCardRenderer.pixelRatio).round(),
      );
    });
  });
}
