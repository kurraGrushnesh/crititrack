// Advanced Compare — the Dart twin of site/lib/compare.test.ts.
import 'package:flutter_test/flutter_test.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/compare.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/historical.dart';

final now = DateTime.utc(2026, 9, 5);
final later = DateTime.utc(2026, 9, 6);

Controversy controversy({String title = 'Episode', int severity = 3, int? year = 2024, List<String> sources = const ['https://reuters.com/1']}) =>
    Controversy(title: title, summary: 'Summary.', category: ControversyCategory.financial, severity: severity, status: ControversyStatus.ongoing, year: year, sources: sources);

Claim claim({String claimId = 'c1', ClaimStatus status = ClaimStatus.reportedUncorroborated}) => Claim(
  claimId: claimId,
  entityId: null,
  controversyId: 'episode',
  timelineEventId: null,
  claimText: 'It happened',
  claimType: ClaimType.allegation,
  dateContext: '2024',
  status: status,
  confidence: ClaimConfidence.low,
  supportingEvidenceIds: const [],
  contradictingEvidenceIds: const [],
  neutralEvidenceIds: const [],
  responseEvidenceIds: const [],
  createdAt: null,
  updatedAt: null,
  methodologyVersion: 'cvm-1',
  statusReason: '',
);

EntityComparisonContext entity({
  required String entityId,
  required String entityName,
  String? profession,
  String? currentRole,
  double? critiScore,
  double? sentimentScore,
  List<Controversy> controversies = const [],
  List<Claim> claims = const [],
  CoverageReport? coverageReport,
  HistoricalOverview? historicalOverview,
}) => EntityComparisonContext(
  entityId: entityId,
  entityName: entityName,
  profession: profession,
  currentRole: currentRole,
  critiScore: critiScore,
  sentimentScore: sentimentScore,
  controversies: controversies,
  claims: claims,
  coverageReport: coverageReport,
  historicalOverview: historicalOverview,
);

