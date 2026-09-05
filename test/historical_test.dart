// Historical Intelligence — the Dart twin of site/lib/historical.test.ts.
// Confirms the reconstruction never fabricates a point it has no real
// anchor for, and that coverage/turning-points/comparisons degrade to
// explicit gaps rather than guesses.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/historical.dart';

CareerEntry careerEntry({
  String? role = 'Analyst',
  String? organization = 'Firm A',
  int? start = 2020,
  int? end,
}) => CareerEntry(
  role: role,
  organization: organization,
  start: start,
  end: end,
  sourceName: 'Wikidata',
  sourceUrl: 'https://www.wikidata.org/wiki/Q1',
);

Controversy controversy({
  String title = 'Fraud allegations',
  int severity = 4,
  int? year = 2021,
  List<String> sources = const ['https://reuters.com/1'],
}) => Controversy(
  title: title,
  summary: 'The executive was accused of misrepresenting finances.',
  category: ControversyCategory.financial,
  severity: severity,
  status: ControversyStatus.ongoing,
  year: year,
  sources: sources,
);

SentimentSnapshot snapshot(String date, double score, int mentions) => SentimentSnapshot(
  date: date,
  positiveCount: 0,
  negativeCount: 0,
  neutralCount: 0,
  totalMentions: mentions,
  dominantEmotion: 'neutral',
  score: score,
);

Celebrity celebrity({
  List<CareerEntry> career = const [],
  List<Controversy> controversies = const [],
  List<SentimentSnapshot> trend = const [],
}) => Celebrity(
  slug: 'jane-doe',
  name: 'Jane Doe',
  candidates: const [],
  biography: Biography(
    profession: 'Executive',
    summary: 'Jane Doe is an executive.',
    background: '',
    notableWorks: const [],
    controversies: controversies,
  ),
  sentimentData: SentimentData(
    overallScore: 50,
    positiveRatio: 0.3,
    negativeRatio: 0.3,
    neutralRatio: 0.4,
    trendDirection: 'stable',
    explanation: '',
    trendData: trend,
    dominantEmotion: 'neutral',
    sampleSize: 50,
    confidence: 0.8,
  ),
  mediaItems: const [],
  fetchedAt: DateTime.utc(2026, 9, 5),
  facts: PersonFacts(career: career),
);

void main() {
  group('buildHistoricalSnapshots', () {
    test('returns nothing with fewer than two measured points', () {
      final c = celebrity(trend: [snapshot('2024-01-01', 50, 10)]);
      expect(buildHistoricalSnapshots(c, const []), isEmpty);
    });

    test('builds one snapshot per measured sentiment date, sorted ascending', () {
      final c = celebrity(
        trend: [snapshot('2024-02-01', 60, 20), snapshot('2024-01-01', 50, 10)],
      );
      final snaps = buildHistoricalSnapshots(c, const []);
      expect(snaps.map((s) => s.capturedAt).toList(), ['2024-01-01', '2024-02-01']);
      expect(snaps.first.sentimentScore, 50);
    });

    test('overlays career state as of each snapshot year — no role before its start date', () {
      final c = celebrity(
        trend: [snapshot('2019-06-01', 50, 5), snapshot('2021-06-01', 55, 8)],
        career: [careerEntry(start: 2020, role: 'Analyst', organization: 'Firm A')],
      );
      final snaps = buildHistoricalSnapshots(c, const []);
      expect(snaps[0].currentRole, isNull);
      expect(snaps[1].currentRole, 'Analyst, Firm A');
    });

    test('counts only controversies dated on or before the snapshot year', () {
      final c = celebrity(
        trend: [snapshot('2020-06-01', 50, 5), snapshot('2022-06-01', 40, 5)],
        controversies: [controversy(year: 2021)],
      );
      final snaps = buildHistoricalSnapshots(c, const []);
      expect(snaps[0].controversyCount, 0);
      expect(snaps[1].controversyCount, 1);
      expect(snaps[0].critiScore, isNull);
      expect(snaps[1].critiScore, isNotNull);
    });
  });

  group('supportedTimeRanges / filterSnapshotsByRange', () {
    test('offers no ranges with fewer than two snapshots', () {
      expect(supportedTimeRanges(const []), isEmpty);
    });

    test('only offers ranges the data span actually supports, plus all', () {
      final now = DateTime.utc(2024, 3, 1);
      final c = celebrity(
        trend: [snapshot('2024-02-05', 50, 5), snapshot('2024-02-25', 55, 5)],
      );
      final snaps = buildHistoricalSnapshots(c, const []);
      final ranges = supportedTimeRanges(snaps, now: now);
      expect(ranges, contains(HistoricalTimeRange.d30));
      expect(ranges, contains(HistoricalTimeRange.all));
      expect(ranges, isNot(contains(HistoricalTimeRange.y5)));
    });
  });

  group('buildHistoricalCoverage', () {
    test('marks every dimension unavailable, never zero, with no data', () {
      final cov = buildHistoricalCoverage(const [], const [], const [], const [], const []);
      for (final d in cov) {
        expect(d.level, CoverageLevel.unavailable);
        expect(d.status, DataStatus.unavailable);
      }
    });
  });

  group('majorTurningPoints', () {
    test('flags only large year-over-year CritiScore reconstruction moves', () {
      final points = majorTurningPoints(
        const [
          IndexHistoryPoint(year: 2020, score: 10),
          IndexHistoryPoint(year: 2021, score: 12),
          IndexHistoryPoint(year: 2022, score: 60),
        ],
        const [],
        const [],
      );
      expect(points.any((p) => p.kind == TurningPointKind.score && p.date == '2022'), isTrue);
      expect(points.any((p) => p.date == '2021'), isFalse);
    });
  });

  group('comparePeriods', () {
    test('a period with no snapshots reports nulls, not fabricated zeros', () {
      final cmp = comparePeriods(const [], HistoricalTimeRange.d30, HistoricalTimeRange.y1);
      expect(cmp.startScoreA, isNull);
      expect(cmp.endScoreA, isNull);
      expect(cmp.controversyCountA, 0);
    });
  });

  group('buildHistoricalOverview', () {
    test('hasHistory is false with no snapshots, no score history, no turning points', () {
      final overview = buildHistoricalOverview(
        celebrity: celebrity(),
        claims: const <Claim>[],
        changeEvents: const <ChangeEvent>[],
      );
      expect(overview.hasHistory, isFalse);
      expect(overview.firstSnapshotDate, isNull);
    });

    test('hasHistory is true once real dated controversies produce a score history', () {
      final c = celebrity(
        controversies: [controversy(year: 2019), controversy(title: 'Second', year: 2022)],
      );
      final overview = buildHistoricalOverview(
        celebrity: c,
        claims: const <Claim>[],
        changeEvents: const <ChangeEvent>[],
      );
      expect(overview.hasHistory, isTrue);
    });
  });
}
