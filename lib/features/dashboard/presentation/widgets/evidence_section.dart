/// The Evidence & Source Explorer — a native mobile view of every source
/// this profile's record is actually built from. Nothing here is
/// fetched separately: it is derived from data already on [Celebrity].
///
/// A compact card on the profile opens a full-height bottom sheet with
/// filter chips, a search field, and expandable source cards — evidence
/// strength, related record, and a touch-friendly "Open source" action
/// that hands off to the device's own browser.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/research.dart';
import 'package:crititrack/features/research/presentation/widgets/save_to_research_button.dart';

class EvidenceSection extends StatelessWidget {
  const EvidenceSection({
    super.key,
    required this.media,
    required this.controversies,
    required this.career,
    required this.sentimentEvidence,
    this.entityId,
  });

  final List<MediaItem> media;
  final List<Controversy> controversies;
  final List<CareerEntry> career;
  final List<SentimentEvidence> sentimentEvidence;

  /// The profile this evidence belongs to — passed through to "Save to
  /// research" so a saved item keeps its entity.
  final String? entityId;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final items = buildEvidenceItems(
      media: media,
      controversies: controversies,
      career: career,
      sentimentEvidence: sentimentEvidence,
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
                Icons.fact_check_rounded,
                size: 20,
                color: AppTheme.accent,
              ),
              const SizedBox(width: 8),
              Text('Evidence & sources', style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'What this record is actually built from, and how independently.',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: 14),
          if (items.isEmpty)
            Text(
              'No supporting source found.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: palette.textMuted,
              ),
            )
          else
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => showEvidenceExplorerSheet(context, items, entityId),
                icon: const Icon(Icons.search_rounded, size: 18),
                label: Text(
                  'Browse ${items.length} evidence item${items.length == 1 ? "" : "s"}',
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Opens a modal (not a bottom sheet — this is a full explorer, not a
/// quick peek) with filters, search, and the full evidence list.
Future<void> showEvidenceExplorerSheet(
  BuildContext context,
  List<EvidenceItem> items, [
  String? entityId,
]) {
  final palette = context.palette;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: palette.card,
    builder: (context) => _EvidenceExplorerSheet(items: items, entityId: entityId),
  );
}

class _EvidenceExplorerSheet extends StatefulWidget {
  const _EvidenceExplorerSheet({required this.items, this.entityId});
  final List<EvidenceItem> items;
  final String? entityId;

  @override
  State<_EvidenceExplorerSheet> createState() => _EvidenceExplorerSheetState();
}

class _EvidenceExplorerSheetState extends State<_EvidenceExplorerSheet> {
  EvidenceCategory? _category;
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final conflicts = conflictingControversies(widget.items);

    final q = _query.trim().toLowerCase();
    final filtered =
        widget.items.where((e) {
          if (_category != null && e.category != _category) return false;
          if (q.isNotEmpty &&
              !e.title.toLowerCase().contains(q) &&
              !e.sourceName.toLowerCase().contains(q)) {
            return false;
          }
          return true;
        }).toList();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      expand: false,
      builder:
          (context, scrollController) => SafeArea(
            top: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                  child: Text(
                    'Evidence & sources',
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                if (conflicts.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withValues(alpha: 0.12),
                        borderRadius: AppTheme.radiusSm,
                      ),
                      child: Text(
                        'Conflicting evidence: coverage of ${conflicts.join(", ")} is not unanimous.',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: palette.textSecondary,
                        ),
                      ),
                    ),
                  ),
                SizedBox(
                  height: 34,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    children: [
                      _FilterChip(
                        label: 'All',
                        selected: _category == null,
                        onTap: () => setState(() => _category = null),
                      ),
                      const SizedBox(width: 6),
                      for (final c in EvidenceCategory.values) ...[
                        _FilterChip(
                          label: switch (c) {
                            EvidenceCategory.controversy => 'Controversies',
                            EvidenceCategory.career => 'Career',
                            EvidenceCategory.news => 'News',
                          },
                          selected: _category == c,
                          onTap: () => setState(() => _category = c),
                        ),
                        const SizedBox(width: 6),
                      ],
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 4),
                  child: TextField(
                    onChanged: (v) => setState(() => _query = v),
                    decoration: InputDecoration(
                      isDense: true,
                      hintText: 'Search evidence...',
                      prefixIcon: const Icon(Icons.search_rounded, size: 18),
                      filled: true,
                      fillColor: palette.elevated,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(999),
                        borderSide: BorderSide(color: palette.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child:
                      filtered.isEmpty
                          ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Text(
                                'No matches. Try All or clear the search.',
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: palette.textMuted,
                                ),
                              ),
                            ),
                          )
                          : ListView.builder(
                            controller: scrollController,
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                            itemCount: filtered.length,
                            itemBuilder:
                                (context, i) =>
                                    _EvidenceCard(item: filtered[i], entityId: widget.entityId),
                          ),
                ),
              ],
            ),
          ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

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
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
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
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: selected ? AppTheme.accent : palette.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

Color _strengthColor(EvidenceStrength s) => switch (s) {
  EvidenceStrength.strong => AppTheme.success,
  EvidenceStrength.moderate => AppTheme.primary,
  EvidenceStrength.limited => AppTheme.warning,
  EvidenceStrength.conflicting => AppTheme.warning,
  EvidenceStrength.insufficient => AppTheme.error,
};

class _EvidenceCard extends StatelessWidget {
  const _EvidenceCard({required this.item, this.entityId});
  final EvidenceItem item;
  final String? entityId;

  Future<void> _open(BuildContext context) async {
    final uri = item.sourceUrl != null ? Uri.tryParse(item.sourceUrl!) : null;
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = item;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusSm,
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: _strengthColor(
                    e.evidenceStrength,
                  ).withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  e.evidenceStrength.label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: _strengthColor(e.evidenceStrength),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                e.sourceType.label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            e.title,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            [
              e.sourceName,
              if (e.publicationDate != null) e.publicationDate!,
              if ((e.independentSourceCount ?? 1) > 1)
                '${e.duplicateCount} article${e.duplicateCount == 1 ? "" : "s"} from ${e.independentSourceCount} independent publishers',
            ].join(' · '),
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          if (e.snippet != null) ...[
            const SizedBox(height: 4),
            Text(
              '"${e.snippet}"',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textSecondary,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
          const SizedBox(height: 4),
          Text(
            e.strengthReason,
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textMuted,
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 8),
          if (e.sourceUrl != null)
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _open(context),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                ),
                icon: const Icon(Icons.open_in_new_rounded, size: 16),
                label: const Text('Open source'),
              ),
            )
          else
            Text(
              'No direct link on file',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textMuted,
              ),
            ),
          const SizedBox(height: 8),
          SaveToResearchButton(
            type: ResearchItemType.evidence,
            entityId: entityId,
            title: e.title,
            summary: e.strengthReason,
            referenceId: e.evidenceId,
            metadata: {
              'confidence': e.evidenceStrength.name,
              'sourceType': e.sourceType.name,
              'sourceName': e.sourceName,
              'sourceUrl': e.sourceUrl,
              'publicationDate': e.publicationDate,
            },
          ),
        ],
      ),
    );
  }
}
