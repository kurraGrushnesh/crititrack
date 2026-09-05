/// The Intelligence Timeline — a native mobile view of the unified,
/// dated spine over a figure's public record: controversies, career and
/// organisation changes, grouped news coverage, and sentiment shifts.
///
/// Everything renders from data already on [Celebrity]; no request
/// happens here. Filter and time-range chips are client-side; tapping a
/// row opens a bottom sheet with the event's full detail, importance
/// reason, sources and any events nearby in time.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/changes.dart' show ChangeEvent;
import 'package:crititrack/core/utils/timeline.dart';

enum _Range {
  days30('30 Days', 30),
  days90('90 Days', 90),
  year1('1 Year', 365),
  all('All Time', null);

  const _Range(this.label, this.days);
  final String label;
  final int? days;
}

class FigureTimelineSection extends StatefulWidget {
  const FigureTimelineSection({
    super.key,
    required this.controversies,
    required this.mediaItems,
    required this.career,
    required this.trend,
    this.changeEvents = const [],
  });

  final List<Controversy> controversies;
  final List<MediaItem> mediaItems;
  final List<CareerEntry> career;
  final List<SentimentSnapshot> trend;

  /// Step 16: this profile's detected changes, when available — folded
  /// into the same timeline rather than a competing one. See
  /// `timeline.dart`'s `_changeDetectionEvents` for which change types
  /// are included (only those with no other timeline representation).
  final List<ChangeEvent> changeEvents;

  @override
  State<FigureTimelineSection> createState() => _FigureTimelineSectionState();
}

