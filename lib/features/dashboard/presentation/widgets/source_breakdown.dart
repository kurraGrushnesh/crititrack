/// Per-source sentiment score breakdown chips.
///
/// Shows News / YouTube / Instagram sub-scores as color-coded
/// mini chips next to the main blended score. Falls back gracefully
/// to just the blended score if per-source scores are null.
///
/// Phase 5 — Source-Level Sentiment Decomposition.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/helpers.dart';

class SourceBreakdown extends StatelessWidget {
  const SourceBreakdown({super.key, required this.sentimentData});

  final SentimentData sentimentData;

  @override
  Widget build(BuildContext context) {
    final hasSourceScores =
        sentimentData.scoreNews != null ||
        sentimentData.scoreYoutube != null ||
        sentimentData.scoreInstagram != null;

    if (!hasSourceScores) return const SizedBox.shrink();

    final palette = context.palette;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                Icons.stacked_bar_chart_rounded,
                size: 14,
                color: palette.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                'Source Breakdown',
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const Spacer(),
              // NFR-6 indicator
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                // A provenance disclosure, so it has to be readable: it
                // was 8px in a hue that measures ~1.7:1 on its own tint
                // in light mode, and used an emoji as its icon.
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.auto_awesome_rounded,
                      size: 12,
                      color: context.palette.sentimentNeutralText,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Algorithmically generated',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: context.palette.sentimentNeutralText,
                        letterSpacing: 0.3,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // Score chips
          Row(
            children: [
              if (sentimentData.scoreNews != null)
                Expanded(
                  child: _SourceChip(
                    label: 'News',
                    score: sentimentData.scoreNews!,
                    icon: Icons.article_outlined,
                    color: AppTheme.secondary,
                  ),
                ),
              if (sentimentData.scoreNews != null &&
                  (sentimentData.scoreYoutube != null ||
                      sentimentData.scoreInstagram != null))
                const SizedBox(width: 6),
              if (sentimentData.scoreYoutube != null)
                Expanded(
                  child: _SourceChip(
                    label: 'YouTube',
                    score: sentimentData.scoreYoutube!,
                    icon: Icons.play_circle_outline_rounded,
                    color: AppTheme.error,
                  ),
                ),
              if (sentimentData.scoreYoutube != null &&
                  sentimentData.scoreInstagram != null)
                const SizedBox(width: 6),
              if (sentimentData.scoreInstagram != null)
                Expanded(
                  child: _SourceChip(
                    label: 'Instagram',
                    score: sentimentData.scoreInstagram!,
                    icon: Icons.camera_alt_outlined,
                    color: AppTheme.accent,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

/// A single source score chip with icon, label, and color-coded score.
class _SourceChip extends StatelessWidget {
  const _SourceChip({
    required this.label,
    required this.score,
    required this.icon,
    required this.color,
  });

  final String label;
  final double score;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final scoreColor = sentimentColor(score);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: AppTheme.radiusSm,
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: context.palette.textMuted,
                    letterSpacing: 0.3,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  '${score.toInt()}',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: scoreColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
