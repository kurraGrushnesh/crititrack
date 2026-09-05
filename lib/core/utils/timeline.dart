/// The Intelligence Timeline — every dated thing CritiTrack actually knows
/// about a figure, merged onto one spine: controversies, career and
/// organisation changes, and grouped news coverage, plus sentiment shifts
/// computed from the stored trend history.
///
/// This is the Dart twin of `site/lib/timeline.ts`. Everything here is
/// derived from data the app already holds on [Celebrity] — no request
/// happens in this file. A single article is never a timeline event on
/// its own: [newsEvents] only surfaces a day at least two sources
/// actually covered, grouped into one entry. `importance` is a plain read
/// of a real signal already on the event (severity, source count,
/// sentiment delta) — never an invented score — and is always paired
/// with the reason behind it.
///
/// Wikipedia pageviews are not parsed into the Flutter app yet, so unlike
/// the web timeline this one never emits an attention-spike event; the
/// `attentionSpike` kind exists for schema parity and future use.
library;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/changes.dart' show ChangeEvent, ChangeSeverity, ChangeType;

enum TimelineKind {
  controversy,
  career,
  organization,
  news,
  attentionSpike,
  sentimentShift,
  change,
}

extension TimelineKindLabel on TimelineKind {
  String get label => switch (this) {
    TimelineKind.controversy => 'Controversy',
    TimelineKind.career => 'Career',
    TimelineKind.organization => 'Organization',
    TimelineKind.news => 'News',
    TimelineKind.attentionSpike => 'Attention',
    TimelineKind.sentimentShift => 'Sentiment',
    TimelineKind.change => 'Change',
  };
}

enum Importance { high, medium, low }

class TimelineSource {
  const TimelineSource({required this.label, this.url});
  final String label;

  /// Null when the reference is a name only, not an openable link.
  final String? url;
}

class TimelineEvent {
  const TimelineEvent({
    required this.date,
    required this.approxDate,
    required this.kind,
    required this.title,
    required this.detail,
    required this.importance,
    required this.importanceReason,
    this.severity,
    this.change,
    this.sourceCount,
    this.sentimentImpact,
    this.attentionImpact,
    this.sources = const [],
    this.relatedTitles = const [],
  });

  final DateTime date;

  /// True when only the year is really known — the day is a placeholder.
  final bool approxDate;
  final TimelineKind kind;
  final String title;
  final String detail;

  /// 1–5, controversy only.
  final int? severity;

  /// Signed score-point delta, sentiment-shift only.
  final int? change;

  /// Grouped source count, news only.
  final int? sourceCount;

  /// Average sentiment (0–100) of the grouped coverage, news only.
  final int? sentimentImpact;

  /// Raw Wikipedia view count on the spike day — never populated today.
  final int? attentionImpact;
  final List<TimelineSource> sources;
  final Importance importance;

  /// Names the real signal the importance rating came from.
  final String importanceReason;

  /// Other event titles within a week — a temporal correlation, not a
  /// claimed cause.
  final List<String> relatedTitles;

  TimelineEvent copyWith({List<String>? relatedTitles}) => TimelineEvent(
    date: date,
    approxDate: approxDate,
    kind: kind,
    title: title,
    detail: detail,
    importance: importance,
    importanceReason: importanceReason,
    severity: severity,
    change: change,
    sourceCount: sourceCount,
    sentimentImpact: sentimentImpact,
    attentionImpact: attentionImpact,
    sources: sources,
    relatedTitles: relatedTitles ?? this.relatedTitles,
  );
}

/// Score points between consecutive snapshots for a "shift" event.
const int _shiftPoints = 10;

/// Fewer sources than this and a day of coverage is not a timeline event.
const int _newsGroupMin = 2;

/// How many days apart two events still count as "around the same time".
const int _relatedWindowDays = 7;

final RegExp _leadership = RegExp(
  r'\b(chief|ceo|cfo|coo|cto|chair(person|man|woman)?|president|'
  r'managing director|director|head of|founder|owner|partner|principal|'
  r'editor-in-chief|secretary-general|prime minister)\b',
  caseSensitive: false,
);

// ── Controversy ──────────────────────────────────────────────────────

List<TimelineEvent> _controversyEvents(List<Controversy> items) {
  final out = <TimelineEvent>[];
  for (final c in items) {
    if (c.year == null) continue;
    final importance =
        c.severity >= 4 || c.isOngoing
            ? Importance.high
            : c.severity >= 2
            ? Importance.medium
            : Importance.low;
    out.add(
      TimelineEvent(
        date: DateTime.utc(c.year!, 1, 1),
        approxDate: true,
        kind: TimelineKind.controversy,
        title: c.title,
        detail: c.summary,
        severity: c.severity,
        sourceCount: c.sources.isEmpty ? null : c.sources.length,
        sources: c.sources.map(_sourceFor).toList(),
        importance: importance,
        importanceReason:
            'severity ${c.severity}/5${c.isOngoing ? ", unresolved" : ""}',
      ),
    );
  }
  return out;
}

