/// Native mobile UX for the Claim Verification Matrix — an expandable
/// claim list embedded in [ControversyCard], with a bottom sheet that
/// breaks one claim's evidence into Supporting / Conflicting / Response /
/// Context sections. Never a truth verdict: the strongest status shown
/// is "resolved by authoritative finding", and only when the linked
/// evidence is itself a court/official record.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crititrack/core/security/safe_url.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/evidence.dart';

const List<(ClaimFilter, String)> _kFilters = [
  (ClaimFilter.all, 'All'),
  (ClaimFilter.supported, 'Supported'),
  (ClaimFilter.conflicting, 'Conflicting'),
  (ClaimFilter.insufficient, 'Insufficient'),
  (ClaimFilter.responses, 'Responses'),
  (ClaimFilter.officialFindings, 'Official findings'),
];

Color _statusColor(ClaimStatus status) {
  switch (status) {
    case ClaimStatus.supported:
    case ClaimStatus.resolvedAuthoritative:
      return AppTheme.success;
    case ClaimStatus.partiallySupported:
      return AppTheme.primary;
    case ClaimStatus.conflicting:
      return AppTheme.warning;
    case ClaimStatus.reportedUncorroborated:
    case ClaimStatus.insufficientEvidence:
    case ClaimStatus.unknown:
      return AppTheme.error.withValues(alpha: 0.6);
  }
}

class ClaimsMatrix extends StatefulWidget {
  const ClaimsMatrix({
    super.key,
    required this.claims,
    required this.evidenceItems,
  });

  /// This controversy's claims only (already filtered by controversyId).
  final List<Claim> claims;

  /// The full evidence pool, so a claim's evidence IDs can be resolved
  /// to real source rows in the detail sheet.
  final List<EvidenceItem> evidenceItems;

  @override
  State<ClaimsMatrix> createState() => _ClaimsMatrixState();
}

class _ClaimsMatrixState extends State<ClaimsMatrix> {
  ClaimFilter _filter = ClaimFilter.all;

  @override
  Widget build(BuildContext context) {
    if (widget.claims.isEmpty) return const SizedBox.shrink();
    final theme = Theme.of(context);
    final palette = context.palette;
    final shown = filterClaims(widget.claims, _filter);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 4),
        Text(
          'CLAIMS',
          style: theme.textTheme.labelSmall?.copyWith(
            color: palette.textMuted,
            fontSize: 10.5,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
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
        if (shown.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'No claims match this filter.',
              style: theme.textTheme.bodySmall?.copyWith(color: palette.textMuted),
            ),
          )
        else
          ...shown.map(
            (c) => _ClaimCard(claim: c, evidenceItems: widget.evidenceItems),
          ),
      ],
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
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color:
                selected
                    ? AppTheme.primary.withValues(alpha: 0.14)
                    : palette.elevated,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? AppTheme.primary : palette.border,
            ),
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

class _ClaimCard extends StatefulWidget {
  const _ClaimCard({required this.claim, required this.evidenceItems});

  final Claim claim;
  final List<EvidenceItem> evidenceItems;

  @override
  State<_ClaimCard> createState() => _ClaimCardState();
}

