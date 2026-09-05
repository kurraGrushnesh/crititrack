/// Historical Intelligence — a compact card plus a bottom-sheet detail
/// view answering "what has happened to this person over time", built
/// only from data the rest of the dashboard already computes: measured
/// sentiment snapshots, the CritiScore reconstruction, the career
/// timeline, and Change Detection's own log. See
/// `lib/core/utils/historical.dart`.
///
/// Change Detection needs a previous snapshot to compare against
/// (`previousSnapshotProvider`, the same one `RecentChangesCard` reads);
/// when there is none yet, turning points simply omit the Change
/// Detection-derived ones — the CritiScore-reconstruction and
/// career-transition turning points still show, since they need no
/// previous snapshot at all.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';

Color _levelColor(CoverageLevel level) => switch (level) {
  CoverageLevel.high => AppTheme.success,
  CoverageLevel.medium => AppTheme.primary,
  CoverageLevel.low => AppTheme.warning,
  CoverageLevel.insufficient => AppTheme.error.withValues(alpha: 0.6),
  CoverageLevel.unavailable => Colors.grey,
};

List<Claim> _claimsFor(Celebrity celebrity) {
  final evidenceItems = buildEvidenceItems(
    media: celebrity.mediaItems,
    controversies: celebrity.biography.controversies,
    career: celebrity.facts.career,
    sentimentEvidence: celebrity.sentimentData.evidence,
  );
  return buildClaimMatrix(celebrity.biography.controversies, evidenceItems);
}

class HistoricalIntelligenceCard extends ConsumerWidget {
  const HistoricalIntelligenceCard({super.key, required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final previousAsync = ref.watch(previousSnapshotProvider(celebrity.slug));
    final previous = previousAsync.asData?.value;
    final changeEvents = previous == null
        ? const <ChangeEvent>[]
        : detectChanges(previous, celebrity, celebrity.fetchedAt);

    final claims = _claimsFor(celebrity);
    final overview = buildHistoricalOverview(
      celebrity: celebrity,
      claims: claims,
      changeEvents: changeEvents,
    );
    if (!overview.hasHistory) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final palette = context.palette;
    final snapshots = buildHistoricalSnapshots(celebrity, claims);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: AppTheme.radiusLg,
          onTap: () => showHistoricalIntelligenceSheet(
            context,
            overview: overview,
            snapshots: snapshots,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.history_rounded, size: 18, color: palette.textMuted),
                  const SizedBox(width: 8),
                  Text('Historical Intelligence', style: theme.textTheme.titleSmall),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                overview.firstSnapshotDate != null
                    ? 'Tracked since ${overview.firstSnapshotDate} · '
                          '${overview.snapshotCount} measured snapshot${overview.snapshotCount == 1 ? '' : 's'}'
                    : 'Reconstructed from ${overview.coverage.where((d) => d.level != CoverageLevel.unavailable).length} '
                          'dated source${overview.coverage.length == 1 ? '' : 's'}',
                style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
              ),
              if (overview.turningPoints.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  '${overview.turningPoints.length} major turning point${overview.turningPoints.length == 1 ? '' : 's'} detected',
                  style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'View full history',
                    style: theme.textTheme.labelMedium?.copyWith(color: palette.brandText),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.chevron_right_rounded, size: 16, color: palette.brandText),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LevelPill extends StatelessWidget {
  const _LevelPill({required this.level});
  final CoverageLevel level;

  @override
  Widget build(BuildContext context) {
    final color = _levelColor(level);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        level.label.toUpperCase(),
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ── Detail bottom sheet ─────────────────────────────────────────────

void showHistoricalIntelligenceSheet(
  BuildContext context, {
  required HistoricalOverview overview,
  required List<HistoricalSnapshot> snapshots,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _HistoricalIntelligenceSheet(overview: overview, snapshots: snapshots),
  );
}

TextStyle? _headingStyle(ThemeData theme, AppPalette palette) =>
    theme.textTheme.labelSmall?.copyWith(color: palette.textMuted, letterSpacing: 0.6);

class _HistoricalIntelligenceSheet extends StatefulWidget {
  const _HistoricalIntelligenceSheet({required this.overview, required this.snapshots});

  final HistoricalOverview overview;
  final List<HistoricalSnapshot> snapshots;

  @override
  State<_HistoricalIntelligenceSheet> createState() => _HistoricalIntelligenceSheetState();
}

class _HistoricalIntelligenceSheetState extends State<_HistoricalIntelligenceSheet> {
  late HistoricalTimeRange _range = widget.overview.supportedRanges.contains(HistoricalTimeRange.y1)
      ? HistoricalTimeRange.y1
      : (widget.overview.supportedRanges.isNotEmpty
            ? widget.overview.supportedRanges.last
            : HistoricalTimeRange.all);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final overview = widget.overview;
    final visiblePoints = filterTurningPoints(overview.turningPoints, null);
    final visibleSnapshots = filterSnapshotsByRange(widget.snapshots, _range);

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
                child: Text('Historical Intelligence', style: theme.textTheme.titleMedium),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                  children: [
                    Text('OVERVIEW', style: _headingStyle(theme, palette)),
                    const SizedBox(height: 6),
                    Text(
                      'Tracked since ${overview.firstSnapshotDate ?? "—"} · '
                      'latest ${overview.latestSnapshotDate ?? "—"} · '
                      '${overview.snapshotCount} snapshot${overview.snapshotCount == 1 ? '' : 's'}',
                      style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                    ),
                    const SizedBox(height: 14),
                    Text('HISTORICAL DATA COVERAGE', style: _headingStyle(theme, palette)),
                    const SizedBox(height: 6),
                    for (final d in overview.coverage)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              d.label,
                              style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                            ),
                            _LevelPill(level: d.level),
                          ],
                        ),
                      ),
                    if (overview.supportedRanges.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('TIME RANGE', style: _headingStyle(theme, palette)),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final r in overview.supportedRanges)
                            ChoiceChip(
                              label: Text(r.label),
                              selected: r == _range,
                              onSelected: (_) => setState(() => _range = r),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${visibleSnapshots.length} snapshot${visibleSnapshots.length == 1 ? '' : 's'} in this range',
                        style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
                      ),
                    ],
                    if (visiblePoints.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text('MAJOR TURNING POINTS', style: _headingStyle(theme, palette)),
                      const SizedBox(height: 6),
                      for (final p in visiblePoints)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${p.date} · ${p.title}',
                                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                              ),
                              if (p.summary.isNotEmpty)
                                Text(
                                  p.summary,
                                  style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                                ),
                            ],
                          ),
                        ),
                    ],
                    const SizedBox(height: 14),
                    Text(
                      'This is a client-side reconstruction over already-real dated data — '
                      'CritiTrack does not yet have a backend snapshot store. A provider '
                      'outage today is never read as "no history"; coverage is judged only '
                      'by how much real dated history has already accumulated.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: palette.textMuted,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