// ── Career & organisation ────────────────────────────────────────────

List<TimelineEvent> _careerEvents(List<CareerEntry> entries) {
  final out = <TimelineEvent>[];
  for (final e in entries) {
    if (e.start == null) continue;
    final isOrgOnly = e.role == null;
    final title =
        e.role != null
            ? [e.role, e.organization].whereType<String>().join(', ')
            : (e.organization ?? 'Career update');
    final leadership = e.role != null && _leadership.hasMatch(e.role!);
    out.add(
      TimelineEvent(
        date: DateTime.utc(e.start!, 1, 1),
        approxDate: true,
        kind: isOrgOnly ? TimelineKind.organization : TimelineKind.career,
        title: title,
        detail: e.location ?? '',
        sources:
            e.sourceUrl != null
                ? [TimelineSource(label: e.sourceName, url: e.sourceUrl)]
                : const [],
        importance:
            leadership
                ? Importance.high
                : e.isCurrent
                ? Importance.medium
                : Importance.low,
        importanceReason:
            leadership
                ? 'a leadership role'
                : e.isCurrent
                ? 'the current role'
                : 'a recorded career step',
      ),
    );
  }
  return out;
}

// ── News (grouped) ───────────────────────────────────────────────────

String? _dayKey(DateTime? d) {
  if (d == null) return null;
  final u = d.toUtc();
  return '${u.year.toString().padLeft(4, '0')}-'
      '${u.month.toString().padLeft(2, '0')}-'
      '${u.day.toString().padLeft(2, '0')}';
}

List<TimelineEvent> _newsEvents(List<MediaItem> media) {
  final byDay = <String, List<MediaItem>>{};
  for (final m in media) {
    final day = _dayKey(m.publishedAt);
    if (day == null) continue;
    (byDay[day] ??= []).add(m);
  }

  final out = <TimelineEvent>[];
  byDay.forEach((day, items) {
    // A single article is the media feed's job, not the timeline's.
    if (items.length < _newsGroupMin) return;

    // No per-item relevance ranking is available, so the first item in
    // retrieval order stands in for the day's headline.
    final headline = items.first;
    final scored = items.map((i) => i.sentimentScore).whereType<int>().toList();
    final avgSentiment =
        scored.isEmpty
            ? null
            : (scored.reduce((a, b) => a + b) / scored.length).round();

    final seen = <String>{};
    final sources = <TimelineSource>[];
    for (final i in items) {
      if (!seen.add(i.url)) continue;
      if (sources.length >= 8) continue;
      sources.add(
        TimelineSource(label: i.source ?? i.title, url: _safeUrl(i.url)),
      );
    }

    final parts = day.split('-').map(int.parse).toList();
    out.add(
      TimelineEvent(
        date: DateTime.utc(parts[0], parts[1], parts[2]),
        approxDate: false,
        kind: TimelineKind.news,
        title: headline.title,
        detail:
            '${items.length} related source${items.length == 1 ? "" : "s"}'
            '${avgSentiment != null ? " · average tone $avgSentiment/100" : ""}',
        sourceCount: items.length,
        sentimentImpact: avgSentiment,
        sources: sources,
        importance:
            items.length >= 6
                ? Importance.high
                : items.length >= 4
                ? Importance.medium
                : Importance.low,
        importanceReason: '${items.length} corroborating sources the same day',
      ),
    );
  });
  return out;
}

// ── Sentiment ────────────────────────────────────────────────────────

List<TimelineEvent> sentimentShiftEvents(List<SentimentSnapshot> trend) {
  final rows = trend.where((s) => s.date.isNotEmpty).toList();
  final out = <TimelineEvent>[];
  for (var i = 1; i < rows.length; i++) {
    final delta = rows[i].score - rows[i - 1].score;
    if (delta.abs() < _shiftPoints) continue;
    final up = delta > 0;
    // Parsed as UTC — appending the zone rather than calling `.toUtc()`
    // on a locally-parsed value, so the calendar day is read as-is
    // rather than shifted by converting a local midnight to UTC.
    final date = DateTime.tryParse('${rows[i].date}T00:00:00Z');
    if (date == null) continue;
    out.add(
      TimelineEvent(
        date: date,
        approxDate: false,
        kind: TimelineKind.sentimentShift,
        title: 'Sentiment ${up ? "rose" : "fell"} sharply',
        detail:
            '${delta.abs().round()} points ${up ? "up" : "down"} in a day, '
            'to ${rows[i].score.round()}/100.',
        change: delta.round(),
        importance: delta.abs() >= 20 ? Importance.high : Importance.medium,
        importanceReason: '${delta.abs().round()}-point move in one day',
      ),
    );
  }
  return out;
}

