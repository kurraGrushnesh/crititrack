/// Deterministic "Controversy Index" — a 0–100 score summarising how
/// controversial a public figure is, derived entirely from the structured
/// [Controversy] list.
///
/// It is intentionally computed locally rather than asked from the LLM so
/// that it is reproducible, unit-testable, and free. The score rises with:
///   • higher individual severities,
///   • a greater number of distinct episodes (with diminishing returns),
///   • unresolved ("ongoing") status,
///   • recency.
library;

import '../domain/models/controversy.dart';

class ControversyIndex {
  const ControversyIndex({
    required this.score,
    required this.label,
    required this.ongoingCount,
    required this.peakSeverity,
    required this.total,
  });

  /// 0–100.
  final double score;

  /// Human-readable band for [score].
  final String label;

  /// How many episodes are currently unresolved.
  final int ongoingCount;

  /// Highest single-episode severity (0 when the list is empty).
  final int peakSeverity;

  /// Number of episodes considered.
  final int total;

  int get rounded => score.round();
}

/// Computes the index for [items]. [currentYear] is injectable for tests.
ControversyIndex computeControversyIndex(
  List<Controversy> items, {
  int? currentYear,
}) {
  if (items.isEmpty) {
    return const ControversyIndex(
      score: 0,
      label: 'No documented controversies',
      ongoingCount: 0,
      peakSeverity: 0,
      total: 0,
    );
  }

  final year = currentYear ?? DateTime.now().year;

  var weighted = 0.0;
  for (final c in items) {
    // Severity 1..5 → 0.2..1.0
    var w = c.severity / 5.0;

    // Recency: ≤2y old keeps full weight, then decays to a 0.4 floor.
    if (c.year != null) {
      final age = (year - c.year!).clamp(0, 40);
      if (age > 2) {
        w *= (1.0 - (age - 2) * 0.06).clamp(0.4, 1.0);
      }
    } else {
      w *= 0.7; // unknown date → mild discount
    }

    // Unresolved episodes carry more weight.
    if (c.isOngoing) w *= 1.25;

    weighted += w;
  }

  // Diminishing-returns curve: one severe recent episode ≈ 50,
  // several push the score toward (but never reach) 100.
  final score = (100 * (1 - 1 / (1 + weighted))).clamp(0.0, 100.0);

  final peak = items.map((c) => c.severity).reduce((a, b) => a > b ? a : b);
  final ongoing = items.where((c) => c.isOngoing).length;

  return ControversyIndex(
    score: score,
    label: _label(score),
    ongoingCount: ongoing,
    peakSeverity: peak,
    total: items.length,
  );
}

String _label(double score) {
  if (score < 15) return 'Low profile';
  if (score < 35) return 'Occasionally criticized';
  if (score < 55) return 'Frequently debated';
  if (score < 75) return 'Highly controversial';
  return 'Lightning rod';
}

// ── Per-episode breakdown ("why this number") ───────────────────────────
//
// Mirrors `site/lib/controversy-index.ts`'s `episodeContribution` /
// `explainControversyIndex` line for line — the two clients must produce
// the same arithmetic, not just the same final score.

class EpisodeContribution {
  const EpisodeContribution({
    required this.severityBase,
    required this.recencyFactor,
    required this.ongoingFactor,
    required this.weight,
  });

  /// 0.2..1.0 — severity / 5.
  final double severityBase;

  /// 0.4..1.0 for a dated episode; 0.7 for an undated one.
  final double recencyFactor;

  /// 1.25 when unresolved, else 1.0.
  final double ongoingFactor;

  /// severityBase * recencyFactor * ongoingFactor.
  final double weight;
}

