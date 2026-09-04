// The Intelligence Timeline — merged controversy, career, news and
// sentiment events, and the honesty rules around them: a single article
// is not a timeline event, an undated row does not appear, and
// "importance" always reads a real signal rather than inventing one.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/timeline.dart';

Controversy controversy({
  String title = 'Tax dispute',
  String summary = 'A disagreement over reported income.',
  int severity = 3,
  String status = ControversyStatus.resolved,
  int? year = 2019,
  List<String> sources = const ['https://reuters.com/story'],
}) => Controversy(
  title: title,
  summary: summary,
  category: ControversyCategory.financial,
  severity: severity,
  status: status,
  year: year,
  sources: sources,
);

MediaItem media({
  String id = '1',
  String url = 'https://apnews.com/story',
  String? source = 'AP',
  int? sentimentScore,
  DateTime? publishedAt,
}) => MediaItem(
  id: id,
  type: MediaType.news,
  title: 'Headline',
  url: url,
  source: source,
  sentimentScore: sentimentScore,
  publishedAt: publishedAt ?? DateTime.utc(2026, 3, 12),
);

CareerEntry career({
  int? start = 2018,
  int? end,
  String? role = 'Chief Executive Officer',
  String? organization = 'Firm C',
  String? location,
  String sourceName = 'Wikidata',
  String? sourceUrl = 'https://www.wikidata.org/wiki/Q1',
}) => CareerEntry(
  start: start,
  end: end,
  role: role,
  organization: organization,
  location: location,
  sourceName: sourceName,
  sourceUrl: sourceUrl,
);

List<SentimentSnapshot> trend(List<double> scores) => [
  for (var i = 0; i < scores.length; i++)
    SentimentSnapshot(
      date: '2026-03-0${i + 1}',
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalMentions: 0,
      dominantEmotion: 'neutral',
      score: scores[i],
    ),
];

List<TimelineEvent> build({
  List<Controversy> controversies = const [],
  List<MediaItem> mediaItems = const [],
  List<CareerEntry> career = const [],
  List<SentimentSnapshot> trend = const [],
}) => buildTimeline(
  controversies: controversies,
  media: mediaItems,
  career: career,
  trend: trend,
);

