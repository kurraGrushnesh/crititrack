/// Career & Professional Intelligence — a native mobile view of the
/// sourced Wikidata career timeline that already rides along on the
/// profile payload (`celebrity.facts.career`).
///
/// A responsive vertical timeline of expandable cards, a horizontally
/// scrollable strip of organisation chips, and a few insight rows
/// derived strictly from the timeline. Nothing is generated: when there
/// are no sourced rows the section says "Career information unavailable".
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class CareerSection extends StatelessWidget {
  const CareerSection({super.key, required this.facts});

  final PersonFacts facts;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                const Icon(
                  Icons.timeline_rounded,
                  size: 20,
                  color: AppTheme.accent,
                ),
                const SizedBox(width: 8),
                Text('Career', style: theme.textTheme.titleMedium),
              ],
            ),
          ),
          if (!facts.hasCareer)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Text(
                'Career information unavailable',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: palette.textMuted,
                ),
              ),
            )
          else
            _CareerBody(facts: facts),
        ],
      ),
    );
  }
}

class _CareerBody extends StatelessWidget {
  const _CareerBody({required this.facts});

  final PersonFacts facts;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final insights = facts.careerInsights;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (facts.organizations.isNotEmpty) ...[
          const SizedBox(height: 14),
          SizedBox(
            height: 32,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: facts.organizations.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (context, i) => _OrgChip(facts.organizations[i]),
            ),
          ),
        ],
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
          child: Column(
            children: [
              for (var i = 0; i < facts.career.length; i++)
                _TimelineTile(
                  entry: facts.career[i],
                  isFirst: i == 0,
                  isLast: i == facts.career.length - 1,
                ),
            ],
          ),
        ),
        if (!insights.isEmpty) ...[
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (insights.start != null)
                  _InsightRow(label: 'Career start', value: insights.start!),
                if (insights.current != null)
                  _InsightRow(
                    label: 'Current position',
                    value: insights.current!,
                  ),
                if (insights.leadershipRoles.isNotEmpty)
                  _InsightRow(
                    label: 'Leadership',
                    value: insights.leadershipRoles.join(', '),
                  ),
                if (insights.founder)
                  _InsightRow(
                    label: 'Founder history',
                    value: 'Named as a founder in the record',
                  ),
                for (final t in insights.transitions)
                  _InsightRow(label: 'Transition', value: t),
              ],
            ),
          ),
        ],
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
          child: Row(
            children: [
              Icon(
                Icons.fact_check_outlined,
                size: 12,
                color: palette.textMuted,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  'Career facts are from Wikidata. Roles without a recorded '
                  'date or title are omitted.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textMuted,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _OrgChip extends StatelessWidget {
  const _OrgChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusSm,
        border: Border.all(color: palette.border),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelSmall?.copyWith(color: palette.textSecondary),
      ),
    );
  }
}

class _TimelineTile extends StatefulWidget {
  const _TimelineTile({
    required this.entry,
    required this.isFirst,
    required this.isLast,
  });

  final CareerEntry entry;
  final bool isFirst;
  final bool isLast;

  @override
  State<_TimelineTile> createState() => _TimelineTileState();
}

class _TimelineTileState extends State<_TimelineTile> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = widget.entry;
    final meta = e.location ?? '';
    final dotColor = e.isCurrent ? AppTheme.accent : palette.border;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Rail
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 2,
                  height: 6,
                  color: widget.isFirst ? Colors.transparent : palette.border,
                ),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                Expanded(
                  child: Container(
                    width: 2,
                    color: widget.isLast ? Colors.transparent : palette.border,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          // Card
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Material(
                color: palette.elevated,
                borderRadius: AppTheme.radiusSm,
                child: InkWell(
                  borderRadius: AppTheme.radiusSm,
                  onTap: () => setState(() => _open = !_open),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.span,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          e.role ?? 'Role',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (e.organization != null)
                          Text(
                            e.organization!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: palette.textSecondary,
                            ),
                          ),
                        if (_open) ...[
                          const SizedBox(height: 8),
                          if (meta.isNotEmpty)
                            Text(
                              meta,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: palette.textMuted,
                              ),
                            ),
                          const SizedBox(height: 4),
                          _SourceLink(entry: e),
                        ],
                      ],
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

class _SourceLink extends StatelessWidget {
  const _SourceLink({required this.entry});

  final CareerEntry entry;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final style = Theme.of(context).textTheme.bodySmall?.copyWith(
      color: entry.sourceUrl != null ? AppTheme.accent : palette.textMuted,
    );
    final text = 'Source: ${entry.sourceName}';

    if (entry.sourceUrl == null) return Text(text, style: style);

    return InkWell(
      onTap: () async {
        final uri = Uri.tryParse(entry.sourceUrl!);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
      child: Text(text, style: style),
    );
  }
}

class _InsightRow extends StatelessWidget {
  const _InsightRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: theme.textTheme.labelSmall?.copyWith(
                color: palette.textMuted,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              value,
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
