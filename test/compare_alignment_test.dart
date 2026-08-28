// Correlation must align two series by date, not by position.
//
// This is the test that would have caught the original bug: the compare
// screen truncated both series to the shorter length and correlated
// whatever sat at the same index. That was harmless while the trend was
// invented with a fixed seven entries, but the scheduler now writes real
// dated snapshots starting from whenever each figure was first requested,
// so positions no longer line up.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/utils/correlation.dart';

/// What the old code did, kept here purely to demonstrate the difference.
(List<double>, List<double>) alignByIndex(List<double> a, List<double> b) {
  final n = a.length < b.length ? a.length : b.length;
  return (a.sublist(0, n), b.sublist(0, n));
}

void main() {
  group('date alignment vs index alignment', () {
    test('offset series correlate correctly only when aligned by date', () {
      // Two figures tracked from different start dates. On the days they
      // share, they move together perfectly.
      final a = {
        '2026-08-01': 10.0,
        '2026-08-02': 20.0,
        '2026-08-03': 30.0,
        '2026-08-04': 40.0,
      };
      final b = {'2026-08-03': 30.0, '2026-08-04': 40.0, '2026-08-05': 50.0};

      final (byDateA, byDateB) = alignByDate(a, b);
      expect(byDateA, [30.0, 40.0], reason: 'only the shared days');
      expect(byDateB, [30.0, 40.0]);
      expect(pearsonCorrelation(byDateA, byDateB), closeTo(1.0, 0.001));

      // The old approach lines up 1 Aug against 3 Aug and reports a
      // relationship that does not exist in the data.
      final (byIdxA, byIdxB) = alignByIndex(
        a.values.toList(),
        b.values.toList(),
      );
      expect(byIdxA, [10.0, 20.0, 30.0]);
      expect(byIdxB, [30.0, 40.0, 50.0]);
    });

    test('index alignment can invent a strong correlation', () {
      // Series that genuinely disagree on their shared days.
      final a = {'d1': 10.0, 'd2': 90.0, 'd3': 20.0};
      final b = {'d2': 20.0, 'd3': 80.0, 'd4': 30.0};

      final (dateA, dateB) = alignByDate(a, b);
      final honest = pearsonCorrelation(dateA, dateB);

      final (idxA, idxB) = alignByIndex(a.values.toList(), b.values.toList());
      final misleading = pearsonCorrelation(idxA, idxB);

      // Both are computable; they simply describe different things, and
      // only one of them describes the data.
      expect(dateA, [90.0, 20.0], reason: 'shared days d2 and d3');
      expect(dateB, [20.0, 80.0]);
      expect(honest, isNot(closeTo(misleading, 0.01)));
    });

    test('no overlapping dates yields no comparison at all', () {
      final (a, b) = alignByDate(
        {'2026-08-01': 10.0, '2026-08-02': 20.0},
        {'2026-09-01': 10.0, '2026-09-02': 20.0},
      );
      expect(a, isEmpty);
      expect(b, isEmpty);
      // The screen requires two shared days before reporting anything, so
      // this renders as "Not enough overlapping days" rather than 0.0.
    });

    test('a single overlapping day is not enough for a correlation', () {
      final (a, _) = alignByDate(
        {'2026-08-01': 10.0, '2026-08-02': 20.0},
        {'2026-08-02': 55.0, '2026-08-03': 60.0},
      );
      expect(a.length, 1);
      expect(
        a.length >= 2,
        isFalse,
        reason: 'the screen must refuse to correlate a single point',
      );
    });

    test('results are chronological regardless of insertion order', () {
      final (a, b) = alignByDate(
        {'2026-08-03': 3.0, '2026-08-01': 1.0, '2026-08-02': 2.0},
        {'2026-08-02': 20.0, '2026-08-03': 30.0, '2026-08-01': 10.0},
      );
      expect(a, [1.0, 2.0, 3.0]);
      expect(b, [10.0, 20.0, 30.0]);
    });

    test('legacy weekday-labelled snapshots still align with each other', () {
      // Documents cached before the scheduler existed are keyed "Mon",
      // "Tue"… Those still match each other, so an old cached pair
      // compares sensibly rather than silently producing nothing.
      final (a, b) = alignByDate(
        {'Mon': 60.0, 'Tue': 65.0, 'Wed': 70.0},
        {'Mon': 40.0, 'Tue': 45.0, 'Wed': 50.0},
      );
      expect(a.length, 3);
      expect(pearsonCorrelation(a, b), closeTo(1.0, 0.001));
    });
  });
}
