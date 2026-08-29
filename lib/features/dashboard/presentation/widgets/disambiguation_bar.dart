/// The chooser shown when a name matched more than one person.
///
/// "Michael Jordan" is a basketball player, a footballer and a professor
/// of computer science. Wikidata's search ranks them, and the backend
/// takes the top-ranked human — which is a guess. Presenting that guess
/// as the only reading is what F01 asks us not to do, so the pick is
/// stated and the alternatives are offered beside it.
///
/// Choosing one pins the lookup by Wikidata id rather than re-searching
/// its label. Searching again would be circular: two people can share a
/// label exactly, which is how the ambiguity arose.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';

class DisambiguationBar extends ConsumerWidget {
  const DisambiguationBar({
    super.key,
    required this.slug,
    required this.resolvedName,
    required this.resolvedDescription,
    required this.candidates,
  });

  final String slug;
  final String resolvedName;
  final String resolvedDescription;
  final List<EntityCandidate> candidates;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pinned = ref.watch(pinnedEntityProvider)[slug];

    // Nothing to choose between, and nothing pinned to undo.
    if (candidates.isEmpty && pinned == null) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: palette.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.alt_route_rounded,
                size: 14,
                color: palette.textSecondary,
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  resolvedDescription.isEmpty
                      ? 'Showing $resolvedName'
                      : 'Showing $resolvedName — $resolvedDescription',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (candidates.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'That name also matches:',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textMuted,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final candidate in candidates)
                  _CandidateChip(
                    candidate: candidate,
                    selected: candidate.qid == pinned,
                    onTap: () => _pin(ref, candidate.qid),
                  ),
              ],
            ),
          ],
          if (pinned != null) ...[
            const SizedBox(height: 6),
            SizedBox(
              height: 48,
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => _pin(ref, null),
                  icon: const Icon(Icons.undo_rounded, size: 15),
                  label: const Text('Use the best match instead'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Sets or clears the pin for this slug and re-fetches.
  void _pin(WidgetRef ref, String? qid) {
    final next = Map<String, String>.from(ref.read(pinnedEntityProvider));
    if (qid == null) {
      next.remove(slug);
    } else {
      next[slug] = qid;
    }

    ref.read(pinnedEntityProvider.notifier).state = next;
    // The family is keyed by slug, so the pin changes what that slug
    // resolves to and the cached value has to go.
    ref.invalidate(dashboardProvider(slug));
  }
}

class _CandidateChip extends StatelessWidget {
  const _CandidateChip({
    required this.candidate,
    required this.selected,
    required this.onTap,
  });

  final EntityCandidate candidate;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Semantics(
      button: true,
      selected: selected,
      label:
          candidate.description.isEmpty
              ? 'Show ${candidate.label}'
              : 'Show ${candidate.label}, ${candidate.description}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppTheme.radiusSm,
          child: Container(
            // 48dp minimum tap target, matching the accessibility guards.
            constraints: const BoxConstraints(minHeight: 48, maxWidth: 260),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color:
                  selected
                      ? AppTheme.primary.withValues(alpha: 0.14)
                      : palette.card,
              borderRadius: AppTheme.radiusSm,
              border: Border.all(
                color: selected ? AppTheme.primary : palette.border,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  candidate.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: selected ? AppTheme.primary : palette.textPrimary,
                  ),
                ),
                if (candidate.description.isNotEmpty)
                  Text(
                    candidate.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: palette.textMuted,
                      fontSize: 10.5,
                      height: 1.25,
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
