/// Expandable evidence panel showing model-cited fragments.
///
/// Renders 1–2 evidence excerpts with source badges beneath the
/// sentiment section. Includes an "algorithmically generated"
/// disclaimer per NFR-6.
///
/// Phase 2 — Explainable Sentiment Layer.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class EvidencePanel extends StatefulWidget {
  const EvidencePanel({super.key, required this.evidence});

  final List<SentimentEvidence> evidence;

  @override
  State<EvidencePanel> createState() => _EvidencePanelState();
}

class _EvidencePanelState extends State<EvidencePanel>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    if (widget.evidence.isEmpty) return const SizedBox.shrink();

    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(
          color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.22),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header (tappable) ──────────────────────────────────
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: AppTheme.radiusMd,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.lightbulb_outline_rounded,
                    size: 16,
                    color: AppTheme.warning,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'What the model pointed to',
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0.0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: palette.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Expandable content ────────────────────────────────
          AnimatedCrossFade(
            firstChild: const SizedBox(width: double.infinity, height: 0),
            secondChild: Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(height: 1, color: palette.border),
                  const SizedBox(height: 12),

                  // Evidence fragments
                  ...widget.evidence.map((e) => _EvidenceItem(evidence: e)),

                  const SizedBox(height: 10),

                  // NFR-6 disclaimer
                  Row(
                    children: [
                      Icon(
                        Icons.info_outline_rounded,
                        size: 12,
                        color: palette.textMuted,
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Algorithmically generated — not verified facts',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: palette.textMuted,
                            fontStyle: FontStyle.italic,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            crossFadeState:
                _expanded
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
            duration: const Duration(milliseconds: 250),
          ),
        ],
      ),
    );
  }
}

/// A single evidence fragment with its source badge.
class _EvidenceItem extends StatelessWidget {
  const _EvidenceItem({required this.evidence});

  final SentimentEvidence evidence;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Source badge
          Container(
            margin: const EdgeInsets.only(top: 2),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: _sourceColor(
                context,
                evidence.source,
              ).withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _sourceLabel(evidence.source),
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                color: _sourceColor(context, evidence.source),
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Fragment text
          Expanded(
            child: Text(
              '"${evidence.fragment}"',
              style: theme.textTheme.bodyMedium?.copyWith(
                fontStyle: FontStyle.italic,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Color _sourceColor(BuildContext context, String source) => switch (source
      .toLowerCase()) {
    'news' => AppTheme.secondary,
    'youtube' => AppTheme.error,
    'instagram' => AppTheme.accent,
    _ => context.palette.textSecondary,
  };

  String _sourceLabel(String source) => switch (source.toLowerCase()) {
    'news' => 'NEWS',
    'youtube' => 'YT',
    'instagram' => 'IG',
    _ => source.toUpperCase(),
  };
}
