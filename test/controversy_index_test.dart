// Unit tests for the deterministic Controversy Index.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/controversy_index.dart';

Controversy c({
  int severity = 3,
  String status = ControversyStatus.historical,
  int? year,
  String category = ControversyCategory.other,
}) {
  return Controversy(
    title: 'Episode',
    summary: 'summary',
    category: category,
    severity: severity,
    status: status,
    year: year,
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
