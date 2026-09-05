/// Watch Intelligence — a native bottom sheet opened from a watched
/// figure's row. An intelligence feed over the entity's existing
/// profile data (Overview, Recent Changes, Important News), not a
/// second profile page — the profile itself stays the canonical detail
/// view (reachable via "Open profile").
///
/// Fetches the same way the dashboard does (`dashboardProvider` +
/// `previousSnapshotProvider`, both already built for Step 15/16) and
/// layers Step 15/16 Change Detection, the Timeline's news grouping and
/// the Watch Intelligence summary on top — no second fetch path, no
/// second detection engine.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/timeline.dart';
import 'package:crititrack/core/utils/watch_intelligence.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

void showWatchIntelligenceSheet(BuildContext context, WatchedFigure figure) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _WatchIntelligenceSheet(figure: figure),
  );
}

Color _severityColor(ChangeSeverity s) => switch (s) {
  ChangeSeverity.major => AppTheme.error,
  ChangeSeverity.significant => AppTheme.warning,
  ChangeSeverity.minor => AppTheme.primary,
  ChangeSeverity.info => Colors.grey,
};

class _WatchIntelligenceSheet extends ConsumerStatefulWidget {
  const _WatchIntelligenceSheet({required this.figure});
  final WatchedFigure figure;

  @override
  ConsumerState<_WatchIntelligenceSheet> createState() => _WatchIntelligenceSheetState();
}

class _WatchIntelligenceSheetState extends ConsumerState<_WatchIntelligenceSheet> {
  bool _markedSeen = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final celebrityAsync = ref.watch(dashboardProvider(widget.figure.slug));
    final previousAsync = ref.watch(previousSnapshotProvider(widget.figure.slug));

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: palette.card,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
          ),
          child: Column(
            children: [
              const SizedBox(height: 10),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(color: palette.border, borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(widget.figure.name, style: theme.textTheme.titleMedium),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).pop();
                        context.push('/dashboard/${widget.figure.slug}');
                      },
                      child: const Text('Open profile'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: celebrityAsync.when(
                  loading: () => _skeleton(scrollController),
                  error:
                      (_, _) => ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.all(18),
                        children: const [
                          Text('Watch intelligence is temporarily unavailable.'),
                        ],
                      ),
                  data: (celebrity) {
                    final previous = previousAsync.asData?.value;
                    return _body(scrollController, celebrity, previous);
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _skeleton(ScrollController controller) => ListView(
    controller: controller,
    padding: const EdgeInsets.all(18),
    children: [
      for (final w in [0.6, 0.9, 0.75])
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: FractionallySizedBox(
            widthFactor: w,
            alignment: Alignment.centerLeft,
            child: Container(height: 12, color: context.palette.elevated),
          ),
        ),
    ],
  );

  Widget _body(ScrollController controller, Celebrity celebrity, Celebrity? previous) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final evidenceItems = buildEvidenceItems(
      media: celebrity.mediaItems,
      controversies: celebrity.biography.controversies,
      career: celebrity.facts.career,
      sentimentEvidence: celebrity.sentimentData.evidence,
    );
    final changes = previous == null ? const <ChangeEvent>[] : detectChanges(previous, celebrity, celebrity.fetchedAt);
    final timeline = buildTimeline(
      controversies: celebrity.biography.controversies,
      media: celebrity.mediaItems,
      career: celebrity.facts.career,
      trend: celebrity.sentimentData.trendData,
      changeEvents: changes,
    );
    final overview = buildWatchOverview(celebrity, changes, widget.figure.lastSeenChangeAt);
    final importantNews = importantNewsFromTimeline(timeline);

    // Mark viewed/seen once per sheet open, only once real data is
    // showing — never merely because a list rendered elsewhere.
    if (!_markedSeen) {
      _markedSeen = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final controller = ref.read(watchlistProvider.notifier);
        controller.markViewed(widget.figure.slug);
        if (changes.isNotEmpty) controller.markChangesSeen(widget.figure.slug);
      });
    }

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
      children: [
        Row(
          children: [
            Expanded(child: _statTile('CritiScore', '${overview.critiscore}', overview.critiscoreLabel)),
            const SizedBox(width: 8),
            Expanded(
              child: _statTile('Sentiment', overview.sentimentLabel, 'Trend: ${overview.sentimentDirection}'),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _statTile('Unseen', '${overview.unseenCount}', '${overview.importantUnseenCount} important'),
            ),
          ],
        ),
        if (evidenceItems.isNotEmpty) const SizedBox(height: 4),
        const SizedBox(height: 16),
        Text('RECENT CHANGES', style: _headingStyle(theme, palette)),
        const SizedBox(height: 8),
        if (changes.isEmpty)
          Text(
            'No meaningful changes since your last review. CritiTrack compares against '
            'the last snapshot it has on record for this profile.',
            style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
          )
        else
          for (final c in changes) _ChangeTile(change: c),
        const SizedBox(height: 16),
        Text('IMPORTANT NEWS', style: _headingStyle(theme, palette)),
        const SizedBox(height: 8),
        if (importantNews.isEmpty)
          Text(
            'No grouped news events found for this profile yet.',
            style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
          )
        else
          for (final n in importantNews)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: palette.elevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: palette.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(n.title, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 2),
                    Text(
                      '${n.sourceCount ?? 1} source${(n.sourceCount ?? 1) == 1 ? "" : "s"}',
                      style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
      ],
    );
  }

  Widget _statTile(String label, String value, String sub) {
    final theme = Theme.of(context);
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        border: Border.all(color: palette.border),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: theme.textTheme.labelSmall?.copyWith(color: palette.textMuted, fontSize: 9.5),
          ),
          const SizedBox(height: 2),
          Text(value, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          Text(sub, style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 10.5)),
        ],
      ),
    );
  }
}

TextStyle? _headingStyle(ThemeData theme, AppPalette palette) => theme.textTheme.labelSmall?.copyWith(
  color: palette.textMuted,
  fontSize: 10.5,
  letterSpacing: 0.8,
  fontWeight: FontWeight.w700,
);

class _ChangeTile extends StatefulWidget {
  const _ChangeTile({required this.change});
  final ChangeEvent change;

  @override
  State<_ChangeTile> createState() => _ChangeTileState();
}

class _ChangeTileState extends State<_ChangeTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final c = widget.change;
    final color = _severityColor(c.severity);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: c.severity == ChangeSeverity.major ? color.withValues(alpha: 0.4) : palette.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(10),
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(c.title, style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 6),
                  if (c.previousValue != null || c.currentValue != null)
                    Text(
                      '${c.previousValue ?? "—"} → ${c.currentValue ?? "—"}',
                      style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  const SizedBox(height: 4),
                  Text(c.summary, style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary)),
                  const SizedBox(height: 4),
                  Text(
                    'Confidence: ${c.confidence.name} · Severity: ${c.severity.name}',
                    style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 11),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
