/// The Relationships section on a profile — documented connections only.
/// Every card traces to a structured Wikidata claim or a dated career
/// row. Co-occurrence in news is only ever an evidence count, never the
/// basis for a card. See `core/utils/relationships.dart`.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/relationships.dart';

class RelationshipsSection extends StatefulWidget {
  const RelationshipsSection({super.key, required this.celebrity});
  final Celebrity celebrity;

  @override
  State<RelationshipsSection> createState() => _RelationshipsSectionState();
}

class _RelationshipsSectionState extends State<RelationshipsSection> {
  RelationshipCategory? _category;

  List<EntityRelationship> _build() {
    final c = widget.celebrity;
    final evidenceItems = buildEvidenceItems(
      media: c.mediaItems,
      controversies: c.biography.controversies,
      career: c.facts.career,
      sentimentEvidence: c.sentimentData.evidence,
    );
    return buildRelationships(
      subjectEntityId: c.wikidataId ?? c.slug,
      subjectName: c.name,
      wikidataRelationships: c.facts.relationships,
      career: c.facts.career,
      evidenceItems: evidenceItems,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final all = _build();

    if (all.isEmpty) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: palette.elevated, borderRadius: AppTheme.radiusSm, border: Border.all(color: palette.border)),
        child: Text(
          'No documented relationships available. CritiTrack surfaces a relationship only when a '
          'structured record documents it — absence here means nothing has been retrieved, not that '
          'none exist.',
          style: theme.textTheme.bodySmall?.copyWith(color: palette.textSecondary),
        ),
      );
    }

    final cov = relationshipCoverage(all);
    final shown = _category == null ? all : filterRelationships(all, RelationshipFilters(category: _category));

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${cov.total} documented relationship${cov.total == 1 ? "" : "s"} · '
            '${cov.high} high, ${cov.medium} medium, ${cov.low} low confidence · '
            '${cov.supportingSources} supporting source${cov.supportingSources == 1 ? "" : "s"}',
            style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _CatChip(label: 'All', selected: _category == null, onTap: () => setState(() => _category = null)),
                for (final cat in RelationshipCategory.values)
                  _CatChip(label: cat.label, selected: _category == cat, onTap: () => setState(() => _category = cat)),
              ],
            ),
          ),
          const SizedBox(height: 8),
          for (final r in shown) _RelationshipCard(r: r),
        ],
      ),
    );
  }
}

class _CatChip extends StatelessWidget {
  const _CatChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(right: 8),
    child: ChoiceChip(label: Text(label), selected: selected, onSelected: (_) => onTap()),
  );
}

class _RelationshipCard extends StatelessWidget {
  const _RelationshipCard({required this.r});
  final EntityRelationship r;

  Color _confColor(RelationshipConfidence c) => switch (c) {
    RelationshipConfidence.high => AppTheme.success,
    RelationshipConfidence.medium => AppTheme.primary,
    RelationshipConfidence.low => AppTheme.warning,
  };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final dates = r.effectiveFrom != null
        ? '${r.effectiveFrom}${r.effectiveTo != null ? "–${r.effectiveTo}" : r.status == RelationshipStatus.active ? "–present" : ""}'
        : (r.effectiveTo != null ? 'until ${r.effectiveTo}' : null);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusSm,
        border: Border(left: BorderSide(color: _confColor(r.confidence), width: 4)),
      ),
      child: ExpansionTile(
        shape: const Border(),
        title: Row(
          children: [
            Expanded(child: Text(r.objectName, style: const TextStyle(fontWeight: FontWeight.w600))),
            Text(r.status.name.toUpperCase(), style: theme.textTheme.labelSmall?.copyWith(color: palette.textMuted)),
          ],
        ),
        subtitle: Text(relationshipTypeLabel(r.relationshipType), style: theme.textTheme.bodySmall),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text('${r.subjectName} → ${relationshipTypeLabel(r.relationshipType)} → ${r.objectName}', style: theme.textTheme.bodySmall),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              '${dates != null ? "Dates: $dates · " : ""}Confidence: ${r.confidence.name} · '
              '${r.sourceUrls.length} source${r.sourceUrls.length == 1 ? "" : "s"}'
              '${r.evidenceIds.isNotEmpty ? " · ${r.evidenceIds.length} corroborating item(s)" : ""}',
              style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
            ),
          ),
          if (r.sourceUrls.isNotEmpty) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Wrap(
                spacing: 12,
                children: [
                  for (var i = 0; i < r.sourceUrls.length; i++)
                    TextButton(
                      onPressed: () async {
                        final uri = Uri.tryParse(r.sourceUrls[i]);
                        if (uri != null && await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
                      child: Text('Source ${i + 1}'),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
