/// Advanced Compare — the Dart twin of `site/lib/compare.ts`. Puts two
/// resolved entities side by side using intelligence every other
/// system already computes. Never scores, ranks, or judges — every row
/// describes a real difference and traces to a real field on an
/// already-built [EntityComparisonContext]. Answers "how do these
/// entities differ", never "who is better".
library;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/core/utils/relationships.dart';

const String kCompareMethodologyVersion = 'compare-1';

// ── Comparison model ─────────────────────────────────────────────────

enum ComparisonTopic { all, career, organization, controversy, claims, news, sentiment, attention, critiscore }

enum ComparisonDataMode { all, highConfidence, mediumPlus, evidenceBacked }

class ComparisonFilters {
  const ComparisonFilters({this.topic = ComparisonTopic.all, this.dataMode = ComparisonDataMode.all});
  final ComparisonTopic topic;
  final ComparisonDataMode dataMode;

  ComparisonFilters copyWith({ComparisonTopic? topic, ComparisonDataMode? dataMode}) =>
      ComparisonFilters(topic: topic ?? this.topic, dataMode: dataMode ?? this.dataMode);
}

class Comparison {
  const Comparison({
    required this.comparisonId,
    required this.userId,
    required this.entityIds,
    required this.title,
    required this.createdAt,
    required this.updatedAt,
    required this.filters,
    required this.timeRange,
    required this.methodologyVersion,
  });

  final String comparisonId;
  final String userId;
  final List<String> entityIds;
  final String title;
  final DateTime createdAt;
  final DateTime updatedAt;
  final ComparisonFilters filters;
  final HistoricalTimeRange timeRange;
  final String methodologyVersion;

  Comparison copyWith({String? title, DateTime? updatedAt, ComparisonFilters? filters, HistoricalTimeRange? timeRange}) =>
      Comparison(
        comparisonId: comparisonId,
        userId: userId,
        entityIds: entityIds,
        title: title ?? this.title,
        createdAt: createdAt,
        updatedAt: updatedAt ?? this.updatedAt,
        filters: filters ?? this.filters,
        timeRange: timeRange ?? this.timeRange,
        methodologyVersion: methodologyVersion,
      );
}

String _titleForEntities(List<String> names) {
  if (names.length < 2) return 'Untitled comparison';
  return '${names.first} vs ${names.skip(1).join(", ")}';
}

Comparison createComparison({
  required String comparisonId,
  required String userId,
  required List<String> entityIds,
  List<String> entityNames = const [],
  String? title,
  required DateTime now,
}) => Comparison(
  comparisonId: comparisonId,
  userId: userId,
  entityIds: entityIds,
  title: (title?.trim().isNotEmpty ?? false) ? title!.trim() : _titleForEntities(entityNames),
  createdAt: now,
  updatedAt: now,
  filters: const ComparisonFilters(),
  timeRange: HistoricalTimeRange.y1,
  methodologyVersion: kCompareMethodologyVersion,
);

Comparison renameComparison(Comparison c, String title, DateTime now) {
  final trimmed = title.trim();
  if (trimmed.isEmpty) return c;
  return c.copyWith(title: trimmed, updatedAt: now);
}

Comparison updateComparisonFilters(Comparison c, {ComparisonTopic? topic, ComparisonDataMode? dataMode, required DateTime now}) =>
    c.copyWith(filters: c.filters.copyWith(topic: topic, dataMode: dataMode), updatedAt: now);

Comparison updateComparisonTimeRange(Comparison c, HistoricalTimeRange range, DateTime now) =>
    c.copyWith(timeRange: range, updatedAt: now);

// ── Per-entity context ──────────────────────────────────────────────

class ComparisonAttentionSummary {
  const ComparisonAttentionSummary({required this.peakDate, required this.peakViews, required this.latestViews, required this.changePct});
  final String peakDate;
  final int peakViews;
  final int latestViews;
  final double changePct;
}

class EntityComparisonContext {
  const EntityComparisonContext({
    required this.entityId,
    required this.entityName,
    this.profession,
    this.country,
    this.currentRole,
    this.industries = const [],
    this.watchStatus = false,
    this.critiScore,
    this.critiScoreBandLabel,
    this.critiScoreHistory = const [],
    this.sentimentScore,
    this.sentimentBandLabel,
    this.career = const [],
    this.organizations = const [],
    this.controversies = const [],
    this.claims = const [],
    this.meaningfulNewsCount = 0,
    this.coverageReport,
    this.historicalOverview,
    this.attentionSummary,
    this.relationships = const [],
  });

