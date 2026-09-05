/// Historical Intelligence — the Dart twin of `site/lib/historical.ts`.
/// Answers "what has happened to this person over time" by assembling a
/// composite view over data every other system already computes:
/// measured sentiment snapshots (`celebrity.sentimentData.trendData`),
/// the deterministic CritiScore reconstruction (`indexHistory`/
/// `indexAsOf` in `controversy_index.dart`), the dated career timeline
/// (`celebrity.facts.career`), and Change Detection's own log
/// (`changes.dart`).
///
/// Nothing here is a new score, a new fetch, or a new stored collection.
/// Every field is either copied from an already-measured point
/// (sentiment) or recomputed deterministically from already-dated
/// records — the same "reconstruction, not a stored snapshot" honesty
/// `controversy_index.dart` already documents for `indexHistory`. Where
/// a dimension has no real anchor at a given point, its field is null
/// and that is disclosed, never backfilled or interpolated.
library;

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';

const String kHistoricalMethodologyVersion = 'historical-1';

// ── Snapshot model ──────────────────────────────────────────────────

/// One point in a person's history, anchored to a real measured
/// sentiment-snapshot date. Every other field is an "as of that date"
/// overlay from a different deterministic system, at that system's own
/// real granularity — never invented to match the sentiment date's
/// daily resolution.
class HistoricalSnapshot {
  const HistoricalSnapshot({
    required this.snapshotId,
    required this.entityId,
    required this.capturedAt,
    required this.effectiveDate,
    required this.profileVersion,
    required this.critiScore,
    required this.critiScoreYear,
    required this.sentimentScore,
    required this.sentimentMentions,
    required this.currentRole,
    required this.organizations,
    required this.controversyCount,
    required this.claimCount,
    required this.methodologyVersion,
  });

  final String snapshotId;
  final String entityId;

  /// The real date this point is anchored to — a measured sentiment
  /// snapshot's own date, never a guess.
  final String capturedAt;

  /// Same as [capturedAt] today; kept separate so a future
  /// backend-authoritative snapshot store can populate it independently
  /// without a shape change.
  final String effectiveDate;
  final String profileVersion;

  /// Deterministic CritiScore reconstruction for [capturedAt]'s
  /// calendar year. Null when there are no controversies to score.
  /// Yearly resolution — disclosed via [critiScoreYear].
  final double? critiScore;
  final int? critiScoreYear;

  final double sentimentScore;
  final int sentimentMentions;

  /// Career state as of [capturedAt]'s year, from dated [CareerEntry]
  /// rows only.
  final String? currentRole;
  final List<String> organizations;

  final int controversyCount;
  final int claimCount;
  final String methodologyVersion;
}

int _yearOf(String dateIso) {
  final y = int.tryParse(dateIso.length >= 4 ? dateIso.substring(0, 4) : '');
  return y ?? DateTime.now().year;
}

class _CareerAsOf {
  const _CareerAsOf(this.role, this.organizations);
  final String? role;
  final List<String> organizations;
}

_CareerAsOf _careerAsOf(List<CareerEntry> timeline, int year) {
  final known = timeline.where((e) => e.start != null && e.start! <= year).toList()
    ..sort((a, b) => (a.start ?? 0).compareTo(b.start ?? 0));
  if (known.isEmpty) return const _CareerAsOf(null, []);
  final latest = known.last;
  final parts = [latest.role, latest.organization].whereType<String>().toList();
  final role = parts.isEmpty ? null : parts.join(', ');
  final organizations = known.map((e) => e.organization).whereType<String>().toSet().toList();
  return _CareerAsOf(role, organizations);
}

List<Controversy> _controversiesAsOf(List<Controversy> controversies, int year) {
  return controversies.where((c) => c.year == null || c.year! <= year).toList();
}

