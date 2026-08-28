// Firestore round-trips.
//
// Phase 1 writes every profile to Firestore and reads it back on the next
// open. A field that does not survive that round trip does not throw — it
// silently comes back as its default, so a dropped confidence band reads
// as "no band" and a dropped Wikidata id reads as "unverified". Nothing
// upstream notices.
//
// These tests write a fully-populated model, read it back, and assert the
// two agree field by field.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';

final snapshots = [
  const SentimentSnapshot(
    date: '2026-08-27',
    positiveCount: 3,
    negativeCount: 1,
    neutralCount: 2,
    totalMentions: 6,
    dominantEmotion: 'admiration',
    score: 68,
  ),
  const SentimentSnapshot(
    date: '2026-08-28',
    positiveCount: 4,
    negativeCount: 0,
    neutralCount: 2,
    totalMentions: 6,
    dominantEmotion: 'admiration',
    score: 71,
    rollingMu: 66.5,
    rollingSigma: 2.4,
    zScore: 1.9,
    isSpike: true,
  ),
];

final media = [
  MediaItem(
    id: 'a1',
    type: MediaType.news,
    title: 'A headline',
    url: 'https://example.com/a',
    thumbnailUrl: 'https://example.com/a.jpg',
    source: 'Example',
    publishedAt: DateTime.utc(2026, 8, 27, 9, 30),
    description: 'A description.',
    sentimentTag: 'positive',
  ),
  MediaItem(
    id: 'v1',
    type: MediaType.youtube,
    title: 'A video',
    url: 'https://youtube.com/watch?v=v1',
    source: 'YouTube',
    videoId: 'v1',
    channelTitle: 'A channel',
  ),
];

const controversies = [
  Controversy(
    title: 'Contract dispute',
    summary: 'A disagreement, later settled.',
    category: ControversyCategory.legal,
    severity: 4,
    status: ControversyStatus.resolved,
    year: 2021,
    sources: ['Variety', 'Reuters'],
  ),
];

Celebrity fullyPopulated() {
  return Celebrity(
    slug: 'jane-doe',
    name: 'Jane Doe',
    imageUrl: 'https://example.com/portrait.jpg',
    wikidataId: 'Q12345',
    verified: true,
    biography: const Biography(
      profession: 'Actor',
      summary: 'A performer.',
      background: 'A long background.',
      notableWorks: ['Film A', 'Film B'],
      controversies: controversies,
    ),
    sentimentData: SentimentData(
      overallScore: 71,
      positiveRatio: 0.5,
      negativeRatio: 0.2,
      neutralRatio: 0.3,
      trendDirection: 'up',
      explanation: 'Coverage skews positive.',
      trendData: snapshots,
      dominantEmotion: 'admiration',
      evidence: const [
        SentimentEvidence(fragment: 'praised for the role', source: 'news'),
      ],
      forecast: const [72, 73, 74],
      scoreNews: 72,
      scoreYoutube: 68,
    ),
    mediaItems: media,
    fetchedAt: DateTime.utc(2026, 8, 28, 12),
  );
}

/// Mirrors what the repository does: the document plus its two
/// sub-collections are stored separately and reassembled on read.
Celebrity roundTrip(Celebrity original) {
  return Celebrity.fromFirestore(
    original.slug,
    original.toFirestore(),
    mediaItems:
        original.mediaItems
            .map((m) => MediaItem.fromFirestore(m.id, m.toFirestore()))
            .toList(),
    sentimentSnapshots:
        original.sentimentData.trendData
            .map((s) => SentimentSnapshot.fromFirestore(s.toFirestore()))
            .toList(),
  );
}

