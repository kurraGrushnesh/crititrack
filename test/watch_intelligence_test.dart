// Watch Intelligence — filters, unseen tracking, and the overview built
// over Step 15/16's real ChangeEvents and the Timeline's real news
// grouping. Never a second Change Detection engine.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/timeline.dart';
import 'package:crititrack/core/utils/watch_intelligence.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';

ChangeEvent change({
  String changeId = 'c1',
  ChangeSeverity severity = ChangeSeverity.significant,
  ChangeConfidence confidence = ChangeConfidence.medium,
  DateTime? detectedAt,
  String title = 'CritiScore increased +9',
}) => ChangeEvent(
  changeId: changeId,
  entityId: 'x',
  changeType: ChangeType.critiscoreChange,
  severity: severity,
  title: title,
  summary: 'reason',
  previousValue: '38',
  currentValue: '47',
  detectedAt: detectedAt ?? DateTime.utc(2026, 9, 1),
  effectiveDate: null,
  evidenceIds: const [],
  relatedClaimIds: const [],
  methodologyVersion: '2.0',
  confidence: confidence,
  sourceCoverage: null,
);

void main() {
  group('filterBySeverity', () {
    test('all passes everything through', () {
      final list = [
        change(changeId: 'info', severity: ChangeSeverity.info),
        change(changeId: 'major', severity: ChangeSeverity.major),
      ];
      expect(filterBySeverity(list, WatchMinimumSeverity.all), hasLength(2));
    });

    test('a minimum keeps that level and above only', () {
      final list = [
        change(changeId: 'info', severity: ChangeSeverity.info),
        change(changeId: 'minor', severity: ChangeSeverity.minor),
        change(changeId: 'sig', severity: ChangeSeverity.significant),
        change(changeId: 'major', severity: ChangeSeverity.major),
      ];
      expect(
        filterBySeverity(list, WatchMinimumSeverity.significant).map((c) => c.changeId).toList(),
        ['sig', 'major'],
      );
    });
  });

  group('filterByConfidence', () {
    test('keeps a minimum confidence and above', () {
      final list = [
        change(changeId: 'low', confidence: ChangeConfidence.low),
        change(changeId: 'med', confidence: ChangeConfidence.medium),
        change(changeId: 'high', confidence: ChangeConfidence.high),
      ];
      expect(
        filterByConfidence(list, WatchMinimumConfidence.medium).map((c) => c.changeId).toList(),
        ['med', 'high'],
      );
    });
  });

  group('filterByTimeRange', () {
    final now = DateTime.utc(2026, 9, 10);
    test('24h excludes anything older than a day', () {
      final list = [
        change(changeId: 'recent', detectedAt: DateTime.utc(2026, 9, 9, 12)),
        change(changeId: 'old', detectedAt: DateTime.utc(2026, 8, 1)),
      ];
      expect(filterByTimeRange(list, WatchTimeRange.day1, now).map((c) => c.changeId).toList(), ['recent']);
    });

    test('all never filters anything out', () {
      final list = [change(detectedAt: DateTime.utc(2020))];
      expect(filterByTimeRange(list, WatchTimeRange.all, now), hasLength(1));
    });
  });

  group('applyWatchFilters', () {
    test('combines severity, confidence and time in one pass', () {
      final now = DateTime.utc(2026, 9, 10);
      final list = [
        change(
          changeId: 'keep',
          severity: ChangeSeverity.major,
          confidence: ChangeConfidence.high,
          detectedAt: DateTime.utc(2026, 9, 9),
        ),
        change(
          changeId: 'low-sev',
          severity: ChangeSeverity.minor,
          confidence: ChangeConfidence.high,
          detectedAt: DateTime.utc(2026, 9, 9),
        ),
        change(
          changeId: 'old',
          severity: ChangeSeverity.major,
          confidence: ChangeConfidence.high,
          detectedAt: DateTime.utc(2026, 1, 1),
        ),
      ];
      final out = applyWatchFilters(
        list,
        const WatchFilters(
          minimumSeverity: WatchMinimumSeverity.significant,
          minimumConfidence: WatchMinimumConfidence.medium,
          timeRange: WatchTimeRange.day7,
        ),
        now,
      );
      expect(out.map((c) => c.changeId).toList(), ['keep']);
    });
  });

  group('importantChanges', () {
    test('keeps only MAJOR and SIGNIFICANT', () {
      final list = [
        change(changeId: 'info', severity: ChangeSeverity.info),
        change(changeId: 'minor', severity: ChangeSeverity.minor),
        change(changeId: 'sig', severity: ChangeSeverity.significant),
        change(changeId: 'major', severity: ChangeSeverity.major),
      ];
      expect(importantChanges(list).map((c) => c.changeId).toList(), ['sig', 'major']);
    });
  });

  group('unseenChanges', () {
    test('everything is unseen when lastSeenChangeAt is null', () {
      final list = [change(), change(changeId: 'c2')];
      expect(unseenChanges(list, null), hasLength(2));
    });

    test('only changes detected after the cursor are unseen', () {
      final cursor = DateTime.utc(2026, 9, 1);
      final list = [
        change(changeId: 'before', detectedAt: DateTime.utc(2026, 8, 31)),
        change(changeId: 'after', detectedAt: DateTime.utc(2026, 9, 2)),
      ];
      expect(unseenChanges(list, cursor).map((c) => c.changeId).toList(), ['after']);
    });
  });

  group('buildWatchOverview', () {
    Celebrity celebrity({List<Controversy> controversies = const [], double sentimentScore = 20}) => Celebrity(
      slug: 'jane-doe',
      name: 'Jane Doe',
      biography: Biography(
        profession: 'Executive',
        summary: '',
        background: '',
        notableWorks: const [],
        controversies: controversies,
      ),
      sentimentData: SentimentData(
        overallScore: sentimentScore,
        positiveRatio: 0.2,
        negativeRatio: 0.5,
        neutralRatio: 0.3,
        trendDirection: 'down',
        explanation: '',
        trendData: const [],
        dominantEmotion: 'anger',
      ),
      mediaItems: const [],
      fetchedAt: DateTime.utc(2026, 9, 5),
      facts: PersonFacts.empty,
    );

    test('critiscore matches the real deterministic calculation', () {
      final c = celebrity(
        controversies: [
          const Controversy(
            title: 'Episode',
            summary: 's',
            category: ControversyCategory.legal,
            severity: 4,
            status: ControversyStatus.ongoing,
            year: 2026,
            sources: ['https://reuters.com/1'],
          ),
        ],
      );
      final overview = buildWatchOverview(c, const [], null);
      expect(overview.critiscore, greaterThan(0));
      expect(overview.sentimentLabel, 'Negative');
    });

    test('unseen and important-unseen counts are consistent', () {
      final list = [
        change(changeId: 'a', severity: ChangeSeverity.major, detectedAt: DateTime.utc(2026, 9, 4)),
        change(changeId: 'b', severity: ChangeSeverity.info, detectedAt: DateTime.utc(2026, 9, 4)),
      ];
      final overview = buildWatchOverview(celebrity(), list, null);
      expect(overview.unseenCount, 2);
      expect(overview.importantUnseenCount, 1);
      expect(overview.recentChangeCount, 2);
    });

    test('a quiet watch with no changes reports null, never a fabricated update', () {
      final overview = buildWatchOverview(celebrity(), const [], null);
      expect(overview.lastMeaningfulUpdate, isNull);
    });
  });

  group('importantNewsFromTimeline', () {
    TimelineEvent newsEvent({String title = 'Story', int? sourceCount = 3}) => TimelineEvent(
      date: DateTime.utc(2026, 9, 1),
      approxDate: false,
      kind: TimelineKind.news,
      title: title,
      detail: '',
      importance: Importance.medium,
      importanceReason: 'x',
      sourceCount: sourceCount,
    );

    test('only news-kind events are returned, sorted by source count then recency', () {
      final timeline = [
        newsEvent(title: 'Small story', sourceCount: 2),
        TimelineEvent(
          date: DateTime.utc(2026, 9, 1),
          approxDate: false,
          kind: TimelineKind.controversy,
          title: 'Not news',
          detail: '',
          importance: Importance.high,
          importanceReason: 'x',
        ),
        newsEvent(title: 'Major event', sourceCount: 15),
      ];
      final out = importantNewsFromTimeline(timeline);
      expect(out.map((e) => e.title).toList(), ['Major event', 'Small story']);
    });

    test('respects a caller-supplied limit', () {
      final timeline = List.generate(20, (i) => newsEvent(title: 's$i'));
      expect(importantNewsFromTimeline(timeline, limit: 3), hasLength(3));
    });

    test('15 articles behind one grouped event still surfaces as a single entry', () {
      final timeline = [newsEvent(title: 'Major event', sourceCount: 15)];
      final out = importantNewsFromTimeline(timeline);
      expect(out, hasLength(1));
      expect(out.first.sourceCount, 15);
    });
  });
}
