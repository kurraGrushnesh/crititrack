// Read-side analytics for the compare screen.
//
// All of it is pure, so all of it is tested directly rather than through
// a widget. The point of this screen is that its numbers can be
// recomputed; these are the recomputations.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/compare_analytics.dart';

Controversy episode({
  String category = ControversyCategory.legal,
  int severity = 3,
}) => Controversy(
  title: 't',
  summary: 's',
  category: category,
  severity: severity,
  status: ControversyStatus.resolved,
);

/// 2026-01-15, matching the dates used in the series fixtures below.
final now = DateTime.utc(2026, 1, 15, 12);

void main() {
  group('withinWindow', () {
    final series = {
      '2026-01-15': 50.0, // today
      '2026-01-09': 51.0, // 6 days back — inside a 7-day window
      '2026-01-08': 52.0, // 7 days back — outside it
      '2025-12-20': 53.0,
      '2025-10-01': 54.0,
    };

    test('keeps today and the six days before it', () {
      final out = withinWindow(series, CompareWindow.week, now);
      expect(out.keys.toSet(), {'2026-01-15', '2026-01-09'});
    });

    test('widens with the window', () {
      expect(withinWindow(series, CompareWindow.month, now).length, 4);
      expect(withinWindow(series, CompareWindow.quarter, now).length, 4);
      expect(withinWindow(series, CompareWindow.all, now).length, 5);
    });

    test('excludes dates in the future', () {
      // A clock-skewed device writing tomorrow's snapshot should not
      // silently extend the window.
      final out = withinWindow({'2026-02-01': 1.0}, CompareWindow.week, now);
      expect(out, isEmpty);
    });

    test('drops unparseable dates rather than defaulting them', () {
      final out = withinWindow(
        {'not-a-date': 1.0, '2026-01-15': 2.0},
        CompareWindow.week,
        now,
      );
      expect(out, {'2026-01-15': 2.0});
    });

    test('all-time returns a copy, not the original map', () {
      final source = {'2026-01-15': 1.0};
      final out = withinWindow(source, CompareWindow.all, now);
      out['2026-01-16'] = 2.0;
      expect(source.length, 1);
    });
  });

  group('categoryProfile', () {
    test('always reports every category, so the radar keeps its shape', () {
      final profile = categoryProfile([episode()]);
      expect(profile.keys.toSet(), ControversyCategory.all.toSet());
    });

    test('is severity-weighted, not a count of episodes', () {
      // One severity-5 legal episode against two severity-1 financial
      // ones: counting episodes would call financial the bigger share.
      final profile = categoryProfile([
        episode(category: ControversyCategory.legal, severity: 5),
        episode(category: ControversyCategory.financial, severity: 1),
        episode(category: ControversyCategory.financial, severity: 1),
      ]);

      expect(profile[ControversyCategory.legal], closeTo(5 / 7, 1e-9));
      expect(profile[ControversyCategory.financial], closeTo(2 / 7, 1e-9));
    });

    test('sums to one, so the radar compares shape not volume', () {
      final profile = categoryProfile([
        episode(category: ControversyCategory.legal, severity: 4),
        episode(category: ControversyCategory.political, severity: 2),
        episode(category: ControversyCategory.other, severity: 5),
      ]);

      final total = profile.values.reduce((a, b) => a + b);
      expect(total, closeTo(1.0, 1e-9));
    });

    test('a figure with a long record does not enclose a short one', () {
      // Same shape, ten times the volume — the profiles must match.
      final small = categoryProfile([
        episode(category: ControversyCategory.legal, severity: 2),
        episode(category: ControversyCategory.political, severity: 1),
      ]);
      final large = categoryProfile([
        for (var i = 0; i < 10; i++)
          episode(category: ControversyCategory.legal, severity: 2),
        for (var i = 0; i < 10; i++)
          episode(category: ControversyCategory.political, severity: 1),
      ]);

      expect(small[ControversyCategory.legal], closeTo(2 / 3, 1e-9));
      expect(large[ControversyCategory.legal], closeTo(2 / 3, 1e-9));
    });

    test('is all zeroes when there is nothing on record', () {
      final profile = categoryProfile(const []);
      expect(profile.values.every((v) => v == 0), isTrue);
      expect(profile.length, ControversyCategory.all.length);
    });

    test('clamps a severity outside 1–5', () {
      // A model-supplied 50 would otherwise swamp every other share.
      final profile = categoryProfile([
        episode(category: ControversyCategory.legal, severity: 50),
        episode(category: ControversyCategory.political, severity: 5),
      ]);
      expect(profile[ControversyCategory.legal], closeTo(0.5, 1e-9));
    });

    test('folds an unrecognised category into Other', () {
      final profile = categoryProfile([episode(category: 'Astrology')]);
      expect(profile[ControversyCategory.other], closeTo(1.0, 1e-9));
    });
  });

  group('rankPairs', () {
    CompareSeries s(String name, Map<String, double> scores) => (
      slug: name.toLowerCase(),
      name: name,
      scores: scores,
    );

    test('refuses to report a correlation from two overlapping days', () {
      // Two points determine a line, so r is always exactly ±1 whatever
      // the values are. Reporting that as a strong relationship is an
      // artefact of the arithmetic, not a finding.
      final pairs = rankPairs([
        s('A', {'2026-01-01': 10, '2026-01-02': 90}),
        s('B', {'2026-01-01': 20, '2026-01-02': 80}),
      ]);

      expect(pairs.single.overlap, 2);
      expect(pairs.single.hasEnoughData, isFalse);
      expect(pairs.single.r, 0.0);
      expect(pairs.single.label, contains('Not enough'));
      expect(pairs.single.daysShort, 1);
    });

    test('reports once there are three shared days', () {
      final pairs = rankPairs([
        s('A', {'2026-01-01': 10, '2026-01-02': 20, '2026-01-03': 30}),
        s('B', {'2026-01-01': 15, '2026-01-02': 25, '2026-01-03': 35}),
      ]);

      expect(pairs.single.hasEnoughData, isTrue);
      expect(pairs.single.r, closeTo(1.0, 1e-9));
      expect(pairs.single.daysShort, 0);
    });

    test('aligns by date, so non-overlapping days are not compared', () {
      final pairs = rankPairs([
        s('A', {'2026-01-01': 10, '2026-01-02': 20, '2026-01-03': 30}),
        s('B', {'2026-01-02': 20, '2026-01-03': 30, '2026-01-09': 99}),
      ]);
      expect(pairs.single.overlap, 2);
    });

    test('ranks the strongest relationship first, in either direction', () {
      final together = {
        '2026-01-01': 10.0,
        '2026-01-02': 20.0,
        '2026-01-03': 30.0,
      };
      final opposed = {
        '2026-01-01': 30.0,
        '2026-01-02': 20.0,
        '2026-01-03': 10.0,
      };
      final flat = {'2026-01-01': 10.0, '2026-01-02': 30.0, '2026-01-03': 11.0};

      final pairs = rankPairs([
        s('A', together),
        s('B', flat),
        s('C', opposed),
      ]);

      // A vs C is a perfect inverse and must lead — a strong divergence
      // is as much of a finding as a strong agreement.
      expect({pairs.first.nameA, pairs.first.nameB}, {'A', 'C'});
      expect(pairs.first.r, closeTo(-1.0, 1e-9));
      expect(pairs.first.label, contains('diverging'));
    });

    test('sorts pairs with too little history last, but keeps them', () {
      final pairs = rankPairs([
        s('A', {'2026-01-01': 1, '2026-01-02': 2, '2026-01-03': 3}),
        s('B', {'2026-01-01': 3, '2026-01-02': 2, '2026-01-03': 1}),
        s('C', {'2026-01-01': 5}),
      ]);

      expect(pairs.length, 3);
      expect(pairs.first.hasEnoughData, isTrue);
      expect(pairs.last.hasEnoughData, isFalse);
    });

    test('returns nothing for fewer than two figures', () {
      expect(rankPairs([]), isEmpty);
      expect(
        rankPairs([
          s('A', {'2026-01-01': 1}),
        ]),
        isEmpty,
      );
    });
  });
}