/// Builds the reconstructed historical series for a profile. Empty when
/// there are fewer than two measured sentiment snapshots — a single
/// point has no history to show a shape across, matching `indexHistory`'s
/// own "need at least two" convention.
List<HistoricalSnapshot> buildHistoricalSnapshots(
  Celebrity celebrity,
  List<Claim> claims,
) {
  final anchors = celebrity.sentimentData.trendData.where((t) => t.date.isNotEmpty).toList()
    ..sort((a, b) => a.date.compareTo(b.date));
  if (anchors.length < 2) return const [];

  return anchors.map((point) {
    final year = _yearOf(point.date);
    final career = _careerAsOf(celebrity.facts.career, year);
    final controversiesToDate = _controversiesAsOf(celebrity.biography.controversies, year);
    final claimIds = controversiesToDate.map((c) => titleSlug(c.title)).toSet();
    final claimCount = claims.where((c) => claimIds.contains(c.controversyId)).length;
    final critiScore =
        controversiesToDate.isNotEmpty ? indexAsOf(controversiesToDate, year).score : null;

    return HistoricalSnapshot(
      snapshotId: '${celebrity.slug}-${point.date}',
      entityId: celebrity.slug,
      capturedAt: point.date,
      effectiveDate: point.date,
      profileVersion: kHistoricalMethodologyVersion,
      critiScore: critiScore,
      critiScoreYear: critiScore != null ? year : null,
      sentimentScore: point.score,
      sentimentMentions: point.totalMentions,
      currentRole: career.role,
      organizations: career.organizations,
      controversyCount: controversiesToDate.length,
      claimCount: claimCount,
      methodologyVersion: kHistoricalMethodologyVersion,
    );
  }).toList();
}

// ── Time ranges ───────────────────────────────────────────────────────

enum HistoricalTimeRange { d7, d30, d90, y1, y3, y5, all }

extension HistoricalTimeRangeLabel on HistoricalTimeRange {
  String get label => switch (this) {
    HistoricalTimeRange.d7 => 'Past 7 days',
    HistoricalTimeRange.d30 => 'Past 30 days',
    HistoricalTimeRange.d90 => 'Past 90 days',
    HistoricalTimeRange.y1 => 'Past year',
    HistoricalTimeRange.y3 => 'Past 3 years',
    HistoricalTimeRange.y5 => 'Past 5 years',
    HistoricalTimeRange.all => 'All time',
  };
}

const Map<HistoricalTimeRange, int> _rangeDays = {
  HistoricalTimeRange.d7: 7,
  HistoricalTimeRange.d30: 30,
  HistoricalTimeRange.d90: 90,
  HistoricalTimeRange.y1: 365,
  HistoricalTimeRange.y3: 365 * 3,
  HistoricalTimeRange.y5: 365 * 5,
};

List<HistoricalSnapshot> filterSnapshotsByRange(
  List<HistoricalSnapshot> snapshots,
  HistoricalTimeRange range, {
  DateTime? now,
}) {
  if (range == HistoricalTimeRange.all) return snapshots;
  final n = now ?? DateTime.now();
  final cutoff = n.subtract(Duration(days: _rangeDays[range]!));
  return snapshots.where((s) {
    final d = DateTime.tryParse(s.capturedAt);
    return d != null && !d.isBefore(cutoff);
  }).toList();
}

/// Which ranges are actually worth offering — a period the data cannot
/// support is omitted rather than shown empty. "all" is offered whenever
/// there is any history at all.
List<HistoricalTimeRange> supportedTimeRanges(
  List<HistoricalSnapshot> snapshots, {
  DateTime? now,
}) {
  if (snapshots.length < 2) return const [];
  final n = now ?? DateTime.now();
  final dates = snapshots.map((s) => DateTime.tryParse(s.capturedAt)).whereType<DateTime>();
  final earliest = dates.reduce((a, b) => a.isBefore(b) ? a : b);
  final spanDays = n.difference(earliest).inDays;

  final ranges = <HistoricalTimeRange>[];
  for (final r in _rangeDays.keys) {
    if (spanDays >= _rangeDays[r]! * 0.5 && filterSnapshotsByRange(snapshots, r, now: n).length >= 2) {
      ranges.add(r);
    }
  }
  ranges.add(HistoricalTimeRange.all);
  return ranges;
}

