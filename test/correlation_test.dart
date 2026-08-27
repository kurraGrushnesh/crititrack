// Unit tests for Pearson correlation against hand-computed values.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/utils/correlation.dart';

void main() {
  group('pearsonCorrelation', () {
    test('acceptance test: r ≈ 0.97 for strongly correlated series', () {
      // A = [62, 65, 70, 68, 74, 71, 76]
      // B = [58, 60, 66, 63, 70, 69, 73]
      final a = [62.0, 65.0, 70.0, 68.0, 74.0, 71.0, 76.0];
      final b = [58.0, 60.0, 66.0, 63.0, 70.0, 69.0, 73.0];

      final r = pearsonCorrelation(a, b);

      expect(r, closeTo(0.97, 0.02));
    });

    test('identical series → r = 1.0', () {
      final a = [10.0, 20.0, 30.0, 40.0, 50.0];
      final r = pearsonCorrelation(a, a);

      expect(r, closeTo(1.0, 0.0001));
    });

    test('perfectly inversely correlated → r = -1.0', () {
      final a = [10.0, 20.0, 30.0, 40.0, 50.0];
      final b = [50.0, 40.0, 30.0, 20.0, 10.0];

      final r = pearsonCorrelation(a, b);

      expect(r, closeTo(-1.0, 0.0001));
    });

    test('constant series → r = 0.0', () {
      final a = [50.0, 50.0, 50.0, 50.0, 50.0];
      final b = [60.0, 70.0, 80.0, 90.0, 100.0];

      final r = pearsonCorrelation(a, b);

      expect(r, 0.0);
    });

    test('throws on unequal lengths', () {
      expect(
        () => pearsonCorrelation([1.0, 2.0], [1.0]),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('throws on fewer than 2 points', () {
      expect(
        () => pearsonCorrelation([1.0], [2.0]),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('two points → perfect linear', () {
      final a = [0.0, 100.0];
      final b = [0.0, 100.0];

      final r = pearsonCorrelation(a, b);

      expect(r, closeTo(1.0, 0.0001));
    });
  });

  group('correlationLabel', () {
    test('strong positive', () {
      expect(correlationLabel(0.95), 'Strongly moving together');
    });

    test('strong negative', () {
      expect(correlationLabel(-0.85), 'Strongly diverging');
    });

    test('moderate positive', () {
      expect(correlationLabel(0.6), 'Moderately moving together');
    });

    test('weak negative', () {
      expect(correlationLabel(-0.35), 'Weakly diverging');
    });

    test('no relationship', () {
      expect(correlationLabel(0.1), 'No clear relationship');
    });
  });

  group('alignByDate', () {
    test('aligns common dates', () {
      final a = {'2024-01-01': 60.0, '2024-01-02': 65.0, '2024-01-03': 70.0};
      final b = {'2024-01-02': 58.0, '2024-01-03': 63.0, '2024-01-04': 68.0};

      final (alignedA, alignedB) = alignByDate(a, b);

      expect(alignedA, [65.0, 70.0]);
      expect(alignedB, [58.0, 63.0]);
    });

    test('no common dates → empty', () {
      final a = {'2024-01-01': 60.0};
      final b = {'2024-01-02': 58.0};

      final (alignedA, alignedB) = alignByDate(a, b);

      expect(alignedA, isEmpty);
      expect(alignedB, isEmpty);
    });

    test('all dates common → full alignment', () {
      final a = {'d1': 10.0, 'd2': 20.0};
      final b = {'d1': 30.0, 'd2': 40.0};

      final (alignedA, alignedB) = alignByDate(a, b);

      expect(alignedA.length, 2);
      expect(alignedB.length, 2);
    });
  });
}