  final String entityId;
  final String entityName;
  final String? profession;
  final String? country;
  final String? currentRole;
  final List<String> industries;
  final bool watchStatus;
  final double? critiScore;
  final String? critiScoreBandLabel;
  final List<IndexHistoryPoint> critiScoreHistory;
  final double? sentimentScore;
  final String? sentimentBandLabel;
  final List<CareerEntry> career;
  final List<String> organizations;
  final List<Controversy> controversies;
  final List<Claim> claims;
  final int meaningfulNewsCount;
  final CoverageReport? coverageReport;
  final HistoricalOverview? historicalOverview;
  final ComparisonAttentionSummary? attentionSummary;
  final List<EntityRelationship> relationships;
}

// ── Rows ─────────────────────────────────────────────────────────────

class ComparisonRow {
  const ComparisonRow({
    required this.rowId,
    required this.topic,
    required this.metric,
    required this.valueA,
    required this.valueB,
    this.note,
    this.evidenceBacked = false,
  });
  final String rowId;
  final ComparisonTopic topic;
  final String metric;
  final String valueA;
  final String valueB;
  final String? note;
  final bool evidenceBacked;
}

ComparisonRow _row({
  required String rowId,
  required ComparisonTopic topic,
  required String metric,
  Object? valueA,
  Object? valueB,
  String? note,
  bool evidenceBacked = false,
}) => ComparisonRow(
  rowId: rowId,
  topic: topic,
  metric: metric,
  valueA: valueA == null ? 'Unavailable' : '$valueA',
  valueB: valueB == null ? 'Unavailable' : '$valueB',
  note: note,
  evidenceBacked: evidenceBacked,
);

/// The only comparative-language generator in this module — every call
/// site passes a real numeric delta, never free text.
String? _countDifference(String nameA, String nameB, String noun, int a, int b) {
  if (a == b) return null;
  final diff = (a - b).abs();
  final leader = a > b ? nameA : nameB;
  return '$leader has $diff more $noun in the selected scope.';
}

String? _valueDifference(String nameA, String nameB, String label, double a, double b) {
  if (a == b) return null;
  final leader = a > b ? nameA : nameB;
  final diff = (a - b).abs();
  return '$leader has a higher $label (by ${diff.toStringAsFixed(0)}).';
}

// ── Section builders ─────────────────────────────────────────────────

bool _inRange(String? dateIso, HistoricalTimeRange range, DateTime now) {
  if (dateIso == null) return true;
  if (range == HistoricalTimeRange.all) return true;
  const days = {
    HistoricalTimeRange.d7: 7,
    HistoricalTimeRange.d30: 30,
    HistoricalTimeRange.d90: 90,
    HistoricalTimeRange.y1: 365,
    HistoricalTimeRange.y3: 365 * 3,
    HistoricalTimeRange.y5: 365 * 5,
  };
  final parsed = DateTime.tryParse(dateIso);
  if (parsed == null) return true;
  final cutoff = now.subtract(Duration(days: days[range] ?? 365));
  return !parsed.isBefore(cutoff);
}

List<ComparisonRow> _critiscoreRows(EntityComparisonContext a, EntityComparisonContext b) {
  final rows = <ComparisonRow>[
    _row(
      rowId: 'critiscore-current',
      topic: ComparisonTopic.critiscore,
      metric: 'CritiScore',
      valueA: a.critiScore != null ? '${a.critiScore!.round()} — ${a.critiScoreBandLabel ?? ""}' : null,
      valueB: b.critiScore != null ? '${b.critiScore!.round()} — ${b.critiScoreBandLabel ?? ""}' : null,
      note: (a.critiScore != null && b.critiScore != null)
          ? _valueDifference(a.entityName, b.entityName, 'current CritiScore', a.critiScore!, b.critiScore!)
          : null,
      evidenceBacked: true,
    ),
  ];
  if (a.critiScoreHistory.isNotEmpty || b.critiScoreHistory.isNotEmpty) {
    rows.add(
      _row(
        rowId: 'critiscore-history',
        topic: ComparisonTopic.critiscore,
        metric: 'CritiScore history reconstructed',
        valueA: a.critiScoreHistory.isNotEmpty ? '${a.critiScoreHistory.length} year(s)' : null,
        valueB: b.critiScoreHistory.isNotEmpty ? '${b.critiScoreHistory.length} year(s)' : null,
        note: _countDifference(a.entityName, b.entityName, 'year(s) of reconstructed CritiScore history', a.critiScoreHistory.length, b.critiScoreHistory.length),
      ),
    );
  }
  return rows;
}

