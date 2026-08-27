/// Pearson correlation for comparative sentiment analytics.
///
/// Computes pairwise correlation between celebrity sentiment
/// trajectories aligned by date. **No LLM calls** — pure read-side.
library;

import 'dart:math' as math;

/// Computes the Pearson correlation coefficient between two
/// equal-length score series.
///
/// Returns `r` in [-1, 1]:
/// - `r ≈ 1.0`  → strongly moving together
/// - `r ≈ -1.0` → strongly diverging
/// - `r ≈ 0.0`  → no linear relationship
///
/// Throws [ArgumentError] if the series have different lengths
/// or fewer than 2 data points.
///
/// If either series has zero variance (constant values), returns 0.0.
double pearsonCorrelation(List<double> x, List<double> y) {
  if (x.length != y.length) {
    throw ArgumentError(
      'Series must have equal length: ${x.length} vs ${y.length}',
    );
  }
  if (x.length < 2) {
    throw ArgumentError('Need at least 2 data points, got ${x.length}');
  }

  final n = x.length;
  final meanX = x.reduce((a, b) => a + b) / n;
  final meanY = y.reduce((a, b) => a + b) / n;

  double sumXY = 0.0;
  double sumX2 = 0.0;
  double sumY2 = 0.0;

  for (int i = 0; i < n; i++) {
    final dx = x[i] - meanX;
    final dy = y[i] - meanY;
    sumXY += dx * dy;
    sumX2 += dx * dx;
    sumY2 += dy * dy;
  }

  final denominator = math.sqrt(sumX2 * sumY2);
  if (denominator == 0.0) return 0.0;

  return sumXY / denominator;
}

/// Returns a human-readable label for a Pearson correlation value.
String correlationLabel(double r) {
  final absR = r.abs();
  if (absR >= 0.8) {
    return r > 0 ? 'Strongly moving together' : 'Strongly diverging';
  } else if (absR >= 0.5) {
    return r > 0 ? 'Moderately moving together' : 'Moderately diverging';
  } else if (absR >= 0.3) {
    return r > 0 ? 'Weakly moving together' : 'Weakly diverging';
  } else {
    return 'No clear relationship';
  }
}

/// Aligns two date-keyed score maps by their common dates.
///
/// Returns a pair of lists containing only scores from dates that
/// appear in both series, ordered chronologically.
(List<double>, List<double>) alignByDate(
  Map<String, double> seriesA,
  Map<String, double> seriesB,
) {
  final commonDates =
      seriesA.keys.where((date) => seriesB.containsKey(date)).toList()..sort();

  final alignedA = commonDates.map((d) => seriesA[d]!).toList();
  final alignedB = commonDates.map((d) => seriesB[d]!).toList();

  return (alignedA, alignedB);
}
