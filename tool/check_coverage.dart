/// Coverage gate for CI.
///
/// The quality bar calls for over 70% on core. This enforces it, so the
/// number is a floor that holds rather than a figure that was true once.
///
/// `lib/core/` is checked separately and more strictly than the whole
/// project: it holds the deterministic logic — scoring, serialisation,
/// URL policy — where a regression is silent and consequential. Widget
/// code is covered where it is worth covering, but chasing a percentage
/// there produces tests that assert the framework works.
///
/// Usage:
///   flutter test --coverage
///   dart run tool/check_coverage.dart
library;

import 'dart:io';

/// Minimum line coverage for `lib/core/`.
const double coreMinimum = 75.0;

/// Minimum line coverage across everything measured.
const double overallMinimum = 65.0;

void main(List<String> args) {
  final file = File('coverage/lcov.info');
  if (!file.existsSync()) {
    stderr.writeln(
      'coverage/lcov.info not found. Run: flutter test --coverage',
    );
    exit(2);
  }

  final records = _parse(file.readAsLinesSync());
  if (records.isEmpty) {
    stderr.writeln('No coverage records found in coverage/lcov.info.');
    exit(2);
  }

  final overall = _summarise(records);
  final core = _summarise(
    records.where((r) => r.path.contains('lib/core/')).toList(),
  );

  stdout.writeln('Coverage');
  stdout.writeln('  overall  ${_fmt(overall)}  (min $overallMinimum%)');
  stdout.writeln('  core     ${_fmt(core)}  (min $coreMinimum%)');

  final failures = <String>[];
  if (overall.percent < overallMinimum) {
    failures.add(
      'overall ${overall.percent.toStringAsFixed(1)}% '
      'is below $overallMinimum%',
    );
  }
  if (core.percent < coreMinimum) {
    failures.add(
      'lib/core/ ${core.percent.toStringAsFixed(1)}% '
      'is below $coreMinimum%',
    );
  }

  if (failures.isEmpty) {
    stdout.writeln('\nCoverage gate passed.');
    return;
  }

  // Name the least-covered files, so the failure points at what to do
  // next rather than only saying no.
  stderr.writeln('\nCoverage gate FAILED:');
  for (final f in failures) {
    stderr.writeln('  - $f');
  }

  final worst =
      records.where((r) => r.found >= 20).toList()
        ..sort((a, b) => a.percent.compareTo(b.percent));

  if (worst.isNotEmpty) {
    stderr.writeln('\nLeast covered files with 20+ lines:');
    for (final r in worst.take(8)) {
      stderr.writeln(
        '  ${r.percent.toStringAsFixed(1).padLeft(5)}%  '
        '${r.hit}/${r.found}  ${r.path}',
      );
    }
  }
  exit(1);
}

class _Record {
  _Record(this.path, this.found, this.hit);
  final String path;
  final int found;
  final int hit;
  double get percent => found == 0 ? 100 : 100 * hit / found;
}

class _Summary {
  _Summary(this.found, this.hit, this.files);
  final int found;
  final int hit;
  final int files;
  double get percent => found == 0 ? 100 : 100 * hit / found;
}

_Summary _summarise(List<_Record> records) {
  var found = 0;
  var hit = 0;
  for (final r in records) {
    found += r.found;
    hit += r.hit;
  }
  return _Summary(found, hit, records.length);
}

String _fmt(_Summary s) =>
    '${s.percent.toStringAsFixed(1).padLeft(5)}%  '
    '(${s.hit}/${s.found} lines, ${s.files} files)';

List<_Record> _parse(List<String> lines) {
  final out = <_Record>[];
  String? path;
  var found = 0;
  var hit = 0;

  for (final raw in lines) {
    final line = raw.trim();
    if (line.startsWith('SF:')) {
      // lcov paths use the host separator; normalise so the lib/core/
      // check behaves the same on Windows and Linux.
      path = line.substring(3).replaceAll(r'\', '/');
      found = 0;
      hit = 0;
    } else if (line.startsWith('LF:')) {
      found = int.tryParse(line.substring(3)) ?? 0;
    } else if (line.startsWith('LH:')) {
      hit = int.tryParse(line.substring(3)) ?? 0;
    } else if (line == 'end_of_record' && path != null) {
      out.add(_Record(path, found, hit));
      path = null;
    }
  }
  return out;
}
