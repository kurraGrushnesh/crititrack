// Professional Research Reports — the Dart twin of site/lib/report.test.ts.
import 'package:flutter_test/flutter_test.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/core/utils/report.dart';
import 'package:crititrack/core/utils/research.dart';

final now = DateTime.utc(2026, 9, 5);
final later = DateTime.utc(2026, 9, 6);

ResearchItem item({
  required ResearchItemType type,
  String? itemId,
  String title = 'Item',
  String? referenceId,
  String note = '',
  Map<String, Object?> metadata = const {},
  FindingStatus status = FindingStatus.undecided,
}) {
  final built = buildResearchItem(
    itemId: itemId ?? 'i-${DateTime.now().microsecondsSinceEpoch}-${title.hashCode}',
    workspaceId: 'w1',
    type: type,
    title: title,
    referenceId: referenceId,
    note: note,
    metadata: metadata,
    now: now,
  );
  return built.copyWith(status: status);
}

void main() {
  group('createReport / mutators', () {
    test('defaults to draft status, standard template, version 1', () {
      final r = createReport(reportId: 'r1', workspaceId: 'w1', userId: 'u1', entityIds: const ['Q1'], now: now);
      expect(r.status, ReportStatus.draft);
      expect(r.template, ReportTemplate.standard);
      expect(r.version, 1);
      expect(r.title, 'Untitled report');
    });

    test('rename ignores a blank title', () {
      final r = createReport(reportId: 'r1', workspaceId: 'w1', userId: 'u1', entityIds: const [], now: now);
      expect(renameReport(r, '   ', later).title, r.title);
      expect(renameReport(r, 'Final report', later).title, 'Final report');
    });

    test('archiveReport is idempotent', () {
      final r = createReport(reportId: 'r1', workspaceId: 'w1', userId: 'u1', entityIds: const [], now: now);
      final archived = archiveReport(r, later);
      expect(archived.status, ReportStatus.archived);
      expect(archiveReport(archived, later), same(archived));
    });
  });

  group('summarizeSelection', () {
    test('counts each status and flags needs-review', () {
      final items = [
        item(type: ResearchItemType.evidence, status: FindingStatus.included),
        item(type: ResearchItemType.evidence, status: FindingStatus.excluded),
        item(type: ResearchItemType.claim, status: FindingStatus.needsReview),
      ];
      final summary = summarizeSelection(items);
      expect(summary.excludedCount, 1);
      expect(summary.needsReviewCount, 1);
      expect(summary.hasNeedsReview, isTrue);
    });
  });

  group('buildCitations', () {
    test('dedupes identical source URLs into one numbered citation', () {
      final items = [
        item(type: ResearchItemType.evidence, title: 'Story A', metadata: const {'sourceName': 'Reuters', 'sourceUrl': 'https://reuters.com/1'}),
        item(type: ResearchItemType.evidence, title: 'Story A (again)', metadata: const {'sourceName': 'Reuters', 'sourceUrl': 'https://reuters.com/1'}),
      ];
      final citations = buildCitations(items);
      expect(citations, hasLength(1));
      expect(citations.first.number, 1);
    });

    test('a claim or note item never produces a citation', () {
      final items = [item(type: ResearchItemType.claim), item(type: ResearchItemType.note)];
      expect(buildCitations(items), isEmpty);
    });
  });

  group('generateReport', () {
    test('excludes needsReview and excluded items from every section', () {
      final included = item(type: ResearchItemType.controversy, title: 'Included controversy', status: FindingStatus.included);
      final needsReview = item(type: ResearchItemType.controversy, title: 'Unreviewed controversy', status: FindingStatus.needsReview);
      final excluded = item(type: ResearchItemType.controversy, title: 'Excluded controversy', status: FindingStatus.excluded);
      final result = generateReport(items: [included, needsReview, excluded], entities: const [], now: now);
      final controversySection = result.sections.where((s) => s.kind == ReportSectionKind.controversies).firstOrNull;
      final text = controversySection?.blocks.map((b) => b.text).join(' ') ?? '';
      expect(text, contains('Included controversy'));
      expect(text, isNot(contains('Unreviewed controversy')));
      expect(text, isNot(contains('Excluded controversy')));
    });

    test('surfaces a needs-review warning in the executive summary without blocking generation', () {
      final items = [item(type: ResearchItemType.claim, status: FindingStatus.needsReview)];
      final result = generateReport(items: items, entities: const [], now: now);
      expect(result.selection.hasNeedsReview, isTrue);
      final summary = result.sections.where((s) => s.kind == ReportSectionKind.executiveSummary).firstOrNull;
      expect(summary?.blocks.any((b) => b.kind == ContentBlockKind.limitation && b.text.contains('Needs Review')), isTrue);
    });

    test('never produces an empty section', () {
      final result = generateReport(items: const [], entities: const [], now: now);
      for (final s in result.sections) {
        expect(s.blocks, isNotEmpty);
      }
      expect(
        result.sections.every(
          (s) => s.kind == ReportSectionKind.conclusion || s.kind == ReportSectionKind.executiveSummary || s.kind == ReportSectionKind.methodology,
        ),
        isTrue,
      );
    });

    test('a claim block shows the status/confidence exactly as saved on the item, never recomputed', () {
      final claim = item(
        type: ResearchItemType.claim,
        title: 'Denial statement',
        metadata: const {'status': 'conflicting', 'confidence': 'medium', 'evidenceCount': 3},
        status: FindingStatus.included,
      );
      final result = generateReport(items: [claim], entities: const [], now: now);
      final claimsSection = result.sections.where((s) => s.kind == ReportSectionKind.claims).firstOrNull;
      final text = claimsSection?.blocks.first.text ?? '';
      expect(text, contains('conflicting'));
      expect(text, contains('medium'));
      expect(text, contains('3 source(s)'));
    });

    test('a user note on a claim is labeled userNote, never fact', () {
      final claim = item(type: ResearchItemType.claim, title: 'X', note: 'Needs a second source.', status: FindingStatus.included);
      final result = generateReport(items: [claim], entities: const [], now: now);
      final claimsSection = result.sections.where((s) => s.kind == ReportSectionKind.claims).firstOrNull;
      final noteBlock = claimsSection?.blocks.where((b) => b.kind == ContentBlockKind.userNote).firstOrNull;
      expect(noteBlock?.text, contains('second source'));
    });

    test('a controversy already present is not duplicated as a major event', () {
      final controversy = item(type: ResearchItemType.controversy, title: 'Fraud allegations', referenceId: 'fraud-allegations', status: FindingStatus.included);
      final changeEvent = item(
        type: ResearchItemType.changeEvent,
        title: 'Fraud allegations',
        referenceId: 'fraud-allegations',
        metadata: const {'changeType': 'CONTROVERSY_CHANGE'},
        status: FindingStatus.included,
      );
      final result = generateReport(items: [controversy, changeEvent], entities: const [], now: now);
      expect(result.sections.any((s) => s.kind == ReportSectionKind.majorEvents), isFalse);
    });

    test('data coverage reports only real gaps, never invents complete coverage', () {
      const entities = [
        EntityReportContext(
          entityId: 'Q1',
          entityName: 'Jane Doe',
          coverageReport: CoverageReport(
            coverageVersion: 'coverage-1',
            dimensions: [
              CoverageDimension(key: CoverageDimensionKey.identity, level: CoverageLevel.unavailable, status: DataStatus.unavailable, reasons: ['No pageview data retrieved.']),
              CoverageDimension(key: CoverageDimensionKey.news, level: CoverageLevel.high, status: DataStatus.available, reasons: ['12 articles']),
            ],
          ),
        ),
      ];
      final result = generateReport(items: const [], entities: entities, now: now);
      final coverage = result.sections.where((s) => s.kind == ReportSectionKind.dataCoverage).firstOrNull;
      expect(coverage?.blocks.first.text, contains('Identity'));
      expect(coverage?.blocks.first.kind, ContentBlockKind.limitation);
      expect(coverage?.blocks.any((b) => b.text.contains('News')), isFalse);
    });

    test('sparse or absent historical data produces no fabricated history section', () {
      const entities = [
        EntityReportContext(
          entityId: 'Q1',
          entityName: 'Jane Doe',
          historicalOverview: HistoricalOverview(
            entityId: 'Q1',
            firstSnapshotDate: null,
            latestSnapshotDate: null,
            snapshotCount: 0,
            supportedRanges: [],
            coverage: [],
            turningPoints: [],
            hasHistory: false,
          ),
        ),
      ];
      final result = generateReport(items: const [], entities: entities, now: now);
      expect(result.sections.any((s) => s.kind == ReportSectionKind.sentimentHistory), isFalse);
      expect(result.sections.any((s) => s.kind == ReportSectionKind.critiscoreHistory), isFalse);
    });
  });
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}