List<ComparisonRow> _sentimentRows(EntityComparisonContext a, EntityComparisonContext b) => [
  _row(
    rowId: 'sentiment-current',
    topic: ComparisonTopic.sentiment,
    metric: 'Current public sentiment',
    valueA: a.sentimentScore != null ? '${a.sentimentScore!.round()} (${a.sentimentBandLabel ?? ""})' : null,
    valueB: b.sentimentScore != null ? '${b.sentimentScore!.round()} (${b.sentimentBandLabel ?? ""})' : null,
    note: (a.sentimentScore != null && b.sentimentScore != null)
        ? _valueDifference(a.entityName, b.entityName, 'current sentiment score', a.sentimentScore!, b.sentimentScore!)
        : null,
  ),
];

List<ComparisonRow> _attentionRows(EntityComparisonContext a, EntityComparisonContext b) {
  if (a.attentionSummary == null && b.attentionSummary == null) return const [];
  return [
    _row(
      rowId: 'attention-latest',
      topic: ComparisonTopic.attention,
      metric: 'Latest Wikipedia pageviews',
      valueA: a.attentionSummary?.latestViews,
      valueB: b.attentionSummary?.latestViews,
      note: (a.attentionSummary != null && b.attentionSummary != null)
          ? _countDifference(a.entityName, b.entityName, 'recent page view(s)', a.attentionSummary!.latestViews, b.attentionSummary!.latestViews)
          : null,
    ),
  ];
}

List<ComparisonRow> _professionalRows(EntityComparisonContext a, EntityComparisonContext b) => [
  _row(rowId: 'profession', topic: ComparisonTopic.career, metric: 'Primary profession', valueA: a.profession, valueB: b.profession),
  _row(rowId: 'current-role', topic: ComparisonTopic.career, metric: 'Current role', valueA: a.currentRole, valueB: b.currentRole),
  _row(
    rowId: 'industries',
    topic: ComparisonTopic.career,
    metric: 'Industries',
    valueA: a.industries.isNotEmpty ? a.industries.join(', ') : null,
    valueB: b.industries.isNotEmpty ? b.industries.join(', ') : null,
  ),
];

List<ComparisonRow> _careerRows(EntityComparisonContext a, EntityComparisonContext b, HistoricalTimeRange range, DateTime now) {
  final aEntries = a.career.where((e) => e.start == null || _inRange('${e.start}-01-01', range, now)).toList();
  final bEntries = b.career.where((e) => e.start == null || _inRange('${e.start}-01-01', range, now)).toList();
  return [
    _row(
      rowId: 'career-transitions',
      topic: ComparisonTopic.career,
      metric: 'Documented career transitions (selected period)',
      valueA: aEntries.length,
      valueB: bEntries.length,
      note: _countDifference(a.entityName, b.entityName, 'documented career transition(s) in the selected period', aEntries.length, bEntries.length),
      evidenceBacked: aEntries.isNotEmpty || bEntries.isNotEmpty,
    ),
  ];
}

List<ComparisonRow> _organizationRows(EntityComparisonContext a, EntityComparisonContext b) {
  final aOrgs = a.organizations.toSet();
  final bOrgs = b.organizations.toSet();
  return [
    _row(
      rowId: 'organizations',
      topic: ComparisonTopic.organization,
      metric: 'Organizations on record',
      valueA: aOrgs.length,
      valueB: bOrgs.length,
      note: _countDifference(a.entityName, b.entityName, 'organization(s) on record', aOrgs.length, bOrgs.length),
    ),
  ];
}

