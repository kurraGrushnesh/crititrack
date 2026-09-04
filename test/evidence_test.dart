// The Evidence & Source Explorer's normalisation, linking, deduplication
// awareness, and honesty rules: evidence must never be invented, and
// absence must read as absence.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/evidence.dart';

MediaItem media({
  String id = 'm1',
  String title = 'Star faces new allegations',
  String url = 'https://reuters.com/story',
  String? source = 'Reuters',
  int? duplicateCount,
  int? independentSourceCount,
  String? sentimentTag,
}) => MediaItem(
  id: id,
  type: MediaType.news,
  title: title,
  url: url,
  source: source,
  duplicateCount: duplicateCount,
  independentSourceCount: independentSourceCount,
  sentimentTag: sentimentTag,
);

Controversy controversy({
  String title = 'New allegations',
  int severity = 4,
  String status = ControversyStatus.ongoing,
  int? year = 2024,
  List<String> sources = const ['https://apnews.com/report'],
}) => Controversy(
  title: title,
  summary: 'Serious claims were reported against the figure.',
  category: ControversyCategory.legal,
  severity: severity,
  status: status,
  year: year,
  sources: sources,
);

CareerEntry career({String? sourceUrl = 'https://www.wikidata.org/wiki/Q1'}) =>
    CareerEntry(
      start: 2018,
      role: 'Chief Executive Officer',
      organization: 'Firm C',
      sourceName: 'Wikidata',
      sourceUrl: sourceUrl,
    );

List<EvidenceItem> build({
  List<MediaItem> media = const [],
  List<Controversy> controversies = const [],
  List<CareerEntry> career = const [],
  List<SentimentEvidence> sentimentEvidence = const [],
}) => buildEvidenceItems(
  media: media,
  controversies: controversies,
  career: career,
  sentimentEvidence: sentimentEvidence,
);

void main() {
  group('sourceTypeFor', () {
    test('classifies by host first', () {
      expect(
        sourceTypeFor(url: 'https://en.wikipedia.org/wiki/X'),
        SourceType.wikipedia,
      );
      expect(
        sourceTypeFor(url: 'https://www.wikidata.org/wiki/Q1'),
        SourceType.wikidata,
      );
      expect(
        sourceTypeFor(url: 'https://web.archive.org/web/x'),
        SourceType.archive,
      );
      expect(
        sourceTypeFor(url: 'https://sec.gov/filing'),
        SourceType.government,
      );
    });

    test('falls back to the media type, then other', () {
      expect(
        sourceTypeFor(
          url: 'https://youtube.com/x',
          mediaType: MediaType.youtube,
        ),
        SourceType.youtube,
      );
      expect(sourceTypeFor(), SourceType.other);
    });
  });

  group('buildEvidenceItems — media', () {
    test(
      'links a media item to a controversy only on real topical overlap',
      () {
        final items = build(media: [media()], controversies: [controversy()]);
        final m = items.firstWhere((i) => i.evidenceId == 'media-m1');
        expect(m.relatedControversies, ['New allegations']);
        expect(m.category, EvidenceCategory.controversy);
      },
    );

    test('does not invent a relationship when the topic does not overlap', () {
      final items = build(
        media: [media(title: 'Star announces summer tour dates')],
        controversies: [controversy()],
      );
      final m = items.firstWhere((i) => i.evidenceId == 'media-m1');
      expect(m.relatedControversies, isEmpty);
      expect(m.category, EvidenceCategory.news);
    });

    test('marks a fragment-linked item as related to sentiment', () {
      final items = build(
        media: [media()],
        sentimentEvidence: const [
          SentimentEvidence(
            fragment: 'faces new allegations',
            source: 'news',
            mediaId: 'm1',
          ),
        ],
      );
      expect(
        items.firstWhere((i) => i.evidenceId == 'media-m1').relatedToSentiment,
        isTrue,
      );
    });

    test(
      'rates strength from independent-publisher count, not raw article count',
      () {
        final items = build(
          media: [
            media(duplicateCount: 5, independentSourceCount: 1),
            media(id: 'm2', independentSourceCount: 3),
          ],
        );
        expect(
          items.firstWhere((i) => i.evidenceId == 'media-m1').evidenceStrength,
          EvidenceStrength.limited,
        );
        expect(
          items.firstWhere((i) => i.evidenceId == 'media-m2').evidenceStrength,
          EvidenceStrength.strong,
        );
      },
    );
  });

  group('buildEvidenceItems — controversy sources', () {
    test(
      "adds a controversy's own cited source once, not duplicated with a matching media item",
      () {
        final items = build(
          media: [media(url: 'https://apnews.com/report')],
          controversies: [
            controversy(sources: const ['https://apnews.com/report']),
          ],
        );
        expect(
          items.where((i) => i.sourceUrl == 'https://apnews.com/report'),
          hasLength(1),
        );
      },
    );

    test('a name-only source (no URL) is still shown, just not linkable', () {
      final items = build(
        controversies: [
          controversy(sources: const ['Reuters']),
        ],
      );
      final c = items.firstWhere(
        (i) =>
            i.category == EvidenceCategory.controversy &&
            i.sourceName == 'Reuters',
      );
      expect(c.sourceUrl, isNull);
      expect(c.evidenceStrength, EvidenceStrength.limited);
    });
  });

  group('buildEvidenceItems — career', () {
    test(
      'a career step with a source becomes evidence; one without is skipped',
      () {
        final items = build(career: [career(), career(sourceUrl: null)]);
        expect(
          items.where((i) => i.category == EvidenceCategory.career),
          hasLength(1),
        );
      },
    );
  });

  group('evidenceForControversy — honest absence', () {
    test('is empty for a controversy nothing was retrieved for', () {
      final items = build(controversies: [controversy(sources: const [])]);
      expect(evidenceForControversy(items, 'New allegations'), isEmpty);
    });
  });

  group('conflictingControversies', () {
    test('flags a controversy whose linked coverage disagrees in tone', () {
      final items = build(
        media: [
          media(sentimentTag: 'negative'),
          media(
            id: 'm2',
            title: 'Star cleared of new allegations',
            sentimentTag: 'positive',
          ),
        ],
        controversies: [controversy()],
      );
      expect(conflictingControversies(items), ['New allegations']);
      expect(
        items.any((i) => i.evidenceStrength == EvidenceStrength.conflicting),
        isTrue,
      );
    });

    test('does not flag unanimous coverage', () {
      final items = build(
        media: [
          media(sentimentTag: 'negative'),
          media(
            id: 'm2',
            title: 'Star faces new allegations again',
            sentimentTag: 'negative',
          ),
        ],
        controversies: [controversy()],
      );
      expect(conflictingControversies(items), isEmpty);
    });
  });
}
