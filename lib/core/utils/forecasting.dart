/// Lightweight linear-trend sentiment forecasting.
///
/// Projects 2–3 days forward from the trailing 7–14 days of cached
/// scores using ordinary least squares (OLS) linear regression.
///
/// This is explicitly a baseline floor for future model comparisons,
/// not a high-precision predictor. **No LLM calls.**
library;

/// Result of a linear forecast computation.
class ForecastResult {
  const ForecastResult({
    required this.slope,
    required this.intercept,
    required this.forecast,
  });

  /// Slope of the fitted line (score change per day).
  final double slope;

  /// Y-intercept of the fitted line.
  final double intercept;

  /// Forecasted scores for the next `h` days, clamped to [0, 100].
  final List<double> forecast;
}

/// Computes a linear-trend forecast from a score history.
///
/// [scores] — the trailing `m` scores (m = 7 or 14 typically).
/// [horizon] — how many days to forecast forward (2 or 3).
///
/// Uses ordinary least squares: `t = [1, 2, ..., m]`, solves for
/// `slope` and `intercept`, then extrapolates for `t = m+1 .. m+h`.
///
/// All forecasted values are clamped to [0, 100].
///
/// Returns null if fewer than 2 scores are provided (can't fit a line).
ForecastResult? linearForecast(List<double> scores, {int horizon = 3}) {
  if (scores.length < 2) return null;

  final m = scores.length;

  // t values: 1, 2, ..., m
  final tMean = (m + 1) / 2.0;
  final yMean = scores.reduce((a, b) => a + b) / m;

  double numerator = 0.0;
  double denominator = 0.0;

  for (int i = 0; i < m; i++) {
    final t = (i + 1).toDouble();
    numerator += (t - tMean) * (scores[i] - yMean);
    denominator += (t - tMean) * (t - tMean);
  }

  // If all t values are the same (shouldn't happen with m >= 2)
  if (denominator == 0.0) {
    return ForecastResult(
      slope: 0.0,
      intercept: yMean,
      forecast: List.filled(horizon, yMean.clamp(0.0, 100.0)),
    );
  }

  final slope = numerator / denominator;
  final intercept = yMean - slope * tMean;

  final forecast = <double>[];
  for (int k = 1; k <= horizon; k++) {
    final t = (m + k).toDouble();
    final predicted = (slope * t + intercept).clamp(0.0, 100.0);
    forecast.add(predicted);
  }

  return ForecastResult(slope: slope, intercept: intercept, forecast: forecast);
}
