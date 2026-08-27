// Unit tests for anomaly / spike detection against hand-computed values.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/anomaly_detection.dart';

void main() {
  group('computeAnomaly', () {
    test('acceptance test: day 10 spike with z ≈ 11.4', () {
      // Full sequence: 58, 60, 61, 63, 65, 64, 66, 68, 67, 90, 69, 71, 70
      // Trailing 7-day window ending at day 9 (index 8):
      //   scores[3..9] = [63, 65, 64, 66, 68, 67, 90] -- wait, let's re-read.
      //
      // Per the spec, day numbering is 1-based:
      //   days 1-9: 58, 60, 61, 63, 65, 64, 66, 68, 67
      //   window = days 3-9 = [61, 63, 65, 64, 66, 68, 67]
      //   day 10 score = 90
      //
      // mu = (61+63+65+64+66+68+67) / 7 = 454 / 7 ≈ 64.857
      // variance = Σ(xi - mu)² / 7
      // sigma ≈ 2.268
      // z = (90 - 64.857) / 2.268 ≈ 11.09

      final window = [61.0, 63.0, 65.0, 64.0, 66.0, 68.0, 67.0];
      final currentScore = 90.0;

      final result = computeAnomaly(window, currentScore, threshold: 1.5);

      expect(result.rollingMu, closeTo(64.857, 0.01));
      expect(result.rollingSigma, closeTo(2.268, 0.05));
      expect(result.zScore, closeTo(11.09, 0.2));
      expect(result.isSpike, isTrue);
    });

    test('no spike for normal value', () {
      final window = [60.0, 62.0, 61.0, 63.0, 64.0, 62.0, 63.0];
      final currentScore = 64.0;

      final result = computeAnomaly(window, currentScore, threshold: 1.5);

      expect(result.isSpike, isFalse);
    });

    test('sigma = 0 → z = 0 (constant window)', () {
      final window = [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0];
      final currentScore = 70.0;

      final result = computeAnomaly(window, currentScore, threshold: 1.5);

      expect(result.rollingSigma, 0.0);
      expect(result.zScore, 0.0);
      expect(result.isSpike, isFalse);
    });

    test('empty window → z = 0', () {
      final result = computeAnomaly([], 65.0, threshold: 1.5);

      expect(result.rollingMu, 65.0);
      expect(result.zScore, 0.0);
      expect(result.isSpike, isFalse);
    });

    test('negative spike (sharp drop) is also flagged', () {
      final window = [70.0, 72.0, 71.0, 73.0, 74.0, 72.0, 73.0];
      final currentScore = 30.0;

      final result = computeAnomaly(window, currentScore, threshold: 1.5);

      expect(result.isSpike, isTrue);
      expect(result.zScore, lessThan(-1.5));
    });

    test('value at threshold boundary', () {
      // Build a window where z = exactly threshold (should not spike).
      final window = [50.0, 60.0, 50.0, 60.0, 50.0, 60.0, 50.0];
      final mu = window.reduce((a, b) => a + b) / window.length;

      // computeAnomaly uses strict > (not >=), so a value just above the
      // mean stays below the spike threshold.
      final resultBelow = computeAnomaly(window, mu + 1.0, threshold: 1.5);
      expect(resultBelow.isSpike, isFalse);
    });
  });

  group('annotateSnapshots', () {
    SentimentSnapshot snap(String date, double score) => SentimentSnapshot(
      date: date,
      positiveCount: 0,
      negativeCount: 0,
      neutralCount: 0,
      totalMentions: 0,
      dominantEmotion: 'neutral',
      score: score,
    );

    test('returns original when fewer snapshots than window', () {
      final snapshots = List.generate(5, (i) => snap('Day${i + 1}', 50.0));
      final result = annotateSnapshots(snapshots, windowSize: 7);

      expect(result.length, 5);
      // All should have null anomaly fields
      for (final s in result) {
        expect(s.rollingMu, isNull);
        expect(s.isSpike, isFalse);
      }
    });

    test('annotates snapshots from windowSize onward', () {
      // 13 data points from acceptance test
      final scores = [58, 60, 61, 63, 65, 64, 66, 68, 67, 90, 69, 71, 70];
      final snapshots =
          scores
              .asMap()
              .entries
              .map((e) => snap('Day${e.key + 1}', e.value.toDouble()))
              .toList();

      final result = annotateSnapshots(
        snapshots,
        windowSize: 7,
        threshold: 1.5,
      );

      expect(result.length, 13);

      // First 7 should be un-annotated
      for (int i = 0; i < 7; i++) {
        expect(result[i].rollingMu, isNull);
      }

      // Day 10 (index 9, score=90) should be a spike
      expect(result[9].isSpike, isTrue);
      expect(result[9].zScore, isNotNull);
      expect(result[9].zScore!, greaterThan(1.5));
    });
  });
}