// ── Per-dimension historical coverage ───────────────────────────────

enum HistoricalDimensionKey { sentiment, critiScore, career, controversies, claims }

extension HistoricalDimensionKeyLabel on HistoricalDimensionKey {
  String get label => switch (this) {
    HistoricalDimensionKey.sentiment => 'Sentiment History',
    HistoricalDimensionKey.critiScore => 'CritiScore History',
    HistoricalDimensionKey.career => 'Career History',
    HistoricalDimensionKey.controversies => 'Controversy History',
    HistoricalDimensionKey.claims => 'Claim History',
  };
}

class HistoricalDimensionCoverage {
  const HistoricalDimensionCoverage({
    required this.key,
    required this.level,
    required this.status,
    required this.reasons,
  });
  final HistoricalDimensionKey key;
  final CoverageLevel level;
  final DataStatus status;
  final List<String> reasons;
  String get label => key.label;
}

/// Coverage for the historical view itself — distinct from
/// `coverage.dart`'s per-dimension report, which rates *current* data.
/// A provider outage today is never read as "this person has no
/// history" here: coverage is judged only by how much real dated
/// history already exists.
List<HistoricalDimensionCoverage> buildHistoricalCoverage(
  List<HistoricalSnapshot> snapshots,
  List<IndexHistoryPoint> history,
  List<CareerEntry> career,
  List<Controversy> controversies,
  List<Claim> claims,
) {
  final n = snapshots.length;
  final sentiment = n == 0
      ? const HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.sentiment,
          level: CoverageLevel.unavailable,
          status: DataStatus.unavailable,
          reasons: ['No measured sentiment history yet.'],
        )
      : HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.sentiment,
          level: n >= 30 ? CoverageLevel.high : n >= 7 ? CoverageLevel.medium : CoverageLevel.low,
          status: n < 2 ? DataStatus.insufficient : DataStatus.available,
          reasons: ['$n measured snapshot${n == 1 ? '' : 's'}'],
        );

  final critiScore = history.isEmpty
      ? const HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.critiScore,
          level: CoverageLevel.unavailable,
          status: DataStatus.unavailable,
          reasons: ['Not enough dated controversies to reconstruct a score history.'],
        )
      : HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.critiScore,
          level: history.length >= 5
              ? CoverageLevel.high
              : history.length >= 2
                  ? CoverageLevel.medium
                  : CoverageLevel.low,
          status: DataStatus.available,
          reasons: [
            '${history.length} year${history.length == 1 ? '' : 's'} reconstructed '
                '(${history.first.year}–${history.last.year})',
          ],
        );

  final datedCareer = career.where((e) => e.start != null).toList();
  final careerCov = datedCareer.isEmpty
      ? const HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.career,
          level: CoverageLevel.unavailable,
          status: DataStatus.unavailable,
          reasons: ['No dated career entries.'],
        )
      : HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.career,
          level: datedCareer.length >= 4
              ? CoverageLevel.high
              : datedCareer.length >= 2
                  ? CoverageLevel.medium
                  : CoverageLevel.low,
          status: DataStatus.available,
          reasons: ['${datedCareer.length} dated role${datedCareer.length == 1 ? '' : 's'}'],
        );

  final controversiesCov = controversies.isEmpty
      ? const HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.controversies,
          level: CoverageLevel.unavailable,
          status: DataStatus.unavailable,
          reasons: ['No documented controversies.'],
        )
      : HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.controversies,
          level: controversies.length >= 5
              ? CoverageLevel.high
              : controversies.length >= 2
                  ? CoverageLevel.medium
                  : CoverageLevel.low,
          status: DataStatus.available,
          reasons: ['${controversies.length} episode${controversies.length == 1 ? '' : 's'} on record'],
        );

  final claimsCov = claims.isEmpty
      ? const HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.claims,
          level: CoverageLevel.unavailable,
          status: DataStatus.unavailable,
          reasons: ['No claims extracted from evidence.'],
        )
      : HistoricalDimensionCoverage(
          key: HistoricalDimensionKey.claims,
          level: claims.length >= 5
              ? CoverageLevel.high
              : claims.length >= 2
                  ? CoverageLevel.medium
                  : CoverageLevel.low,
          status: DataStatus.available,
          reasons: ['${claims.length} claim${claims.length == 1 ? '' : 's'} tracked'],
        );

  return [sentiment, critiScore, careerCov, controversiesCov, claimsCov];
}