void main() {
  group('sentimentShiftEvents', () {
    test('emits on a jump past the threshold', () {
      final out = sentimentShiftEvents(trend([50, 65]));
      expect(out.single.change, 15);
      expect(out.single.title, contains('rose sharply'));
    });

    test('ignores a small wobble', () {
      expect(sentimentShiftEvents(trend([50, 54, 51])), isEmpty);
    });
  });

  group('buildTimeline — controversy', () {
    test('places a year-only controversy on Jan 1, flagged approximate', () {
      final e = build(controversies: [controversy()]).single;
      expect(e.date, DateTime.utc(2019, 1, 1));
      expect(e.approxDate, isTrue);
      expect(e.kind, TimelineKind.controversy);
    });

    test("carries the episode's real sources", () {
      final e = build(controversies: [controversy()]).single;
      expect(e.sources.single.label, 'reuters.com');
      expect(e.sources.single.url, 'https://reuters.com/story');
    });

    test('a publication-name-only source has no url', () {
      final e =
          build(
            controversies: [
              controversy(sources: ['Reuters']),
            ],
          ).single;
      expect(e.sources.single.label, 'Reuters');
      expect(e.sources.single.url, isNull);
    });

    test(
      'rates importance from severity and status, not an invented score',
      () {
        final high =
            build(
              controversies: [
                controversy(severity: 5, status: ControversyStatus.ongoing),
              ],
            ).single;
        expect(high.importance, Importance.high);
        expect(high.importanceReason, contains('severity 5/5'));

        final low =
            build(
              controversies: [
                controversy(severity: 1, status: ControversyStatus.historical),
              ],
            ).single;
        expect(low.importance, Importance.low);
      },
    );

    test('drops a controversy with no recorded year', () {
      expect(build(controversies: [controversy(year: null)]), isEmpty);
    });
  });

  group('buildTimeline — career and organization', () {
    test('a role entry becomes a career event', () {
      final e = build(career: [career()]).single;
      expect(e.kind, TimelineKind.career);
      expect(e.title, 'Chief Executive Officer, Firm C');
      expect(e.date, DateTime.utc(2018, 1, 1));
    });

    test('a role-less employer entry becomes an organization event', () {
      final e =
          build(
            career: [
              career(role: null, organization: 'Sidley Austin', start: 1991),
            ],
          ).single;
      expect(e.kind, TimelineKind.organization);
      expect(e.title, 'Sidley Austin');
    });

    test('a leadership title is rated high importance', () {
      final e = build(career: [career(role: 'Chief Executive Officer')]).single;
      expect(e.importance, Importance.high);
    });

    test('an undated career row is dropped', () {
      expect(build(career: [career(start: null)]), isEmpty);
    });
  });

  group('buildTimeline — news grouping', () {
    test('a single article on its own is not a timeline event', () {
      expect(build(mediaItems: [media()]), isEmpty);
    });

    test('two or more sources the same day become one grouped event', () {
      final e =
          build(
            mediaItems: [
              media(id: '1', url: 'https://a.example/1'),
              media(id: '2', url: 'https://b.example/2', source: 'Reuters'),
            ],
          ).single;
      expect(e.kind, TimelineKind.news);
      expect(e.sourceCount, 2);
      expect(e.date, DateTime.utc(2026, 3, 12));
      expect(e.sources, hasLength(2));
    });

    test("averages the grouped items' sentiment, ignoring unscored ones", () {
      final e =
          build(
            mediaItems: [
              media(id: '1', url: 'https://a.example/1', sentimentScore: 80),
              media(id: '2', url: 'https://b.example/2', sentimentScore: 60),
              media(id: '3', url: 'https://c.example/3'),
            ],
          ).single;
      expect(e.sentimentImpact, 70);
    });

    test('does not double-count the same url twice in the source list', () {
      final e =
          build(
            mediaItems: [
              media(id: '1', url: 'https://a.example/1'),
              media(id: '2', url: 'https://a.example/1'),
              media(id: '3', url: 'https://b.example/3'),
            ],
          ).single;
      expect(e.sourceCount, 3);
      expect(e.sources, hasLength(2));
    });

    test('undated media never becomes an event', () {
      MediaItem undated(String id) => MediaItem(
        id: id,
        type: MediaType.news,
        title: 'Headline',
        url: 'https://a.example/$id',
        source: 'AP',
      );
      expect(build(mediaItems: [undated('1'), undated('2')]), isEmpty);
    });
  });

  group('buildTimeline — merge order and relationships', () {
    test('merges every kind, newest first', () {
      final out = build(
        controversies: [controversy(year: 2020)],
        mediaItems: [
          media(id: '1', url: 'https://a.example/1'),
          media(id: '2', url: 'https://b.example/2'),
        ],
        career: [career(start: 2015)],
        trend: trend([50, 50, 70]),
      );
      final kinds = out.map((e) => e.kind).toSet();
      expect(
        kinds,
        containsAll([
          TimelineKind.sentimentShift,
          TimelineKind.news,
          TimelineKind.career,
          TimelineKind.controversy,
        ]),
      );
      // Newest first.
      for (var i = 1; i < out.length; i++) {
        expect(out[i - 1].date.compareTo(out[i].date), greaterThanOrEqualTo(0));
      }
    });

    test('tags nearby events as related without claiming a cause', () {
      final out = build(
        controversies: [controversy(year: 2026)],
        trend: [
          SentimentSnapshot(
            date: '2026-01-01',
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            totalMentions: 0,
            dominantEmotion: 'neutral',
            score: 50,
          ),
          SentimentSnapshot(
            date: '2026-01-03',
            positiveCount: 0,
            negativeCount: 0,
            neutralCount: 0,
            totalMentions: 0,
            dominantEmotion: 'neutral',
            score: 20,
          ),
        ],
      );
      final shift = out.firstWhere(
        (e) => e.kind == TimelineKind.sentimentShift,
      );
      expect(shift.relatedTitles, contains('Tax dispute'));
    });

    test('is empty when there is nothing dated at all', () {
      expect(build(), isEmpty);
    });
  });
}
