/// Watch Intelligence — the Dart twin of `site/lib/watch-intelligence.ts`.
/// Filters, sorts and packages the output of the systems that already
/// exist (Step 15/16 ChangeEvents, the Timeline's own news grouping, the
/// deterministic CritiScore, the sentiment ensemble) into a compact feed
/// for one watched entity, and tracks what the reader has already seen.
///
/// This is not a second Change Detection engine — [detectChanges] is
/// still the only place a [ChangeEvent] is produced. This module only
/// decides which of the already-detected events to show, in what order.
library;

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/helpers.dart' show sentimentLabel;
import 'package:crititrack/core/utils/timeline.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';

// ── Filtering ────────────────────────────────────────────────────────

const Map<ChangeSeverity, int> _severityRank = {
  ChangeSeverity.info: 0,
  ChangeSeverity.minor: 1,
  ChangeSeverity.significant: 2,
  ChangeSeverity.major: 3,
};
const Map<ChangeConfidence, int> _confidenceRank = {
  ChangeConfidence.low: 0,
  ChangeConfidence.medium: 1,
  ChangeConfidence.high: 2,
};
const Map<WatchMinimumSeverity, ChangeSeverity?> _minSeverity = {
  WatchMinimumSeverity.all: null,
  WatchMinimumSeverity.major: ChangeSeverity.major,
  WatchMinimumSeverity.significant: ChangeSeverity.significant,
  WatchMinimumSeverity.minor: ChangeSeverity.minor,
  WatchMinimumSeverity.info: ChangeSeverity.info,
};
const Map<WatchMinimumConfidence, ChangeConfidence?> _minConfidence = {
  WatchMinimumConfidence.all: null,
  WatchMinimumConfidence.high: ChangeConfidence.high,
  WatchMinimumConfidence.medium: ChangeConfidence.medium,
  WatchMinimumConfidence.low: ChangeConfidence.low,
};
const Map<WatchTimeRange, int?> _rangeDays = {
  WatchTimeRange.day1: 1,
  WatchTimeRange.day7: 7,
  WatchTimeRange.day30: 30,
  WatchTimeRange.day90: 90,
  WatchTimeRange.all: null,
};

List<ChangeEvent> filterBySeverity(List<ChangeEvent> changes, WatchMinimumSeverity minimum) {
  final floor = _minSeverity[minimum];
  if (floor == null) return changes;
  return changes.where((c) => _severityRank[c.severity]! >= _severityRank[floor]!).toList();
}

List<ChangeEvent> filterByConfidence(List<ChangeEvent> changes, WatchMinimumConfidence minimum) {
  final floor = _minConfidence[minimum];
  if (floor == null) return changes;
  return changes.where((c) => _confidenceRank[c.confidence]! >= _confidenceRank[floor]!).toList();
}

/// `now` is a parameter (not read internally) so this stays a pure
/// function of its arguments.
List<ChangeEvent> filterByTimeRange(List<ChangeEvent> changes, WatchTimeRange range, DateTime now) {
  final days = _rangeDays[range];
  if (days == null) return changes;
  final cutoff = now.subtract(Duration(days: days));
  return changes.where((c) => c.detectedAt.isAfter(cutoff)).toList();
}

/// Applies a watch's stored filters together, in one pass.
List<ChangeEvent> applyWatchFilters(List<ChangeEvent> changes, WatchFilters filters, DateTime now) {
  var out = filterBySeverity(changes, filters.minimumSeverity);
  out = filterByConfidence(out, filters.minimumConfidence);
  out = filterByTimeRange(out, filters.timeRange, now);
  return out;
}

/// The default feed view the spec asks for: MAJOR + SIGNIFICANT only.
List<ChangeEvent> importantChanges(List<ChangeEvent> changes) =>
    changes.where((c) => c.severity == ChangeSeverity.major || c.severity == ChangeSeverity.significant).toList();

// ── Unseen tracking ──────────────────────────────────────────────────

/// Changes detected after [lastSeenChangeAt] — everything, if the watch
/// has never had its changes marked seen.
List<ChangeEvent> unseenChanges(List<ChangeEvent> changes, DateTime? lastSeenChangeAt) {
  if (lastSeenChangeAt == null) return changes;
  return changes.where((c) => c.detectedAt.isAfter(lastSeenChangeAt)).toList();
}

// ── Overview ─────────────────────────────────────────────────────────

class WatchOverview {
  const WatchOverview({
    required this.critiscore,
    required this.critiscoreLabel,
    required this.sentimentLabel,
    required this.sentimentDirection,
    required this.unseenCount,
    required this.importantUnseenCount,
    required this.recentChangeCount,
    required this.lastMeaningfulUpdate,
    required this.lastMeaningfulUpdateAt,
  });

  final int critiscore;
  final String critiscoreLabel;
  final String sentimentLabel;

  /// The profile's own reported trend direction — reused, never
  /// recomputed.
  final String sentimentDirection;
  final int unseenCount;
  final int importantUnseenCount;
  final int recentChangeCount;
  final String? lastMeaningfulUpdate;
  final DateTime? lastMeaningfulUpdateAt;
}

WatchOverview buildWatchOverview(
  Celebrity celebrity,
  List<ChangeEvent> changes,
  DateTime? lastSeenChangeAt,
) {
  final index = computeControversyIndex(celebrity.biography.controversies);
  final unseen = unseenChanges(changes, lastSeenChangeAt);
  final important = importantChanges(changes);
  final importantUnseen = unseenChanges(important, lastSeenChangeAt);
  final sorted = [...changes]..sort((a, b) => b.detectedAt.compareTo(a.detectedAt));
  final mostRecent = sorted.isEmpty ? null : sorted.first;

  return WatchOverview(
    critiscore: index.score.round(),
    critiscoreLabel: index.label,
    sentimentLabel: sentimentLabel(celebrity.sentimentData.overallScore),
    sentimentDirection: celebrity.sentimentData.trendDirection,
    unseenCount: unseen.length,
    importantUnseenCount: importantUnseen.length,
    recentChangeCount: changes.length,
    lastMeaningfulUpdate: mostRecent?.title,
    lastMeaningfulUpdateAt: mostRecent?.detectedAt,
  );
}

// ── Important News (reuses the Timeline's own grouped news events) ──

/// The watched entity's news, as already deduplicated and grouped by
/// [buildTimeline]'s news-event assembly — a real underlying event with
/// many reporting articles becomes one entry with a source count, never
/// one alert per article. Does not re-run any news pipeline; reads
/// whichever timeline the caller already built for the profile.
List<TimelineEvent> importantNewsFromTimeline(List<TimelineEvent> timeline, {int limit = 8}) {
  final news = timeline.where((e) => e.kind == TimelineKind.news).toList()
    ..sort((a, b) {
      final bySources = (b.sourceCount ?? 0).compareTo(a.sourceCount ?? 0);
      if (bySources != 0) return bySources;
      return b.date.compareTo(a.date);
    });
  return news.take(limit).toList();
}