List<ComparisonRow> _controversyRows(EntityComparisonContext a, EntityComparisonContext b, HistoricalTimeRange range, DateTime now) {
  final aIn = a.controversies.where((c) => _inRange(c.year != null ? '${c.year}-01-01' : null, range, now)).toList();
  final bIn = b.controversies.where((c) => _inRange(c.year != null ? '${c.year}-01-01' : null, range, now)).toList();
  int severe(List<Controversy> list, int min) => list.where((c) => c.severity >= min).length;
  return [
    _row(
      rowId: 'controversy-count',
      topic: ComparisonTopic.controversy,
      metric: 'Documented controversy episodes (selected period)',
      valueA: aIn.length,
      valueB: bIn.length,
      note: _countDifference(a.entityName, b.entityName, 'documented controversy record(s) in the available CritiTrack dataset', aIn.length, bIn.length),
      evidenceBacked: aIn.any((c) => c.sources.isNotEmpty) || bIn.any((c) => c.sources.isNotEmpty),
    ),
    _row(
      rowId: 'controversy-severe',
      topic: ComparisonTopic.controversy,
      metric: 'Severity 4–5 episodes',
      valueA: severe(aIn, 4),
      valueB: severe(bIn, 4),
      note: _countDifference(a.entityName, b.entityName, 'high-severity (4–5) documented controversy episode(s)', severe(aIn, 4), severe(bIn, 4)),
    ),
  ];
}

List<ComparisonRow> _claimRows(EntityComparisonContext a, EntityComparisonContext b) {
  int corroborated(List<Claim> list) =>
      list.where((c) => c.status == ClaimStatus.supported || c.status == ClaimStatus.resolvedAuthoritative).length;
  return [
    _row(
      rowId: 'claim-count',
      topic: ComparisonTopic.claims,
      metric: 'Documented claims in selected period',
      valueA: a.claims.length,
      valueB: b.claims.length,
      note: _countDifference(a.entityName, b.entityName, 'documented claim(s) in the selected period', a.claims.length, b.claims.length),
      evidenceBacked: true,
    ),
    _row(
      rowId: 'claim-corroborated',
      topic: ComparisonTopic.claims,
      metric: 'Corroborated / authoritatively resolved claims',
      valueA: corroborated(a.claims),
      valueB: corroborated(b.claims),
      note: _countDifference(a.entityName, b.entityName, 'corroborated or authoritatively resolved claim(s)', corroborated(a.claims), corroborated(b.claims)),
      evidenceBacked: true,
    ),
  ];
}

List<ComparisonRow> _newsRows(EntityComparisonContext a, EntityComparisonContext b) => [
  _row(
    rowId: 'news-events',
    topic: ComparisonTopic.news,
    metric: 'Meaningful news events (selected period)',
    valueA: a.meaningfulNewsCount,
    valueB: b.meaningfulNewsCount,
    note: _countDifference(a.entityName, b.entityName, 'meaningful news event(s) in the selected period', a.meaningfulNewsCount, b.meaningfulNewsCount),
  ),
];

List<ComparisonRow> _turningPointRows(EntityComparisonContext a, EntityComparisonContext b) {
  final aPoints = a.historicalOverview?.turningPoints ?? const [];
  final bPoints = b.historicalOverview?.turningPoints ?? const [];
  if (aPoints.isEmpty && bPoints.isEmpty) return const [];
  return [
    _row(
      rowId: 'turning-points',
      topic: ComparisonTopic.all,
      metric: 'Major turning points identified',
      valueA: aPoints.length,
      valueB: bPoints.length,
      note: _countDifference(a.entityName, b.entityName, 'major turning point(s) identified', aPoints.length, bPoints.length),
    ),
  ];
}

class EntityTurningPoints {
  const EntityTurningPoints({required this.entityId, required this.entityName, required this.points});
  final String entityId;
  final String entityName;
  final List<TurningPoint> points;
}

List<EntityTurningPoints> turningPointsFor(EntityComparisonContext a, EntityComparisonContext b) => [
  EntityTurningPoints(entityId: a.entityId, entityName: a.entityName, points: a.historicalOverview?.turningPoints ?? const []),
  EntityTurningPoints(entityId: b.entityId, entityName: b.entityName, points: b.historicalOverview?.turningPoints ?? const []),
];

List<ComparisonRow> _coverageRows(EntityComparisonContext a, EntityComparisonContext b) {
  if (a.coverageReport == null && b.coverageReport == null) return const [];
  final keys = <CoverageDimensionKey>{
    ...?a.coverageReport?.dimensions.map((d) => d.key),
    ...?b.coverageReport?.dimensions.map((d) => d.key),
  };
  final rows = <ComparisonRow>[];
  for (final key in keys) {
    final da = a.coverageReport?.dimensions.where((d) => d.key == key).firstOrNull;
    final db = b.coverageReport?.dimensions.where((d) => d.key == key).firstOrNull;
    if (da == null && db == null) continue;
    if (da?.level == db?.level) continue;
    rows.add(
      _row(
        rowId: 'coverage-${key.name}',
        topic: ComparisonTopic.all,
        metric: '${(da ?? db)!.key.label} coverage',
        valueA: da?.level.name.toUpperCase(),
        valueB: db?.level.name.toUpperCase(),
        note: 'Comparison for this dimension is limited by unequal available data.',
      ),
    );
  }
  return rows;
}

