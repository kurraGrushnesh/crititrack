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