EpisodeContribution episodeContribution(Controversy c, int year) {
  final severityBase = c.severity / 5.0;

  var recencyFactor = 1.0;
  if (c.year != null) {
    final age = (year - c.year!).clamp(0, 40);
    if (age > 2) recencyFactor = (1.0 - (age - 2) * 0.06).clamp(0.4, 1.0);
  } else {
    recencyFactor = 0.7;
  }

  final ongoingFactor = c.isOngoing ? 1.25 : 1.0;

  return EpisodeContribution(
    severityBase: severityBase,
    recencyFactor: recencyFactor,
    ongoingFactor: ongoingFactor,
    weight: severityBase * recencyFactor * ongoingFactor,
  );
}

class IndexExplanationRow {
  const IndexExplanationRow({
    required this.contribution,
    required this.title,
    required this.year,
    required this.severity,
    required this.ongoing,
    required this.points,
  });

  final EpisodeContribution contribution;
  final String title;
  final int? year;
  final int severity;
  final bool ongoing;

  /// This episode's share of the final score, in points.
  final double points;
}

class IndexExplanation {
  const IndexExplanation({
    required this.score,
    required this.label,
    required this.totalWeight,
    required this.curve,
    required this.rows,
  });

  final double score;
  final String label;

  /// Sum of every episode's pre-curve weight.
  final double totalWeight;

  /// Plain-language description of the compression curve.
  final String curve;
  final List<IndexExplanationRow> rows;
}

/// The same computation as [computeControversyIndex], but returning the
/// per-episode arithmetic behind the number so a UI can show "why".
IndexExplanation explainControversyIndex(
  List<Controversy> items, {
  int? currentYear,
}) {
  final index = computeControversyIndex(items, currentYear: currentYear);
  final year = currentYear ?? DateTime.now().year;

  final contributions = [
    for (final c in items) (c: c, contribution: episodeContribution(c, year)),
  ];
  final totalWeight = contributions.fold<double>(
    0,
    (t, x) => t + x.contribution.weight,
  );

  final rows =
      contributions
          .map(
            (x) => IndexExplanationRow(
              contribution: x.contribution,
              title: x.c.title,
              year: x.c.year,
              severity: x.c.severity,
              ongoing: x.c.isOngoing,
              points:
                  totalWeight > 0
                      ? (x.contribution.weight / totalWeight) * index.score
                      : 0,
            ),
          )
          .toList()
        ..sort((a, b) => b.points.compareTo(a.points));

  return IndexExplanation(
    score: index.score,
    label: index.label,
    totalWeight: totalWeight,
    curve:
        'Weights are summed, then compressed by 100 · (1 − 1 / (1 + sum)): '
        'one severe recent episode lands near 50, and more episodes push '
        'toward but never reach 100.',
    rows: rows,
  );
}

// ── STEP 9: CritiScore 2.0 — presentation, transparency, history ───────
//
// Derived arithmetic over the same `List<Controversy>` the score comes
// from. No network call, no model, no new stored data: history and
// "previous score" are honest recomputes over the episodes' own recorded
// years, not a live-tracked snapshot the app never took.

/// The standardised comparison band the spec asks for, independent of the
/// more evocative [ControversyIndex.label] (which stays for the
/// descriptive line; the band is for comparing figures on a common scale).
enum ScoreBand { veryLow, low, moderate, high, veryHigh }

extension ScoreBandLabel on ScoreBand {
  String get label => switch (this) {
    ScoreBand.veryLow => 'Very Low',
    ScoreBand.low => 'Low',
    ScoreBand.moderate => 'Moderate',
    ScoreBand.high => 'High',
    ScoreBand.veryHigh => 'Very High',
  };
}

class ScoreBandInfo {
  const ScoreBandInfo({
    required this.band,
    required this.min,
    required this.max,
  });
  final ScoreBand band;
  final int min;
  final int max;
}

ScoreBandInfo scoreBandFor(double score) {
  final s = score.clamp(0, 100);
  if (s <= 19) {
    return const ScoreBandInfo(band: ScoreBand.veryLow, min: 0, max: 19);
  }
  if (s <= 39) {
    return const ScoreBandInfo(band: ScoreBand.low, min: 20, max: 39);
  }
  if (s <= 59) {
    return const ScoreBandInfo(band: ScoreBand.moderate, min: 40, max: 59);
  }
  if (s <= 79) {
    return const ScoreBandInfo(band: ScoreBand.high, min: 60, max: 79);
  }
  return const ScoreBandInfo(band: ScoreBand.veryHigh, min: 80, max: 100);
}