void main() {
  group('Celebrity survives a Firestore round trip', () {
    late Celebrity before;
    late Celebrity after;

    setUp(() {
      before = fullyPopulated();
      after = roundTrip(before);
    });

    test('identity fields', () {
      expect(after.slug, before.slug);
      expect(after.name, before.name);
      expect(after.imageUrl, before.imageUrl);
      expect(after.fetchedAt, before.fetchedAt);
      expect(after.cacheVersion, before.cacheVersion);
    });

    test('the resolved entity, which drives the verified badge', () {
      expect(after.wikidataId, 'Q12345');
      expect(
        after.verified,
        isTrue,
        reason:
            'a dropped flag would silently mark a known figure '
            'unverified, which is a visible claim about our confidence',
      );
    });

    test('biography and notable works', () {
      expect(after.biography.profession, before.biography.profession);
      expect(after.biography.summary, before.biography.summary);
      expect(after.biography.background, before.biography.background);
      expect(after.biography.notableWorks, before.biography.notableWorks);
    });

    test('controversies keep every field, including sources', () {
      expect(after.biography.controversies, hasLength(1));
      final c = after.biography.controversies.first;
      final o = before.biography.controversies.first;
      expect(c.title, o.title);
      expect(c.summary, o.summary);
      expect(c.category, o.category);
      expect(c.severity, o.severity);
      expect(c.status, o.status);
      expect(c.year, o.year);
      expect(
        c.sources,
        o.sources,
        reason: 'sources are what make a severity-4 claim showable at all',
      );
    });

    test('sentiment scores and ratios', () {
      expect(after.sentimentData.overallScore, 71);
      expect(after.sentimentData.positiveRatio, 0.5);
      expect(after.sentimentData.negativeRatio, 0.2);
      expect(after.sentimentData.neutralRatio, 0.3);
      expect(after.sentimentData.trendDirection, 'up');
      expect(after.sentimentData.explanation, before.sentimentData.explanation);
      expect(
        after.sentimentData.dominantEmotion,
        'admiration',
        reason:
            'fromFirestore reads dominantEmotion, so toFirestore must '
            'write it — otherwise every cached profile silently comes '
            'back as "neutral"',
      );
    });

    test('per-source scores', () {
      expect(after.sentimentData.scoreNews, 72);
      expect(after.sentimentData.scoreYoutube, 68);
      expect(after.sentimentData.scoreInstagram, isNull);
    });

    test('evidence fragments', () {
      expect(after.sentimentData.evidence, hasLength(1));
      expect(
        after.sentimentData.evidence.first.fragment,
        'praised for the role',
      );
      expect(after.sentimentData.evidence.first.source, 'news');
    });

    test('forecast', () {
      expect(after.sentimentData.forecast, [72, 73, 74]);
    });

    test('snapshots keep their dates, scores and spike annotations', () {
      final t = after.sentimentData.trendData;
      expect(t, hasLength(2));
      expect(t[0].date, '2026-08-27');
      expect(t[1].date, '2026-08-28');
      expect(t[1].score, 71);
      expect(t[1].isSpike, isTrue);
      expect(t[1].zScore, 1.9);
      expect(t[1].rollingMu, 66.5);
      expect(t[1].totalMentions, 6);
      expect(t[1].dominantEmotion, 'admiration');
    });

    test('media items keep type, timestamps and per-type extras', () {
      expect(after.mediaItems, hasLength(2));

      final news = after.mediaItems.firstWhere((m) => m.id == 'a1');
      expect(news.type, MediaType.news);
      expect(news.title, 'A headline');
      expect(news.url, 'https://example.com/a');
      expect(news.thumbnailUrl, 'https://example.com/a.jpg');
      expect(news.publishedAt, DateTime.utc(2026, 8, 27, 9, 30));
      expect(news.sentimentTag, 'positive');

      final video = after.mediaItems.firstWhere((m) => m.id == 'v1');
      expect(video.type, MediaType.youtube);
      expect(video.videoId, 'v1');
      expect(video.channelTitle, 'A channel');
      expect(video.publishedAt, isNull);
    });
  });

  group('degrades rather than throwing on partial data', () {
    test('an empty document produces a usable model', () {
      final c = Celebrity.fromFirestore('x', const {});
      expect(c.slug, 'x');
      expect(c.name, '');
      expect(c.verified, isFalse);
      expect(c.sentimentData.overallScore, 50);
      expect(c.biography.controversies, isEmpty);
      expect(c.mediaItems, isEmpty);
    });

    test('a document written before a field existed still reads', () {
      // Older cached documents have no imageUrl, wikidataId or verified.
      final c = Celebrity.fromFirestore('x', {
        'name': 'Old Record',
        'sentimentScore': 60.0,
        'fetchedAt': DateTime.utc(2026).toIso8601String(),
      });
      expect(c.name, 'Old Record');
      expect(c.imageUrl, isNull);
      expect(c.wikidataId, isNull);
      expect(c.verified, isFalse);
      expect(c.sentimentData.overallScore, 60);
    });

    test('an unparseable timestamp falls back rather than crashing', () {
      final c = Celebrity.fromFirestore('x', {'fetchedAt': 'not a date'});
      expect(c.fetchedAt, isA<DateTime>());
    });

    test('null optional fields are omitted, not stored as null', () {
      final map =
          Celebrity(
            slug: 'x',
            name: 'X',
            biography: const Biography(
              profession: '',
              summary: '',
              background: '',
              notableWorks: [],
              controversies: [],
            ),
            sentimentData: const SentimentData(
              overallScore: 50,
              positiveRatio: 0.33,
              negativeRatio: 0.33,
              neutralRatio: 0.34,
              trendDirection: 'stable',
              explanation: '',
              trendData: [],
              dominantEmotion: 'neutral',
            ),
            mediaItems: const [],
            fetchedAt: DateTime.utc(2026),
          ).toFirestore();

      expect(map.containsKey('imageUrl'), isFalse);
      expect(map.containsKey('wikidataId'), isFalse);
      expect(map.containsKey('scoreNews'), isFalse);
    });
  });
}
