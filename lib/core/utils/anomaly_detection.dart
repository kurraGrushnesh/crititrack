/// Anomaly / spike detection for cached sentiment score histories.
///
/// Uses a z-score approach over a trailing rolling window to flag
/// days where a celebrity's sentiment moved unusually sharply.
///
/// **No LLM calls** — operates purely on already-cached scores.
library;

import 'dart:math' as math;

import 'package:crititrack/core/domain/models/sentiment_data.dart';

/// Result of a single-day anomaly computation.
class AnomalyResult {
  const AnomalyResult({
    required this.rollingMu,
    required this.rollingSigma,
    required this.zScore,
    required this.isSpike,
  });

  /// Rolling mean of the trailing window.
  final double rollingMu;

  /// Rolling standard deviation of the trailing window.
  final double rollingSigma;

  /// Z-score for the current day: `(score - mu) / sigma`.
  final double zScore;

  /// Whether `|zScore| > threshold`.
  final bool isSpike;
}

/// Computes the z-score anomaly result for a single day.
///
/// [window] is the trailing scores (excluding the current day).
/// [currentScore] is the score to test against the window.
/// [threshold] is the z-score cutoff for flagging a spike.
///
/// If the window is empty or has zero standard deviation, z = 0.
AnomalyResult computeAnomaly(
  List<double> window,
  double currentScore, {
  double threshold = 1.5,
}) {
  if (window.isEmpty) {
    return AnomalyResult(
      rollingMu: currentScore,
      rollingSigma: 0.0,
      zScore: 0.0,
      isSpike: false,
    );
  }

  final n = window.length;
  final mu = window.reduce((a, b) => a + b) / n;

  final variance =
      window.map((s) => (s - mu) * (s - mu)).reduce((a, b) => a + b) / n;
  final sigma = math.sqrt(variance);

  double z;
  if (sigma == 0) {
    z = 0.0;
  } else {
    z = (currentScore - mu) / sigma;
  }

  return AnomalyResult(
    rollingMu: mu,
    rollingSigma: sigma,
    zScore: z,
    isSpike: z.abs() > threshold,
  );
}

/// Annotates a list of [SentimentSnapshot]s with anomaly detection fields.
///
/// For each snapshot at index `i >= windowSize`, the trailing
/// `windowSize` scores form the window, and the current snapshot
/// is tested. Snapshots before the window fills up are left
/// un-annotated (null anomaly fields).
List<SentimentSnapshot> annotateSnapshots(
  List<SentimentSnapshot> snapshots, {
  int windowSize = 7,
  double threshold = 1.5,
}) {
  if (snapshots.length <= windowSize) {
    // Not enough data to fill even one window — return as-is.
    return snapshots;
  }

  final annotated = <SentimentSnapshot>[];

  for (int i = 0; i < snapshots.length; i++) {
    if (i < windowSize) {
      // Not enough trailing data yet — keep original snapshot.
      annotated.add(snapshots[i]);
    } else {
      final window =
          snapshots.sublist(i - windowSize, i).map((s) => s.score).toList();
      final result = computeAnomaly(
        window,
        snapshots[i].score,
        threshold: threshold,
      );

      annotated.add(
        snapshots[i].copyWith(
          rollingMu: result.rollingMu,
          rollingSigma: result.rollingSigma,
          zScore: result.zScore,
          isSpike: result.isSpike,
        ),
      );
    }
  }

  return annotated;
}