enum ConfidenceLevel { high, medium, low }

class IndexConfidence {
  const IndexConfidence({
    required this.level,
    required this.sourcedRatio,
    required this.datedRatio,
    required this.reason,
  });

  final ConfidenceLevel level;

  /// Fraction (0..1) of episodes backed by at least one source.
  final double sourcedRatio;

  /// Fraction (0..1) of episodes with a recorded year.
  final double datedRatio;

  /// A plain-language reason built from the two ratios above.
  final String reason;
}

/// How well-supported the score's inputs are — a count of how many
/// episodes are sourced and dated, not a model's feeling about the
/// number. Returns null for an empty list — there is nothing to rate.
IndexConfidence? indexConfidence(List<Controversy> items) {
  if (items.isEmpty) return null;

  final sourced = items.where((c) => c.sources.isNotEmpty).length;
  final dated = items.where((c) => c.year != null).length;
  final sourcedRatio = sourced / items.length;
  final datedRatio = dated / items.length;

  final level =
      sourcedRatio >= 0.8 && datedRatio >= 0.8
          ? ConfidenceLevel.high
          : sourcedRatio >= 0.5 && datedRatio >= 0.5
          ? ConfidenceLevel.medium
          : ConfidenceLevel.low;

  final n = items.length;
  final reason =
      '$sourced of $n episode${n == 1 ? '' : 's'} sourced, '
      '$dated of $n dated';

  return IndexConfidence(
    level: level,
    sourcedRatio: sourcedRatio,
    datedRatio: datedRatio,
    reason: reason,
  );
}

/// The index as it would read if computed at the end of [asOfYear] — a
/// genuine recomputation over real, already-dated data, not a stored
/// snapshot the app took at the time.
ControversyIndex indexAsOf(List<Controversy> items, int asOfYear) {
  final known =
      items.where((c) => c.year == null || c.year! <= asOfYear).toList();
  return computeControversyIndex(known, currentYear: asOfYear);
}

class IndexChange {
  const IndexChange({
    required this.current,
    required this.previous,
    required this.previousYear,
    required this.delta,
  });

  final double current;
  final double previous;
  final int previousYear;
  final double delta;
}

/// Current score vs. a reconstruction as of the end of the prior year.
/// Null when nothing is dated earlier than [currentYear] — there is
/// nothing real to compare against.
IndexChange? indexChange(List<Controversy> items, {int? currentYear}) {
  final year = currentYear ?? DateTime.now().year;
  final hasEarlierDated = items.any((c) => c.year != null && c.year! < year);
  if (!hasEarlierDated) return null;

  final current = computeControversyIndex(items, currentYear: year).score;
  final previous = indexAsOf(items, year - 1).score;
  return IndexChange(
    current: current,
    previous: previous,
    previousYear: year - 1,
    delta: current - previous,
  );
}

class IndexHistoryPoint {
  const IndexHistoryPoint({required this.year, required this.score});
  final int year;
  final double score;
}

/// A year-by-year reconstruction from the earliest dated episode through
/// [currentYear]. Empty when fewer than two distinct dated years exist —
/// a flat one-point "history" is not a history.
List<IndexHistoryPoint> indexHistory(
  List<Controversy> items, {
  int? currentYear,
}) {
  final year = currentYear ?? DateTime.now().year;
  final years = {
    for (final c in items)
      if (c.year != null) c.year!,
  };
  if (years.length < 2) return const [];

  final start = years.reduce((a, b) => a < b ? a : b);
  return [
    for (var y = start; y <= year; y++)
      IndexHistoryPoint(year: y, score: indexAsOf(items, y).score),
  ];
}