// ── Connections ──────────────────────────────────────────────────────

List<TimelineEvent> _attachRelated(List<TimelineEvent> events) {
  const window = Duration(days: _relatedWindowDays);
  final out = <TimelineEvent>[];
  for (var i = 0; i < events.length; i++) {
    final near = <MapEntry<Duration, String>>[];
    for (var j = 0; j < events.length; j++) {
      if (i == j) continue;
      final dt = events[j].date.difference(events[i].date).abs();
      if (dt <= window) near.add(MapEntry(dt, events[j].title));
    }
    near.sort((a, b) => a.key.compareTo(b.key));
    final titles = near.take(2).map((e) => e.value).toList();
    out.add(
      titles.isEmpty ? events[i] : events[i].copyWith(relatedTitles: titles),
    );
  }
  return out;
}

TimelineSource _sourceFor(String raw) {
  final url = _safeUrl(raw);
  return TimelineSource(label: url != null ? _host(raw) : raw, url: url);
}

/// `https` only, real host, no embedded credentials — mirrors
/// `SafeUrl.parse` without pulling in the full security module here.
String? _safeUrl(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  Uri uri;
  try {
    uri = Uri.parse(trimmed);
  } catch (_) {
    return null;
  }
  if (uri.scheme.toLowerCase() != 'https') return null;
  if (uri.host.isEmpty) return null;
  if (uri.userInfo.isNotEmpty) return null;
  return trimmed;
}

String _host(String raw) {
  final host = Uri.tryParse(raw.trim())?.host ?? '';
  return host.startsWith('www.') ? host.substring(4) : host;
}

const Map<TimelineKind, int> _kindOrder = {
  TimelineKind.controversy: 0,
  TimelineKind.career: 1,
  TimelineKind.organization: 2,
  TimelineKind.news: 3,
  TimelineKind.attentionSpike: 4,
  TimelineKind.sentimentShift: 5,
  TimelineKind.change: 6,
};

/// Step 16: folds Change Detection's own findings into this same
/// timeline rather than a second one. Only change types with no other
/// timeline representation are included — a new controversy, career
/// role, news cluster or sentiment shift already becomes its own event
/// above from the same underlying data, so re-adding it here would show
/// the same real-world thing twice.
const Set<ChangeType> _timelineChangeTypes = {
  ChangeType.critiscoreChange,
  ChangeType.claimChange,
  ChangeType.sourceCoverageChange,
  ChangeType.dataAvailabilityChange,
  ChangeType.profileChange,
};

Importance _changeImportance(ChangeSeverity severity) => switch (severity) {
  ChangeSeverity.major || ChangeSeverity.significant => Importance.high,
  ChangeSeverity.minor => Importance.medium,
  ChangeSeverity.info => Importance.low,
};

List<TimelineEvent> _changeDetectionEvents(List<ChangeEvent> changes) {
  return changes
      .where((c) => _timelineChangeTypes.contains(c.changeType))
      .map((c) {
        final effective = c.effectiveDate != null ? DateTime.tryParse(c.effectiveDate!) : null;
        final date = effective ?? c.detectedAt;
        return TimelineEvent(
          date: DateTime.utc(date.year, date.month, date.day),
          approxDate: effective == null,
          kind: TimelineKind.change,
          title: c.title,
          detail: c.summary,
          importance: _changeImportance(c.severity),
          importanceReason: '${c.confidence.name}-confidence change detection',
        );
      })
      .toList();
}

/// The unified, most-recent-first Intelligence Timeline. Every input is
/// data the profile already carries — no request happens here.
List<TimelineEvent> buildTimeline({
  required List<Controversy> controversies,
  required List<MediaItem> media,
  required List<CareerEntry> career,
  required List<SentimentSnapshot> trend,
  List<ChangeEvent> changeEvents = const [],
}) {
  final merged = [
    ..._controversyEvents(controversies),
    ..._careerEvents(career),
    ..._newsEvents(media),
    ...sentimentShiftEvents(trend),
    ..._changeDetectionEvents(changeEvents),
  ]..sort((a, b) {
    final byDate = b.date.compareTo(a.date);
    if (byDate != 0) return byDate;
    return (_kindOrder[a.kind] ?? 9).compareTo(_kindOrder[b.kind] ?? 9);
  });

  return _attachRelated(merged);
}
