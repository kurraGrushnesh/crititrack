/// The Data Coverage & Confidence Center — a compact summary card plus a
/// bottom-sheet detail view. Computes the coverage report from the same
/// [Celebrity] the rest of the dashboard already holds: no new fetch, no
/// combined truth score, one real level per intelligence dimension.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/helpers.dart' show cacheTimestamp;

Color _levelColor(CoverageLevel level) => switch (level) {
  CoverageLevel.high => AppTheme.success,
  CoverageLevel.medium => AppTheme.primary,
  CoverageLevel.low => AppTheme.warning,
  CoverageLevel.insufficient => AppTheme.error.withValues(alpha: 0.6),
  CoverageLevel.unavailable => Colors.grey,
};

CoverageReport _reportFor(Celebrity celebrity) {
  final evidenceItems = buildEvidenceItems(
    media: celebrity.mediaItems,
    controversies: celebrity.biography.controversies,
    career: celebrity.facts.career,
    sentimentEvidence: celebrity.sentimentData.evidence,
  );
  final claims = buildClaimMatrix(celebrity.biography.controversies, evidenceItems);
  return buildCoverageReport(celebrity: celebrity, evidenceItems: evidenceItems, claims: claims);
}

class DataCoverageCard extends StatelessWidget {
  const DataCoverageCard({super.key, required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final report = _reportFor(celebrity);
    final summary = summaryDimensions(report);
    if (summary.isEmpty) return const SizedBox.shrink();

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
          onTap: () => showDataCoverageSheet(context, report: report, celebrity: celebrity),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.fact_check_outlined, size: 18, color: palette.textMuted),
                  const SizedBox(width: 8),
                  Text('Data Coverage', style: theme.textTheme.titleSmall),
                ],
              ),
              const SizedBox(height: 12),
              ...summary.map(
                (d) => Padding(
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
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'View data coverage',
                    style: TextStyle(color: palette.brandText, fontWeight: FontWeight.w600, fontSize: 12.5),
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

void showDataCoverageSheet(
  BuildContext context, {
  required CoverageReport report,
  required Celebrity celebrity,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _DataCoverageSheet(report: report, celebrity: celebrity),
  );
}

/// Only the limitations actually detected from the computed dimensions —
/// never a fixed boilerplate list.
List<String> _detectLimitations(CoverageReport report) {
  final out = <String>[];
  final byKey = {for (final d in report.dimensions) d.key: d};
  final historical = byKey[CoverageDimensionKey.historical];
  if (historical != null &&
      (historical.level == CoverageLevel.low || historical.level == CoverageLevel.unavailable)) {
    out.add('Historical coverage is limited.');
  }
  final unavailable = report.dimensions.where((d) => d.level == CoverageLevel.unavailable).toList();
  if (unavailable.isNotEmpty) {
    out.add(
      '${unavailable.length} source${unavailable.length == 1 ? " was" : "s were"} unavailable: '
      '${unavailable.map((d) => d.label).join(", ")}.',
    );
  }
  final conflicting = report.dimensions.where((d) => d.status == DataStatus.conflicting).toList();
  if (conflicting.isNotEmpty) {
    out.add(
      '${conflicting.map((d) => d.label).join(", ")} '
      '${conflicting.length == 1 ? "has" : "have"} conflicting signals.',
    );
  }
  return out;
}

class _DataCoverageSheet extends StatelessWidget {
  const _DataCoverageSheet({required this.report, required this.celebrity});

  final CoverageReport report;
  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final limitations = _detectLimitations(report);

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
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
                child: Text('Data Coverage', style: theme.textTheme.titleMedium),
              ),
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                  children: [
                    for (final d in report.dimensions) _DimensionTile(dimension: d),
                    const SizedBox(height: 12),
                    Text('FRESHNESS', style: _headingStyle(theme, palette)),
                    const SizedBox(height: 6),
                    Text(
                      'Profile updated ${cacheTimestamp(celebrity.fetchedAt)}',
                      style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                    ),
                    if (limitations.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text('LIMITATIONS', style: _headingStyle(theme, palette)),
                      const SizedBox(height: 6),
                      for (final l in limitations)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 4),
                          child: Text(
                            '· $l',
                            style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                          ),
                        ),
                    ],
                    const SizedBox(height: 16),
                    Text(
                      'Coverage measures how much usable data exists — separate from '
                      'CritiScore, sentiment, and popularity. Methodology ${report.coverageVersion}.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: palette.textMuted,
                        fontStyle: FontStyle.italic,
                        fontSize: 11.5,
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

TextStyle? _headingStyle(ThemeData theme, AppPalette palette) => theme.textTheme.labelSmall?.copyWith(
  color: palette.textMuted,
  fontSize: 10.5,
  letterSpacing: 0.8,
  fontWeight: FontWeight.w700,
);

class _DimensionTile extends StatefulWidget {
  const _DimensionTile({required this.dimension});
  final CoverageDimension dimension;

  @override
  State<_DimensionTile> createState() => _DimensionTileState();
}

class _DimensionTileState extends State<_DimensionTile> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final d = widget.dimension;
    final color = _levelColor(d.level);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: palette.border),
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
                    Expanded(
                      child: Text(
                        d.label,
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                    _LevelPill(level: d.level),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 8),
                  Text(
                    d.status.label,
                    style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 11.5),
                  ),
                  const SizedBox(height: 4),
                  for (final reason in d.reasons)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        '· $reason',
                        style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                      ),
                    ),
                  if (d.timeRange != null &&
                      (d.timeRange!.earliest != null || d.timeRange!.latest != null)) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Coverage: ${d.timeRange!.earliest ?? "—"} – ${d.timeRange!.latest ?? "—"}'
                      '${d.timeRange!.gapNote != null ? " · known gap: ${d.timeRange!.gapNote}" : ""}',
                      style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 11),
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
