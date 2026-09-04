/// Career & Professional Intelligence — a native mobile timeline of the
/// sourced Wikidata career data that already rides along on the profile
/// payload (`celebrity.facts.career`). No network work happens here: every
/// interaction reads the already-loaded rows.
///
/// Interaction model:
///   • the timeline is compact by default — the four oldest roles — with
///     a "Show all" toggle that expands it and scrolls the current role
///     into view;
///   • a role card is a large touch target; tapping it opens a native
///     bottom sheet with the full detail and a big source link;
///   • organisation chips scroll horizontally and never push the screen
///     wide; tapping one searches CritiTrack for that organisation.
///
/// Nothing is generated. With no sourced rows the section reads
/// "Career information isn't available yet."
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';

const int _kCompactCount = 4;

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
            child: Semantics(
              header: true,
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
          ),
          if (!facts.hasCareer)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: Text(
                "Career information isn't available yet.",
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

class _CareerBody extends StatefulWidget {
  const _CareerBody({required this.facts});

  final PersonFacts facts;

  @override
  State<_CareerBody> createState() => _CareerBodyState();
}

class _CareerBodyState extends State<_CareerBody> {
  bool _expanded = false;
  final GlobalKey _currentKey = GlobalKey();

  List<CareerEntry> get _career => widget.facts.career;

  /// Index of the role to reveal on expand: the latest still-open post,
  /// else simply the most recent.
  int get _currentIndex {
    var best = _career.length - 1;
    var bestStart = -1 << 30;
    for (var i = 0; i < _career.length; i++) {
      final e = _career[i];
      if (e.isCurrent && (e.start ?? 0) > bestStart) {
        bestStart = e.start ?? 0;
        best = i;
      }
    }
    return best;
  }

  void _toggle() {
    final motion = !MediaQuery.disableAnimationsOf(context);
    setState(() => _expanded = !_expanded);
    if (!_expanded) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _currentKey.currentContext;
      if (ctx == null) return;
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.15,
        duration: motion ? const Duration(milliseconds: 320) : Duration.zero,
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final insights = widget.facts.careerInsights;
    final motion = !MediaQuery.disableAnimationsOf(context);

    final total = _career.length;
    final showToggle = total > _kCompactCount;
    final visibleCount = _expanded || !showToggle ? total : _kCompactCount;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.facts.organizations.isNotEmpty) ...[
          const SizedBox(height: 14),
          _OrgChips(organizations: widget.facts.organizations),
        ],
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
          child: AnimatedSize(
            duration:
                motion ? const Duration(milliseconds: 220) : Duration.zero,
            alignment: Alignment.topCenter,
            curve: Curves.easeOut,
            child: Column(
              children: [
                for (var i = 0; i < visibleCount; i++)
                  _TimelineTile(
                    key: i == _currentIndex ? _currentKey : null,
                    entry: _career[i],
                    isFirst: i == 0,
                    isLast: i == visibleCount - 1,
                  ),
              ],
            ),
          ),
        ),
        if (showToggle)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 2, 16, 0),
            child: Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _toggle,
                icon: Icon(
                  _expanded
                      ? Icons.expand_less_rounded
                      : Icons.expand_more_rounded,
                  size: 18,
                ),
                label: Text(_expanded ? 'Show less' : 'Show all $total roles'),
              ),
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

// ── Organisation chips ─────────────────────────────────────────────────

class _OrgChips extends StatelessWidget {
  const _OrgChips({required this.organizations});

  final List<String> organizations;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: organizations.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, i) => _OrgChip(organizations[i]),
      ),
    );
  }
}

class _OrgChip extends StatelessWidget {
  const _OrgChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Semantics(
      button: true,
      label: 'Search CritiTrack for $label',
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 240),
        child: Material(
          color: palette.elevated,
          borderRadius: AppTheme.radiusSm,
          child: InkWell(
            borderRadius: AppTheme.radiusSm,
            onTap: () => context.push('/?q=${Uri.encodeComponent(label)}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Align(
                alignment: Alignment.centerLeft,
                widthFactor: 1,
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ── Timeline row ───────────────────────────────────────────────────────

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    super.key,
    required this.entry,
    required this.isFirst,
    required this.isLast,
  });

  final CareerEntry entry;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = entry;
    final dotColor = e.isCurrent ? AppTheme.accent : palette.border;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 2,
                  height: 8,
                  color: isFirst ? Colors.transparent : palette.border,
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
              child: Semantics(
                button: true,
                label:
                    '${e.role ?? 'Role'}'
                    '${e.organization != null ? ', ${e.organization}' : ''}, '
                    '${e.span}. Opens career detail.',
                child: Material(
                  color: palette.elevated,
                  borderRadius: AppTheme.radiusSm,
                  child: InkWell(
                    borderRadius: AppTheme.radiusSm,
                    onTap: () => showCareerDetailSheet(context, e),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 56),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
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
                                      style: theme.textTheme.bodySmall
                                          ?.copyWith(
                                            color: palette.textSecondary,
                                          ),
                                    ),
                                ],
                              ),
                            ),
                            Icon(
                              Icons.chevron_right_rounded,
                              size: 20,
                              color: palette.textMuted,
                            ),
                          ],
                        ),
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

// ── Detail bottom sheet ────────────────────────────────────────────────

/// Opens the native career-detail sheet: drag-to-dismiss, scrollable,
/// safe-area aware, with an explicit close button and a large source link.
Future<void> showCareerDetailSheet(BuildContext context, CareerEntry e) {
  final palette = context.palette;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: palette.card,
    constraints: const BoxConstraints(maxWidth: 640),
    builder: (context) => _CareerDetailSheet(entry: e),
  );
}

class _CareerDetailSheet extends StatelessWidget {
  const _CareerDetailSheet({required this.entry});

  final CareerEntry entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final e = entry;

    final rows = <(String, String)>[
      if (e.role != null) ('Role', e.role!),
      if (e.organization != null) ('Organization', e.organization!),
      ('Dates', e.span),
      if (e.location != null) ('Location', e.location!),
    ];

    return Semantics(
      container: true,
      label: 'Career detail',
      child: SafeArea(
        top: false,
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(context).height * 0.72,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 4, 12, 20),
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
                        child: Text(
                          e.role ?? e.organization ?? 'Career role',
                          style: theme.textTheme.titleMedium,
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                      tooltip: 'Close',
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                for (final (label, value) in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label.toUpperCase(),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: palette.textMuted,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(value, style: theme.textTheme.bodyLarge),
                      ],
                    ),
                  ),
                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.tonalIcon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(52),
                      alignment: Alignment.centerLeft,
                    ),
                    onPressed:
                        e.sourceUrl == null
                            ? null
                            : () async {
                              final uri = Uri.tryParse(e.sourceUrl!);
                              if (uri != null) {
                                await launchUrl(
                                  uri,
                                  mode: LaunchMode.externalApplication,
                                );
                              }
                            },
                    icon: const Icon(Icons.open_in_new_rounded, size: 18),
                    label: Text(
                      e.sourceUrl == null
                          ? 'Source: ${e.sourceName}'
                          : 'View source · ${e.sourceName}',
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Insight rows ───────────────────────────────────────────────────────

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