class _ClaimCardState extends State<_ClaimCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final c = widget.claim;
    final color = _statusColor(c.status);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: palette.card,
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
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.claimType.label.toUpperCase(),
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: palette.textMuted,
                              fontSize: 9.5,
                              letterSpacing: 0.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            c.claimText,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: _expanded ? null : 2,
                            overflow: _expanded ? null : TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 18,
                      color: palette.textMuted,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    _StatusChip(status: c.status, color: color),
                    _ConfidenceChip(confidence: c.confidence),
                  ],
                ),
                if (_expanded) ...[
                  const SizedBox(height: 8),
                  Text(
                    c.statusReason,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 8),
                  InkWell(
                    borderRadius: AppTheme.radiusSm,
                    onTap:
                        () => showClaimEvidenceSheet(
                          context,
                          claim: c,
                          evidenceItems: widget.evidenceItems,
                        ),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.fact_check_outlined,
                            size: 14,
                            color: palette.brandText,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            'View evidence (${c.evidenceCount})',
                            style: TextStyle(
                              color: palette.brandText,
                              fontWeight: FontWeight.w600,
                              fontSize: 12.5,
                            ),
                          ),
                        ],
                      ),
                    ),
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status, required this.color});

  final ClaimStatus status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _ConfidenceChip extends StatelessWidget {
  const _ConfidenceChip({required this.confidence});

  final ClaimConfidence confidence;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.speed_rounded, size: 11, color: palette.textMuted),
          const SizedBox(width: 3),
          Text(
            '${confidence.label} confidence',
            style: TextStyle(
              color: palette.textSecondary,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Evidence bottom sheet ───────────────────────────────────────────

void showClaimEvidenceSheet(
  BuildContext context, {
  required Claim claim,
  required List<EvidenceItem> evidenceItems,
}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _ClaimEvidenceSheet(claim: claim, evidenceItems: evidenceItems),
  );
}

EvidenceItem? _find(List<EvidenceItem> items, String id) {
  for (final e in items) {
    if (e.evidenceId == id) return e;
  }
  return null;
}

class _ClaimEvidenceSheet extends StatelessWidget {
  const _ClaimEvidenceSheet({required this.claim, required this.evidenceItems});

  final Claim claim;
  final List<EvidenceItem> evidenceItems;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final supporting =
        claim.supportingEvidenceIds.map((id) => _find(evidenceItems, id)).whereType<EvidenceItem>().toList();
    final contradicting =
        claim.contradictingEvidenceIds.map((id) => _find(evidenceItems, id)).whereType<EvidenceItem>().toList();
    final responses =
        claim.responseEvidenceIds.map((id) => _find(evidenceItems, id)).whereType<EvidenceItem>().toList();
    final context_ =
        claim.neutralEvidenceIds.map((id) => _find(evidenceItems, id)).whereType<EvidenceItem>().toList();

    final empty = supporting.isEmpty && contradicting.isEmpty && responses.isEmpty && context_.isEmpty;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.35,
      maxChildSize: 0.92,
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
                decoration: BoxDecoration(
                  color: palette.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      claim.claimText,
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      claim.status.label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: _statusColor(claim.status),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child:
                    empty
                        ? ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.all(18),
                          children: [
                            Text(
                              'No supporting source found.',
                              style: theme.textTheme.bodyMedium?.copyWith(
                                color: palette.textMuted,
                              ),
                            ),
                          ],
                        )
                        : ListView(
                          controller: scrollController,
                          padding: const EdgeInsets.fromLTRB(18, 4, 18, 24),
                          children: [
                            if (supporting.isNotEmpty)
                              _EvidenceGroup(
                                title: 'Supporting',
                                icon: Icons.check_circle_outline,
                                color: AppTheme.success,
                                items: supporting,
                              ),
                            if (contradicting.isNotEmpty)
                              _EvidenceGroup(
                                title: 'Contradicting',
                                icon: Icons.swap_horiz_rounded,
                                color: AppTheme.warning,
                                items: contradicting,
                              ),
                            if (responses.isNotEmpty)
                              _EvidenceGroup(
                                title: 'Response',
                                icon: Icons.reply_rounded,
                                color: AppTheme.primary,
                                items: responses,
                              ),
                            if (context_.isNotEmpty)
                              _EvidenceGroup(
                                title: 'Context',
                                icon: Icons.info_outline,
                                color: palette.textMuted,
                                items: context_,
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

class _EvidenceGroup extends StatelessWidget {
  const _EvidenceGroup({
    required this.title,
    required this.icon,
    required this.color,
    required this.items,
  });

  final String title;
  final IconData icon;
  final Color color;
  final List<EvidenceItem> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                '$title (${items.length})',
                style: theme.textTheme.labelMedium?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ...items.map((e) => _EvidenceRow(item: e)),
        ],
      ),
    );
  }
}

class _EvidenceRow extends StatelessWidget {
  const _EvidenceRow({required this.item});

  final EvidenceItem item;

  Future<void> _open(BuildContext context, Uri uri) async {
    if (await canLaunchUrl(uri)) {
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
    final theme = Theme.of(context);
    final palette = context.palette;
    final uri = item.sourceUrl != null ? SafeUrl.parse(item.sourceUrl!) : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: uri == null ? null : () => _open(context, uri),
          child: Container(
            padding: const EdgeInsets.all(9),
            decoration: BoxDecoration(
              color: palette.elevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: palette.border),
            ),
            child: Row(
              children: [
                Icon(
                  uri == null ? Icons.description_outlined : Icons.link_rounded,
                  size: 13,
                  color: uri == null ? palette.textMuted : AppTheme.primary,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        item.sourceName,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: palette.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
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