void main() {
  group('createComparison / mutators', () {
    test('defaults the title from entity names', () {
      final c = createComparison(comparisonId: 'cp1', userId: 'u1', entityIds: const ['Q1', 'Q2'], entityNames: const ['Jane Doe', 'John Roe'], now: now);
      expect(c.title, 'Jane Doe vs John Roe');
      expect(c.timeRange, HistoricalTimeRange.y1);
    });

    test('rename ignores a blank title', () {
      final c = createComparison(comparisonId: 'cp1', userId: 'u1', entityIds: const ['Q1', 'Q2'], now: now);
      expect(renameComparison(c, '   ', later).title, c.title);
      expect(renameComparison(c, 'Final', later).title, 'Final');
    });

    test('updateComparisonFilters merges rather than replaces', () {
      final c = createComparison(comparisonId: 'cp1', userId: 'u1', entityIds: const ['Q1', 'Q2'], now: now);
      final next = updateComparisonFilters(c, topic: ComparisonTopic.controversy, now: later);
      expect(next.filters.topic, ComparisonTopic.controversy);
      expect(next.filters.dataMode, ComparisonDataMode.all);
    });

    test('updateComparisonTimeRange bumps updatedAt', () {
      final c = createComparison(comparisonId: 'cp1', userId: 'u1', entityIds: const ['Q1', 'Q2'], now: now);
      final next = updateComparisonTimeRange(c, HistoricalTimeRange.y5, later);
      expect(next.timeRange, HistoricalTimeRange.y5);
      expect(next.updatedAt, later);
    });
  });

  group('buildComparison — neutral language', () {
    test('never emits judgmental language', () {
      final a = entity(entityId: 'Q1', entityName: 'Jane Doe', critiScore: 80, controversies: [controversy(), controversy(title: 'Two')]);
      final b = entity(entityId: 'Q2', entityName: 'John Roe', critiScore: 20, controversies: [controversy()]);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final allText = sections.expand((s) => s.rows).map((r) => r.note).whereType<String>().join(' ').toLowerCase();
      for (final banned in ['better', 'worse', 'more trustworthy', 'more guilty', 'more corrupt', 'is guilty', 'caused']) {
        expect(allText.contains(banned), isFalse, reason: banned);
      }
    });

    test('equal values produce a null note', () {
      final a = entity(entityId: 'Q1', entityName: 'A', critiScore: 50);
      final b = entity(entityId: 'Q2', entityName: 'B', critiScore: 50);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'critiscore-current');
      expect(row.note, isNull);
    });

    test('missing data reports Unavailable, never fabricates a value', () {
      final a = entity(entityId: 'Q1', entityName: 'A');
      final b = entity(entityId: 'Q2', entityName: 'B');
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'critiscore-current');
      expect(row.valueA, 'Unavailable');
      expect(row.valueB, 'Unavailable');
    });
  });

  group('buildComparison — controversy comparison', () {
    test('counts controversies within the selected time range only', () {
      final a = entity(entityId: 'Q1', entityName: 'A', controversies: [controversy(year: 2020), controversy(title: 'Recent', year: 2026)]);
      final b = entity(entityId: 'Q2', entityName: 'B', controversies: [controversy(year: 2026)]);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.y1, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'controversy-count');
      expect(row.valueA, '1');
      expect(row.valueB, '1');
    });

    test('phrases the difference as a dataset fact, not a character judgment', () {
      final a = entity(entityId: 'Q1', entityName: 'Jane Doe', controversies: [controversy(), controversy(title: 'Two')]);
      final b = entity(entityId: 'Q2', entityName: 'John Roe', controversies: const []);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'controversy-count');
      expect(row.note, contains('documented controversy record(s) in the available CritiTrack dataset'));
      expect(row.note, isNot(contains('more controversial')));
    });
  });

  group('buildComparison — claims', () {
    test('uses neutral documented-claims language', () {
      final a = entity(entityId: 'Q1', entityName: 'A', claims: [claim(), claim(claimId: 'c2')]);
      final b = entity(entityId: 'Q2', entityName: 'B', claims: [claim(claimId: 'c3')]);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'claim-count');
      expect(row.metric, 'Documented claims in selected period');
    });

    test('counts corroborated claims from real status values only', () {
      final a = entity(entityId: 'Q1', entityName: 'A', claims: [claim(status: ClaimStatus.supported), claim(claimId: 'c2')]);
      final b = entity(entityId: 'Q2', entityName: 'B');
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).firstWhere((r) => r.rowId == 'claim-corroborated');
      expect(row.valueA, '1');
    });
  });

  group('buildComparison — topic filter', () {
    test('filtering to one topic returns only that topic', () {
      final a = entity(entityId: 'Q1', entityName: 'A', critiScore: 40, claims: [claim()]);
      final b = entity(entityId: 'Q2', entityName: 'B', critiScore: 60);
      final sections = buildComparison(
        a: a,
        b: b,
        filters: const ComparisonFilters(topic: ComparisonTopic.claims),
        timeRange: HistoricalTimeRange.all,
        now: now,
      );
      expect(sections.every((s) => s.topic == ComparisonTopic.claims), isTrue);
      expect(sections.any((s) => s.topic == ComparisonTopic.critiscore), isFalse);
    });
  });

  group('buildComparison — evidence-backed mode', () {
    test('excludes rows with no real evidence backing', () {
      final a = entity(entityId: 'Q1', entityName: 'A', currentRole: 'CEO');
      final b = entity(entityId: 'Q2', entityName: 'B', currentRole: 'Founder');
      final sections = buildComparison(
        a: a,
        b: b,
        filters: const ComparisonFilters(dataMode: ComparisonDataMode.evidenceBacked),
        timeRange: HistoricalTimeRange.all,
        now: now,
      );
      final roleRow = sections.expand((s) => s.rows).where((r) => r.rowId == 'current-role');
      expect(roleRow, isEmpty);
    });
  });

  group('buildComparison — data coverage', () {
    test('only shows a coverage row when levels actually differ', () {
      final a = entity(
        entityId: 'Q1',
        entityName: 'A',
        coverageReport: const CoverageReport(coverageVersion: 'coverage-1', dimensions: [
          CoverageDimension(key: CoverageDimensionKey.news, level: CoverageLevel.high, status: DataStatus.available, reasons: []),
        ]),
      );
      final b = entity(
        entityId: 'Q2',
        entityName: 'B',
        coverageReport: const CoverageReport(coverageVersion: 'coverage-1', dimensions: [
          CoverageDimension(key: CoverageDimensionKey.news, level: CoverageLevel.low, status: DataStatus.limited, reasons: []),
        ]),
      );
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).where((r) => r.rowId == 'coverage-news').firstOrNull;
      expect(row, isNotNull);
      expect(row?.note, contains('limited by unequal available data'));
    });

    test('identical coverage levels produce no row', () {
      const report = CoverageReport(coverageVersion: 'coverage-1', dimensions: [
        CoverageDimension(key: CoverageDimensionKey.news, level: CoverageLevel.high, status: DataStatus.available, reasons: []),
      ]);
      final a = entity(entityId: 'Q1', entityName: 'A', coverageReport: report);
      final b = entity(entityId: 'Q2', entityName: 'B', coverageReport: report);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final row = sections.expand((s) => s.rows).where((r) => r.rowId == 'coverage-news').firstOrNull;
      expect(row, isNull);
    });
  });

  group('keyDifferences', () {
    test('collects only real notes, capped', () {
      final a = entity(entityId: 'Q1', entityName: 'A', critiScore: 80, claims: [claim()]);
      final b = entity(entityId: 'Q2', entityName: 'B', critiScore: 20);
      final sections = buildComparison(a: a, b: b, filters: const ComparisonFilters(), timeRange: HistoricalTimeRange.all, now: now);
      final diffs = keyDifferences(sections, max: 2);
      expect(diffs.length, lessThanOrEqualTo(2));
    });
  });

  group('turningPointsFor', () {
    test("returns each entity's own turning points, never merged", () {
      final a = entity(
        entityId: 'Q1',
        entityName: 'A',
        historicalOverview: const HistoricalOverview(
          entityId: 'Q1',
          firstSnapshotDate: '2024-01-01',
          latestSnapshotDate: '2026-01-01',
          snapshotCount: 5,
          supportedRanges: [HistoricalTimeRange.all],
          coverage: [],
          turningPoints: [TurningPoint(id: 'tp1', kind: TurningPointKind.score, date: '2025', title: 'Score moved', summary: '')],
          hasHistory: true,
        ),
      );
      final b = entity(entityId: 'Q2', entityName: 'B');
      final points = turningPointsFor(a, b);
      expect(points[0].points, hasLength(1));
      expect(points[1].points, isEmpty);
    });
  });
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