// ── Major turning points ─────────────────────────────────────────────

enum TurningPointKind { score, career, controversy, sentiment, change }

class TurningPoint {
  const TurningPoint({
    required this.id,
    required this.kind,
    required this.date,
    required this.title,
    required this.summary,
    this.relatedChangeId,
  });
  final String id;
  final TurningPointKind kind;
  final String date;
  final String title;
  final String summary;
  final String? relatedChangeId;
}

/// Turning points reuse existing real signals only: year-over-year
/// CritiScore reconstruction deltas above a real threshold, dated career
/// transitions, and any major/significant [ChangeEvent]s already
/// detected. No new score, no prediction.
List<TurningPoint> majorTurningPoints(
  List<IndexHistoryPoint> history,
  List<CareerEntry> career,
  List<ChangeEvent> changeEvents,
) {
  final points = <TurningPoint>[];

  for (var i = 1; i < history.length; i++) {
    final delta = history[i].score - history[i - 1].score;
    if (delta.abs() < 15) continue;
    points.add(
      TurningPoint(
        id: 'score-${history[i].year}',
        kind: TurningPointKind.score,
        date: '${history[i].year}',
        title: 'CritiScore ${delta > 0 ? 'rose' : 'fell'} sharply in ${history[i].year}',
        summary:
            'Reconstructed score moved from ${history[i - 1].score.round()} to ${history[i].score.round()}.',
      ),
    );
  }

  for (final e in career) {
    if (e.start == null || (e.role == null && e.organization == null)) continue;
    final label = [e.role, e.organization].whereType<String>().join(', ');
    points.add(
      TurningPoint(
        id: 'career-${e.start}-${e.organization ?? e.role}',
        kind: TurningPointKind.career,
        date: '${e.start}',
        title: label,
        summary: e.isCurrent ? 'Ongoing since this date.' : 'A dated career transition.',
      ),
    );
  }

  for (final c in changeEvents) {
    if (c.severity != ChangeSeverity.major && c.severity != ChangeSeverity.significant) continue;
    final kind = c.changeType == ChangeType.critiscoreChange
        ? TurningPointKind.score
        : c.changeType == ChangeType.sentimentChange
            ? TurningPointKind.sentiment
            : c.changeType == ChangeType.controversyChange
                ? TurningPointKind.controversy
                : TurningPointKind.change;
    points.add(
      TurningPoint(
        id: c.changeId,
        kind: kind,
        date: c.effectiveDate ?? c.detectedAt.toIso8601String(),
        title: c.title,
        summary: c.summary,
        relatedChangeId: c.changeId,
      ),
    );
  }

  points.sort((a, b) => a.date.compareTo(b.date));
  return points;
}

// ── Period comparison ─────────────────────────────────────────────────

class PeriodComparison {
  const PeriodComparison({
    required this.rangeA,
    required this.rangeB,
    required this.startScoreA,
    required this.endScoreA,
    required this.startScoreB,
    required this.endScoreB,
    required this.sentimentDeltaA,
    required this.sentimentDeltaB,
    required this.controversyCountA,
    required this.controversyCountB,
  });
  final HistoricalTimeRange rangeA;
  final HistoricalTimeRange rangeB;
  final double? startScoreA;
  final double? endScoreA;
  final double? startScoreB;
  final double? endScoreB;
  final double? sentimentDeltaA;
  final double? sentimentDeltaB;
  final int controversyCountA;
  final int controversyCountB;
}

