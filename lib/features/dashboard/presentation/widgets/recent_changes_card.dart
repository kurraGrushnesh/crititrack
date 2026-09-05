/// Recent Changes — a compact "what changed since we last saw this
/// person" card, plus a bottom sheet with the full, filterable history.
///
/// Compares the current [Celebrity] against `previousSnapshotProvider`
/// (the last document the Firestore-backed repository has on record —
/// see `CelebrityRepository.previousSnapshot`), which is null the first
/// time this app has ever seen the person, or when Firestore is
/// unavailable. Nothing is fabricated in either case: the card and the
/// sheet simply have nothing to show.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/changes.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';

Color _severityColor(ChangeSeverity s) => switch (s) {
  ChangeSeverity.major => AppTheme.error,
  ChangeSeverity.significant => AppTheme.warning,
  ChangeSeverity.minor => AppTheme.primary,
  ChangeSeverity.info => Colors.grey,
};

String _severityDot(ChangeSeverity s) => switch (s) {
  ChangeSeverity.major => '🔴',
  ChangeSeverity.significant => '🟡',
  ChangeSeverity.minor => '🔵',
  ChangeSeverity.info => '⚪',
};

class RecentChangesCard extends ConsumerWidget {
  const RecentChangesCard({super.key, required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final previousAsync = ref.watch(previousSnapshotProvider(celebrity.slug));

    return previousAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (previous) {
        if (previous == null) return const SizedBox.shrink();
        final changes = detectChanges(previous, celebrity, celebrity.fetchedAt);
        if (changes.isEmpty) return const SizedBox.shrink();
        return _Card(changes: changes, celebrity: celebrity);
      },
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.changes, required this.celebrity});

  final List<ChangeEvent> changes;
  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final top = changes.take(4).toList();

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
          onTap: () => showChangeHistorySheet(context, changes: changes, celebrity: celebrity),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.history_rounded, size: 18, color: palette.textMuted),
                  const SizedBox(width: 8),
                  Text('Recent Changes', style: theme.textTheme.titleSmall),
                ],
              ),
              const SizedBox(height: 10),
              for (final c in top)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_severityDot(c.severity), style: const TextStyle(fontSize: 11)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          c.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
                        ),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 8),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'View all changes',
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

// ── Change history bottom sheet ─────────────────────────────────────

void showChangeHistorySheet(
  BuildContext context, {
  required List<ChangeEvent> changes,
  required Celebrity celebrity,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ChangeHistorySheet(changes: changes, celebrity: celebrity),
  );
}

const List<(ChangeFilter, String)> _kFilters = [
  (ChangeFilter.all, 'All'),
  (ChangeFilter.career, 'Career'),
  (ChangeFilter.controversies, 'Controversies'),
  (ChangeFilter.claims, 'Claims'),
  (ChangeFilter.news, 'News'),
  (ChangeFilter.sentiment, 'Sentiment'),
  (ChangeFilter.score, 'Score'),
  (ChangeFilter.profile, 'Profile'),
];

class _ChangeHistorySheet extends StatefulWidget {
  const _ChangeHistorySheet({required this.changes, required this.celebrity});

  final List<ChangeEvent> changes;
  final Celebrity celebrity;

  @override
  State<_ChangeHistorySheet> createState() => _ChangeHistorySheetState();
}

class _ChangeHistorySheetState extends State<_ChangeHistorySheet> {
  ChangeFilter _filter = ChangeFilter.all;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final shown = filterChanges(widget.changes, _filter);

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
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
                child: Text('Change History', style: theme.textTheme.titleMedium),
              ),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  children: [
                    for (final (key, label) in _kFilters)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: _FilterChip(
                          label: label,
                          selected: _filter == key,
                          onTap: () => setState(() => _filter = key),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child:
                    shown.isEmpty
                        ? ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.all(18),
                          children: [
                            Text(
                              'No changes match this filter.',
                              style: theme.textTheme.bodyMedium?.copyWith(color: palette.textMuted),
                            ),
                          ],
                        )
                        : ListView.builder(
                          controller: scrollController,
                          padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                          itemCount: shown.length,
                          itemBuilder: (context, i) => _ChangeCard(change: shown[i]),
                        ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primary.withValues(alpha: 0.14) : palette.elevated,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: selected ? AppTheme.primary : palette.border),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: selected ? AppTheme.primary : palette.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

class _ChangeCard extends StatefulWidget {
  const _ChangeCard({required this.change});
  final ChangeEvent change;

  @override
  State<_ChangeCard> createState() => _ChangeCardState();
}

class _ChangeCardState extends State<_ChangeCard> {
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
                    Text(_severityDot(c.severity)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        c.title,
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 8),
                  if (c.previousValue != null || c.currentValue != null)
                    Text(
                      '${c.previousValue ?? "—"} → ${c.currentValue ?? "—"}',
                      style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  const SizedBox(height: 4),
                  Text(c.summary, style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 10,
                    children: [
                      Text(
                        'Confidence: ${c.confidence.name}',
                        style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 11),
                      ),
                      if (c.sourceCoverage != null)
                        Text(
                          c.sourceCoverage!,
                          style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted, fontSize: 11),
                        ),
                    ],
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