List<ComparisonRow> _evidenceRows(EntityComparisonContext a, EntityComparisonContext b) {
  final aBacked = a.controversies.where((c) => c.sources.isNotEmpty).length;
  final bBacked = b.controversies.where((c) => c.sources.isNotEmpty).length;
  return [
    _row(
      rowId: 'evidence-sourced-controversies',
      topic: ComparisonTopic.all,
      metric: 'Sourced controversy records',
      valueA: aBacked,
      valueB: bBacked,
      note: aBacked == bBacked
          ? null
          : '${aBacked > bBacked ? a.entityName : b.entityName} has stronger available corroboration for the selected controversy records.',
      evidenceBacked: true,
    ),
  ];
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}

// ── Assembly ─────────────────────────────────────────────────────────

class ComparisonSection {
  const ComparisonSection({required this.topic, required this.title, required this.rows});
  final ComparisonTopic topic;
  final String title;
  final List<ComparisonRow> rows;
}

const Map<ComparisonTopic, String> _kTopicLabel = {
  ComparisonTopic.critiscore: 'CritiScore',
  ComparisonTopic.sentiment: 'Sentiment',
  ComparisonTopic.attention: 'Attention',
  ComparisonTopic.career: 'Professional & Career',
  ComparisonTopic.organization: 'Organizations',
  ComparisonTopic.controversy: 'Controversies',
  ComparisonTopic.claims: 'Claims & Verification',
  ComparisonTopic.news: 'News & Public Coverage',
};

bool _passesDataMode(ComparisonRow r, ComparisonDataMode mode) {
  if (mode == ComparisonDataMode.all) return true;
  return r.evidenceBacked;
}

/// Builds every comparison section for two entities. Sections with no
/// rows are omitted entirely.
List<ComparisonSection> buildComparison({
  required EntityComparisonContext a,
  required EntityComparisonContext b,
  required ComparisonFilters filters,
  required HistoricalTimeRange timeRange,
  DateTime? now,
}) {
  final n = now ?? DateTime.now();

  final byTopic = <(ComparisonTopic, List<ComparisonRow>)>[
    (ComparisonTopic.critiscore, _critiscoreRows(a, b)),
    (ComparisonTopic.sentiment, _sentimentRows(a, b)),
    (ComparisonTopic.attention, _attentionRows(a, b)),
    (ComparisonTopic.career, [..._professionalRows(a, b), ..._careerRows(a, b, timeRange, n)]),
    (ComparisonTopic.organization, _organizationRows(a, b)),
    (ComparisonTopic.controversy, _controversyRows(a, b, timeRange, n)),
    (ComparisonTopic.claims, _claimRows(a, b)),
    (ComparisonTopic.news, _newsRows(a, b)),
  ];

  final extraRows = [..._turningPointRows(a, b), ..._coverageRows(a, b), ..._evidenceRows(a, b)];

  final sections = <ComparisonSection>[];
  for (final (topic, rows) in byTopic) {
    if (filters.topic != ComparisonTopic.all && filters.topic != topic) continue;
    final filtered = rows.where((r) => _passesDataMode(r, filters.dataMode)).toList();
    if (filtered.isEmpty) continue;
    sections.add(ComparisonSection(topic: topic, title: _kTopicLabel[topic]!, rows: filtered));
  }
  if (filters.topic == ComparisonTopic.all) {
    final filtered = extraRows.where((r) => _passesDataMode(r, filters.dataMode)).toList();
    if (filtered.isNotEmpty) {
      sections.add(ComparisonSection(topic: ComparisonTopic.all, title: 'Turning Points, Coverage & Evidence', rows: filtered));
    }
  }

  return sections;
}

/// A compact "key differences" list — the same rows' own `note` fields,
/// never a separate interpretive layer.
List<String> keyDifferences(List<ComparisonSection> sections, {int max = 5}) {
  final notes = sections.expand((s) => s.rows).map((r) => r.note).whereType<String>();
  return notes.take(max).toList();
}