class _RangeSummary {
  const _RangeSummary(this.startScore, this.endScore, this.sentimentDelta, this.controversyCount);
  final double? startScore;
  final double? endScore;
  final double? sentimentDelta;
  final int controversyCount;
}

_RangeSummary _summarizeRange(List<HistoricalSnapshot> snapshots) {
  if (snapshots.isEmpty) return const _RangeSummary(null, null, null, 0);
  final first = snapshots.first;
  final last = snapshots.last;
  return _RangeSummary(
    first.critiScore,
    last.critiScore,
    last.sentimentScore - first.sentimentScore,
    last.controversyCount,
  );
}

/// Compares two (typically non-overlapping) periods over the same
/// snapshot series. A period with no snapshots reports nulls rather
/// than a fabricated zero.
PeriodComparison comparePeriods(
  List<HistoricalSnapshot> snapshots,
  HistoricalTimeRange rangeA,
  HistoricalTimeRange rangeB, {
  DateTime? now,
}) {
  final a = _summarizeRange(filterSnapshotsByRange(snapshots, rangeA, now: now));
  final b = _summarizeRange(filterSnapshotsByRange(snapshots, rangeB, now: now));
  return PeriodComparison(
    rangeA: rangeA,
    rangeB: rangeB,
    startScoreA: a.startScore,
    endScoreA: a.endScore,
    startScoreB: b.startScore,
    endScoreB: b.endScore,
    sentimentDeltaA: a.sentimentDelta,
    sentimentDeltaB: b.sentimentDelta,
    controversyCountA: a.controversyCount,
    controversyCountB: b.controversyCount,
  );
}

// ── Historical events filter ─────────────────────────────────────────

List<TurningPoint> filterTurningPoints(List<TurningPoint> points, TurningPointKind? filter) {
  if (filter == null) return points;
  return points.where((p) => p.kind == filter).toList();
}

// ── Historical Overview ───────────────────────────────────────────────

class HistoricalOverview {
  const HistoricalOverview({
    required this.entityId,
    required this.firstSnapshotDate,
    required this.latestSnapshotDate,
    required this.snapshotCount,
    required this.supportedRanges,
    required this.coverage,
    required this.turningPoints,
    required this.hasHistory,
  });
  final String entityId;
  final String? firstSnapshotDate;
  final String? latestSnapshotDate;
  final int snapshotCount;
  final List<HistoricalTimeRange> supportedRanges;
  final List<HistoricalDimensionCoverage> coverage;
  final List<TurningPoint> turningPoints;

  /// True only when there is at least one real snapshot, score history
  /// point, or turning point — an entity with zero history gets an
  /// explicit empty state, never a fabricated "first known state".
  final bool hasHistory;
}

HistoricalOverview buildHistoricalOverview({
  required Celebrity celebrity,
  required List<Claim> claims,
  required List<ChangeEvent> changeEvents,
  DateTime? now,
}) {
  final snapshots = buildHistoricalSnapshots(celebrity, claims);
  final history = indexHistory(celebrity.biography.controversies);
  final coverage = buildHistoricalCoverage(
    snapshots,
    history,
    celebrity.facts.career,
    celebrity.biography.controversies,
    claims,
  );
  final turningPoints = majorTurningPoints(history, celebrity.facts.career, changeEvents);

  return HistoricalOverview(
    entityId: celebrity.slug,
    firstSnapshotDate: snapshots.isEmpty ? null : snapshots.first.capturedAt,
    latestSnapshotDate: snapshots.isEmpty ? null : snapshots.last.capturedAt,
    snapshotCount: snapshots.length,
    supportedRanges: supportedTimeRanges(snapshots, now: now),
    coverage: coverage,
    turningPoints: turningPoints,
    hasHistory: snapshots.isNotEmpty || history.isNotEmpty || turningPoints.isNotEmpty,
  );
}
