// Unit tests for the deterministic Controversy Index.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/controversy_index.dart';

Controversy c({
  int severity = 3,
  String status = ControversyStatus.historical,
  int? year,
  String category = ControversyCategory.other,
  List<String> sources = const [],
}) {
  return Controversy(
    title: 'Episode',
    summary: 'summary',
    category: category,
    severity: severity,
    status: status,
    year: year,
    sources: sources,
  );
}

void main() {
  group('computeControversyIndex', () {
    test('empty list scores 0', () {
      final r = computeControversyIndex(const []);
      expect(r.score, 0);
      expect(r.total, 0);
      expect(r.peakSeverity, 0);
    });

    test('single recent severe episode lands mid-range', () {
      final r = computeControversyIndex([
        c(severity: 5, year: 2025),
      ], currentYear: 2026);
      expect(r.score, greaterThan(40));
      expect(r.score, lessThan(60));
      expect(r.peakSeverity, 5);
    });

    test('more episodes push the score higher (diminishing returns)', () {
      final one =
          computeControversyIndex([
            c(severity: 4, year: 2025),
          ], currentYear: 2026).score;
      final many =
          computeControversyIndex(
            List.filled(5, c(severity: 4, year: 2025)),
            currentYear: 2026,
          ).score;
      expect(many, greaterThan(one));
      expect(many, lessThan(100));
    });

    test('old episodes weigh less than recent ones', () {
      final recent =
          computeControversyIndex([
            c(severity: 4, year: 2025),
          ], currentYear: 2026).score;
      final old =
          computeControversyIndex([
            c(severity: 4, year: 2005),
          ], currentYear: 2026).score;
      expect(old, lessThan(recent));
    });

    test('ongoing status increases weight and is counted', () {
      final resolved = computeControversyIndex([
        c(severity: 3, year: 2025, status: ControversyStatus.resolved),
      ], currentYear: 2026);
      final ongoing = computeControversyIndex([
        c(severity: 3, year: 2025, status: ControversyStatus.ongoing),
      ], currentYear: 2026);
      expect(ongoing.score, greaterThan(resolved.score));
      expect(ongoing.ongoingCount, 1);
      expect(resolved.ongoingCount, 0);
    });

    test('score never exceeds 100', () {
      final r = computeControversyIndex(
        List.filled(
          20,
          c(severity: 5, year: 2026, status: ControversyStatus.ongoing),
        ),
        currentYear: 2026,
      );
      expect(r.score, lessThanOrEqualTo(100));
    });

    test('label bands track the score', () {
      expect(
        computeControversyIndex(const []).label,
        'No documented controversies',
      );
      final high = computeControversyIndex(
        List.filled(
          6,
          c(severity: 5, year: 2026, status: ControversyStatus.ongoing),
        ),
        currentYear: 2026,
      );
      expect(high.label, anyOf('Highly controversial', 'Lightning rod'));
    });
  });

  group('explainControversyIndex', () {
    test('is empty and zero for no controversies', () {
      final ex = explainControversyIndex(const [], currentYear: 2026);
      expect(ex.score, 0);
      expect(ex.rows, isEmpty);
    });

    test('rows sum to the overall score', () {
      final items = [c(severity: 5, year: 2025), c(severity: 2, year: 2015)];
      final ex = explainControversyIndex(items, currentYear: 2026);
      final total = ex.rows.fold<double>(0, (t, r) => t + r.points);
      expect(total, closeTo(ex.score, 0.01));
    });
  });

  group('scoreBandFor', () {
    test('matches the spec\'s five ranges', () {
      expect(scoreBandFor(0).band, ScoreBand.veryLow);
      expect(scoreBandFor(19).band, ScoreBand.veryLow);
      expect(scoreBandFor(20).band, ScoreBand.low);
      expect(scoreBandFor(39).band, ScoreBand.low);
      expect(scoreBandFor(40).band, ScoreBand.moderate);
      expect(scoreBandFor(59).band, ScoreBand.moderate);
      expect(scoreBandFor(60).band, ScoreBand.high);
      expect(scoreBandFor(79).band, ScoreBand.high);
      expect(scoreBandFor(80).band, ScoreBand.veryHigh);
      expect(scoreBandFor(100).band, ScoreBand.veryHigh);
    });
  });

  group('indexConfidence', () {
    test('is null for no episodes', () {
      expect(indexConfidence(const []), isNull);
    });

    test('is high when every episode is sourced and dated', () {
      final conf = indexConfidence([
        c(sources: const ['Reuters'], year: 2024),
        c(sources: const ['AP'], year: 2023),
      ]);
      expect(conf!.level, ConfidenceLevel.high);
    });

    test('is low when most episodes are unsourced and undated', () {
      final conf = indexConfidence([
        c(sources: const [], year: null),
        c(sources: const [], year: null),
        c(sources: const ['AP'], year: 2020),
      ]);
      expect(conf!.level, ConfidenceLevel.low);
    });
  });

  group('indexAsOf', () {
    test('excludes an episode dated after the cutoff', () {
      final items = [c(severity: 5, year: 2020), c(severity: 5, year: 2025)];
      expect(indexAsOf(items, 2021).total, 1);
    });

    test('keeps an undated episode at every point in time', () {
      final items = [c(severity: 3, year: null)];
      expect(indexAsOf(items, 2010).total, 1);
      expect(indexAsOf(items, 2030).total, 1);
    });
  });

  group('indexChange', () {
    test('is null with nothing dated before the current year', () {
      expect(indexChange([c(year: 2026)], currentYear: 2026), isNull);
      expect(indexChange([c(year: null)], currentYear: 2026), isNull);
    });

    test('reports a real delta when an earlier-dated episode exists', () {
      final items = [c(severity: 3, year: 2020), c(severity: 5, year: 2026)];
      final change = indexChange(items, currentYear: 2026);
      expect(change, isNotNull);
      expect(change!.previousYear, 2025);
      expect(change.current, greaterThan(change.previous));
    });
  });

  group('indexHistory', () {
    test('is empty with fewer than two distinct dated years', () {
      expect(indexHistory([c(year: 2024)], currentYear: 2026), isEmpty);
      expect(indexHistory([c(year: null)], currentYear: 2026), isEmpty);
    });

    test('spans from the earliest dated year through the current year', () {
      final items = [c(year: 2023), c(year: 2025)];
      final h = indexHistory(items, currentYear: 2026);
      expect(h.map((p) => p.year), [2023, 2024, 2025, 2026]);
      expect(
        h.last.score,
        closeTo(computeControversyIndex(items, currentYear: 2026).score, 0.01),
      );
    });
  });

  group('Controversy.fromMap', () {
    test('normalizes category and clamps severity', () {
      final ctrl = Controversy.fromMap({
        'title': 'X',
        'category': 'a messy court battle',
        'severity': 9,
        'status': 'still active',
      });
      expect(ctrl.category, ControversyCategory.legal);
      expect(ctrl.severity, 5);
      expect(ctrl.status, ControversyStatus.ongoing);
    });
  });
}
