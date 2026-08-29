/// Read-side analytics for the compare screen.
///
/// Everything here is pure: given the same snapshots it returns the same
/// answer, and none of it calls a model. That matters because this screen
/// is where the data is supposed to feel like a dataset rather than like
/// prose, and a figure that cannot be recomputed is not a measurement.
library;

import 'dart:math' as math;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/correlation.dart';

/// The minimum number of overlapping days before a correlation is worth
/// reporting.
///
/// Pearson's r over exactly two points is always exactly +1 or -1 —
/// two points determine a line, so the fit is perfect whatever the values
/// are. Reporting that as "strongly moving together" is not a weak
/// finding, it is an artefact of the arithmetic, and it would appear
/// most often precisely when two figures were first tracked days apart
/// and had barely any history in common.
///
/// Three is the smallest n at which the coefficient can distinguish
/// anything at all. It is still a weak claim, which is why the UI shows
/// the overlap alongside every r.
const int minOverlapForCorrelation = 3;

/// A selectable span of history.
enum CompareWindow {
  week(7, 'Last 7 days'),
  month(30, 'Last 30 days'),
  quarter(90, 'Last 90 days'),
  all(null, 'All time');

  const CompareWindow(this.days, this.label);

  /// Null means no cutoff.
  final int? days;
  final String label;
}

/// One figure's dated score series, as the compare screen holds it.
typedef CompareSeries = ({String slug, String name, Map<String, double> scores});

/// Narrows a date-keyed score series to [window].
///
/// Keys are ISO `yyyy-MM-dd`. Anything unparseable is dropped rather than
/// defaulted to today, which would silently pull junk into every window.
///
/// The cutoff is inclusive and counts [CompareWindow.days] days ending
/// today, so "last 7 days" means today plus the six before it rather than
/// today plus seven.
Map<String, double> withinWindow(
  Map<String, double> series,
  CompareWindow window,
  DateTime now,
) {
  final days = window.days;
  if (days == null) return Map<String, double>.from(series);

  final today = DateTime.utc(now.year, now.month, now.day);
  final cutoff = today.subtract(Duration(days: days - 1));

  final out = <String, double>{};
  for (final entry in series.entries) {
    final date = DateTime.tryParse(entry.key);
    if (date == null) continue;

    final day = DateTime.utc(date.year, date.month, date.day);
    if (!day.isBefore(cutoff) && !day.isAfter(today)) {
      out[entry.key] = entry.value;
    }
  }
  return out;
}

/// The shape of a figure's controversy record, as a share per category.
///
/// Shares rather than counts, and severity-weighted rather than
/// per-episode. Two decisions worth stating:
///
/// Shares, because the radar is meant to answer "what kind of trouble" —
/// "how much" is already the controversy index, shown as bars right next
/// to it. Plotting raw totals would make the radar a second, worse copy
/// of the bars, in which the figure with the longest record simply
/// encloses everyone else.
///
/// Severity-weighted, because one severity-5 legal episode and one
/// severity-1 social-media spat are not the same fact, and counting
/// episodes would say they were.
///
/// Returns every category in [ControversyCategory.all], including zeroes,
/// so a radar has a stable number of spokes across figures. Sums to 1
/// unless there is nothing on record, in which case every value is 0.
Map<String, double> categoryProfile(List<Controversy> controversies) {
  final weights = {for (final c in ControversyCategory.all) c: 0.0};

  var total = 0.0;
  for (final controversy in controversies) {
    final category = ControversyCategory.normalize(controversy.category);
    // Clamped: a model-supplied severity outside 1–5 would otherwise
    // distort every share on the chart.
    final severity = controversy.severity.clamp(1, 5).toDouble();
    weights[category] = (weights[category] ?? 0) + severity;
    total += severity;
  }

  if (total == 0) return weights;
  return weights.map((k, v) => MapEntry(k, v / total));
}

/// The strength of the relationship between two figures' trajectories.
class PairCorrelation {
  const PairCorrelation({
    required this.nameA,
    required this.nameB,
    required this.r,
    required this.overlap,
  });

  final String nameA;
  final String nameB;

  /// Pearson's r, or 0 when [hasEnoughData] is false.
  final double r;

  /// How many dated snapshots the two figures actually share.
  final int overlap;

  bool get hasEnoughData => overlap >= minOverlapForCorrelation;

  String get label =>
      hasEnoughData
          ? correlationLabel(r)
          : 'Not enough overlapping days yet';

  /// How many days of shared history are still needed. Zero once there
  /// are enough — used to tell the user what is missing rather than
  /// leaving a blank row.
  int get daysShort => math.max(0, minOverlapForCorrelation - overlap);
}

/// Ranks every pair of figures by how strongly their trajectories relate.
///
/// Sorted by |r|, so the strongest relationship leads whether the two
/// moved together or apart — a strong divergence is as much of a finding
/// as a strong agreement, and the label says which it is. Pairs without
/// enough shared history sort last rather than being hidden, because
/// "we cannot say yet" is information about the dataset.
List<PairCorrelation> rankPairs(List<CompareSeries> series) {
  final out = <PairCorrelation>[];

  for (var i = 0; i < series.length; i++) {
    for (var j = i + 1; j < series.length; j++) {
      final a = series[i];
      final b = series[j];

      // By date, never by position: two figures first tracked on
      // different days would otherwise have Monday correlated against
      // Wednesday.
      final (alignedA, alignedB) = alignByDate(a.scores, b.scores);
      final overlap = alignedA.length;

      out.add(
        PairCorrelation(
          nameA: a.name,
          nameB: b.name,
          r:
              overlap >= minOverlapForCorrelation
                  ? pearsonCorrelation(alignedA, alignedB)
                  : 0.0,
          overlap: overlap,
        ),
      );
    }
  }

  out.sort((x, y) {
    if (x.hasEnoughData != y.hasEnoughData) return x.hasEnoughData ? -1 : 1;
    return y.r.abs().compareTo(x.r.abs());
  });

  return out;
}