class _FigureTimelineSectionState extends State<FigureTimelineSection> {
  TimelineKind? _filter;
  _Range _range = _Range.all;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final events = buildTimeline(
      controversies: widget.controversies,
      media: widget.mediaItems,
      career: widget.career,
      trend: widget.trend,
      changeEvents: widget.changeEvents,
    );

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.timeline_rounded,
                size: 20,
                color: AppTheme.accent,
              ),
              const SizedBox(width: 8),
              Text('Timeline', style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Controversies, career changes, clustered news coverage and '
            'sentiment shifts, on one axis.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (events.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                'The timeline fills in as controversies are recorded, the '
                'career record gains a step, coverage clusters on a day, or '
                'the sentiment score moves sharply between measured days.',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: palette.textMuted,
                ),
              ),
            )
          else
            _Body(
              events: events,
              filter: _filter,
              range: _range,
              onFilter: (k) {
                setState(() => _filter = k);
              },
              onRange: (r) {
                setState(() => _range = r);
              },
            ),
        ],
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.events,
    required this.filter,
    required this.range,
    required this.onFilter,
    required this.onRange,
  });

  final List<TimelineEvent> events;
  final TimelineKind? filter;
  final _Range range;
  final ValueChanged<TimelineKind?> onFilter;
  final ValueChanged<_Range> onRange;

  bool _withinRange(DateTime date) {
    final days = range.days;
    if (days == null) return true;
    return DateTime.now().difference(date).inDays <= days;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final kindsPresent = events.map((e) => e.kind).toSet();
    final filtered =
        events
            .where(
              (e) =>
                  (filter == null || e.kind == filter) && _withinRange(e.date),
            )
            .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 14),
        SizedBox(
          height: 34,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              _Chip(
                label: 'All',
                selected: filter == null,
                onTap: () => onFilter(null),
              ),
              const SizedBox(width: 6),
              for (final k in TimelineKind.values)
                if (kindsPresent.contains(k)) ...[
                  _Chip(
                    label: k.label,
                    selected: filter == k,
                    onTap: () => onFilter(k),
                  ),
                  const SizedBox(width: 6),
                ],
            ],
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 30,
          child: ListView(
            scrollDirection: Axis.horizontal,
            children: [
              for (final r in _Range.values) ...[
                _Chip(
                  label: r.label,
                  selected: range == r,
                  onTap: () => onRange(r),
                  compact: true,
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No events in this view. Try All Time or a different event type.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textMuted,
              ),
            ),
          )
        else
          for (var i = 0; i < filtered.length; i++)
            _EventTile(
              event: filtered[i],
              isFirst: i == 0,
              isLast: i == filtered.length - 1,
            ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.compact = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Material(
      color:
          selected ? AppTheme.accent.withValues(alpha: 0.16) : palette.elevated,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 10 : 12,
            vertical: 6,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? AppTheme.accent : palette.border,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: compact ? 11.5 : 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? AppTheme.accent : palette.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

Color _dotColor(TimelineKind kind) => switch (kind) {
  TimelineKind.controversy => AppTheme.error,
  TimelineKind.career || TimelineKind.organization => AppTheme.success,
  TimelineKind.news => AppTheme.primary,
  TimelineKind.attentionSpike => AppTheme.accent,
  TimelineKind.sentimentShift => AppTheme.warning,
  TimelineKind.change => Colors.grey,
};

String _displayDate(TimelineEvent e) {
  if (e.approxDate) return '${e.date.year}';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return '${months[e.date.month - 1]} ${e.date.day}, ${e.date.year}';
}

class _EventTile extends StatelessWidget {
  const _EventTile({
    required this.event,
    required this.isFirst,
    required this.isLast,
  });

  final TimelineEvent event;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = event;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 20,
            child: Column(
              children: [
                Container(
                  width: 2,
                  height: 6,
                  color: isFirst ? Colors.transparent : palette.border,
                ),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: _dotColor(e.kind),
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: isLast ? Colors.transparent : palette.border,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                color: palette.elevated,
                borderRadius: AppTheme.radiusSm,
                child: InkWell(
                  borderRadius: AppTheme.radiusSm,
                  onTap: () => showTimelineEventSheet(context, e),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(minHeight: 56),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${_displayDate(e)} · ${e.kind.label.toUpperCase()}',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                              letterSpacing: 0.4,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            e.title,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (e.detail.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                e.detail,
                                style: theme.textTheme.bodySmall?.copyWith(
                                  color: palette.textSecondary,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Detail bottom sheet ──────────────────────────────────────────────

Future<void> showTimelineEventSheet(BuildContext context, TimelineEvent e) {
  final palette = context.palette;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: palette.card,
    builder: (context) => _EventSheet(event: e),
  );
}

class _EventSheet extends StatelessWidget {
  const _EventSheet({required this.event});
  final TimelineEvent event;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = event;

    final rows = <(String, String)>[
      ('Date', _displayDate(e)),
      ('Type', e.kind.label),
      if (e.severity != null) ('Severity', '${e.severity}/5'),
      if (e.sourceCount != null) ('Sources', '${e.sourceCount}'),
      if (e.sentimentImpact != null)
        ('Average tone', '${e.sentimentImpact}/100'),
      if (e.attentionImpact != null) ('Views that day', '${e.attentionImpact}'),
      if (e.change != null)
        ('Change', '${e.change! >= 0 ? "+" : ""}${e.change}'),
    ];

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.82,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 12, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(e.title, style: theme.textTheme.titleMedium),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close_rounded),
                    tooltip: 'Close',
                  ),
                ],
              ),
              if (e.detail.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Text(
                    e.detail,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppTheme.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  '${e.importance.name[0].toUpperCase()}${e.importance.name.substring(1)} · ${e.importanceReason}',
                  style: const TextStyle(
                    color: AppTheme.accent,
                    fontWeight: FontWeight.w700,
                    fontSize: 11.5,
                  ),
                ),
              ),
              for (final (label, value) in rows)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 96,
                        child: Text(
                          label.toUpperCase(),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ),
                      Expanded(
                        child: Text(value, style: theme.textTheme.bodyMedium),
                      ),
                    ],
                  ),
                ),
              if (e.sources.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  'SOURCES',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                    letterSpacing: 0.6,
                  ),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [for (final s in e.sources) _SourceLink(source: s)],
                ),
              ],
              if (e.relatedTitles.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  'Also around this time',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  e.relatedTitles.join(' · '),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SourceLink extends StatelessWidget {
  const _SourceLink({required this.source});
  final TimelineSource source;

  Future<void> _open(BuildContext context) async {
    final uri = source.url != null ? Uri.tryParse(source.url!) : null;
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
    if (!context.mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('That source could not be opened.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final openable = source.url != null;
    return Material(
      color: palette.card,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: openable ? () => _open(context) : null,
        child: Container(
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            border: Border.all(color: palette.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                openable ? Icons.link_rounded : Icons.description_outlined,
                size: 14,
                color: openable ? AppTheme.primary : palette.textMuted,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  source.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: openable ? AppTheme.primary : palette.textSecondary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
