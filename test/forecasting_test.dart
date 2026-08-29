// Unit tests for linear-trend sentiment forecasting.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/utils/forecasting.dart';

void main() {
  group('linearForecast', () {
    test('clear upward trend projects higher', () {
      // Perfectly linear: 50, 52, 54, 56, 58, 60, 62
      // slope = 2.0, intercept = 48.0
      // forecast: t=8 → 64, t=9 → 66, t=10 → 68
      final scores = [50.0, 52.0, 54.0, 56.0, 58.0, 60.0, 62.0];
      final result = linearForecast(scores, horizon: 3);

      expect(result, isNotNull);
      expect(result!.slope, closeTo(2.0, 0.01));
      expect(result.forecast[0], closeTo(64.0, 0.1));
      expect(result.forecast[1], closeTo(66.0, 0.1));
      expect(result.forecast[2], closeTo(68.0, 0.1));
    });

    test('clear downward trend projects lower', () {
      final scores = [80.0, 76.0, 72.0, 68.0, 64.0, 60.0, 56.0];
      final result = linearForecast(scores, horizon: 3);

      expect(result, isNotNull);
      expect(result!.slope, closeTo(-4.0, 0.01));
      expect(result.forecast[0], closeTo(52.0, 0.1));
      expect(result.forecast[1], closeTo(48.0, 0.1));
      expect(result.forecast[2], closeTo(44.0, 0.1));
    });

    test('flat trend projects same', () {
      final scores = [50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0];
      final result = linearForecast(scores, horizon: 3);

      expect(result, isNotNull);
      expect(result!.slope, closeTo(0.0, 0.01));
      for (final f in result.forecast) {
        expect(f, closeTo(50.0, 0.1));
      }
    });

    test('forecast clamped at 100', () {
      // Steep upward: if extrapolation would exceed 100
      final scores = [85.0, 88.0, 91.0, 94.0, 97.0, 100.0, 103.0];
      // Note: scores can go above 100 in input (e.g. bad data),
      // but forecast must clamp to 100.
      final result = linearForecast(scores, horizon: 3);

      expect(result, isNotNull);
      for (final f in result!.forecast) {
        expect(f, lessThanOrEqualTo(100.0));
      }
    });

    test('forecast clamped at 0', () {
      final scores = [20.0, 15.0, 10.0, 5.0, 3.0, 2.0, 1.0];
      final result = linearForecast(scores, horizon: 5);

      expect(result, isNotNull);
      for (final f in result!.forecast) {
        expect(f, greaterThanOrEqualTo(0.0));
      }
    });

    test('returns null with fewer than 2 scores', () {
      expect(linearForecast([50.0], horizon: 3), isNull);
      expect(linearForecast([], horizon: 3), isNull);
    });

    test('refuses to extrapolate from two or three days', () {
      // Two points fit a line perfectly whatever their values, so a
      // forecast from them is arithmetic rather than a trend — the same
      // degenerate case as a correlation over two shared days. Three is
      // barely better when the result is drawn as a confident dashed
      // continuation of the line.
      expect(linearForecast([40.0, 60.0], horizon: 2), isNull);
      expect(linearForecast([40.0, 50.0, 60.0], horizon: 2), isNull);
    });

    test('$minHistoryForForecast scores is the minimum viable input', () {
      final result = linearForecast([20.0, 40.0, 60.0, 80.0], horizon: 2);

      expect(result, isNotNull);
      expect(result!.slope, closeTo(20.0, 0.01));
      expect(result.forecast[0], closeTo(100.0, 0.1));
    });

    test('differs from naive persistence for trending data', () {
      // With a clear upward trend, linear forecast should differ
      // from just repeating the last value (naive persistence).
      final scores = [50.0, 55.0, 60.0, 65.0, 70.0, 75.0, 80.0];
      final lastScore = scores.last;
      final result = linearForecast(scores, horizon: 3);

      expect(result, isNotNull);
      // All forecasts should be higher than the last score
      for (final f in result!.forecast) {
        expect(f, greaterThan(lastScore));
      }
    });

    test('horizon = 0 gives empty forecast', () {
      final result = linearForecast([50.0, 60.0, 70.0, 80.0], horizon: 0);
      expect(result, isNotNull);
      expect(result!.forecast, isEmpty);
    });
  });
}
