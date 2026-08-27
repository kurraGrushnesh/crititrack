/// Dashboard section dedicated to a public figure's controversy history.
///
/// Renders:
///   1. A 0–100 **Controversy Index** with a severity meter and quick stats.
///   2. A category breakdown.
///   3. A severity-sorted timeline of [ControversyCard]s.
///
/// Reads only the structured [Controversy] list already present on the
/// biography — no additional network calls.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_card.dart';

class ControversySection extends StatelessWidget {
  const ControversySection({
    super.key,
    required this.controversies,
    required this.name,
  });

  final List<Controversy> controversies;
  final String name;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (controversies.isEmpty) {
      return _Shell(
        child: Row(
          children: [
            Icon(
              Icons.verified_user_rounded,
              size: 20,
              color: AppTheme.success,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'No major documented controversies for $name.',
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      );
    }

    final index = computeControversyIndex(controversies);
    final sorted = [...controversies]..sort(_bySeverityThenRecency);
    final byCategory = <String, int>{};
    for (final c in controversies) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    }

    return _Shell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────
          Row(
            children: [
              Icon(Icons.gavel_rounded, size: 20, color: AppTheme.accent),
              const SizedBox(width: 8),
              Text('Controversy Tracker', style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 16),

          // ── Controversy Index ───────────────────────────────────
          _IndexPanel(index: index),
          const SizedBox(height: 14),

          // ── Category breakdown ──────────────────────────────────
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children:
                byCategory.entries.map((e) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceElevated,
                      borderRadius: AppTheme.radiusSm,
                      border: Border.all(color: AppTheme.border),
                    ),
                    child: Text(
                      '${e.key} · ${e.value}',
                      style: const TextStyle(
                        color: AppTheme.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  );
                }).toList(),
          ),
          const SizedBox(height: 16),

          // ── Timeline ────────────────────────────────────────────
          Text(
            'Timeline · ${sorted.length} ${sorted.length == 1 ? "episode" : "episodes"}',
            style: theme.textTheme.labelLarge,
          ),
          const SizedBox(height: 8),
          ...sorted.map((c) => ControversyCard(controversy: c)),

          const SizedBox(height: 4),
          Row(
            children: [
              Icon(
                Icons.auto_fix_high_rounded,
                size: 10,
                color: AppTheme.warning.withValues(alpha: 0.7),
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  'Index and severities are AI-assessed from public reporting',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppTheme.textMuted,
                    fontSize: 9,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static int _bySeverityThenRecency(Controversy a, Controversy b) {
    // Ongoing episodes float to the top.
    if (a.isOngoing != b.isOngoing) return a.isOngoing ? -1 : 1;
    if (a.severity != b.severity) return b.severity.compareTo(a.severity);
    return (b.year ?? 0).compareTo(a.year ?? 0);
  }
}

// ── Index panel ───────────────────────────────────────────────────

class _IndexPanel extends StatelessWidget {
  const _IndexPanel({required this.index});

  final ControversyIndex index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = _indexColor(index.score);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            color.withValues(alpha: 0.12),
            color.withValues(alpha: 0.02),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${index.rounded}',
                style: TextStyle(
                  color: color,
                  fontWeight: FontWeight.w800,
                  fontSize: 40,
                  height: 1,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(width: 4),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  '/ 100',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppTheme.textMuted,
                  ),
                ),
              ),
              const Spacer(),
              Flexible(
                child: Text(
                  index.label,
                  textAlign: TextAlign.right,
                  style: theme.textTheme.labelLarge?.copyWith(color: color),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Meter
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: Stack(
              children: [
                Container(height: 8, color: AppTheme.surfaceElevated),
                FractionallySizedBox(
                  widthFactor: (index.score / 100).clamp(0.02, 1.0),
                  child: Container(
                    height: 8,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [color.withValues(alpha: 0.7), color],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Text(
            '${index.total} ${index.total == 1 ? "episode" : "episodes"}'
            ' · peak severity ${index.peakSeverity}/5'
            '${index.ongoingCount > 0 ? " · ${index.ongoingCount} ongoing" : ""}',
            style: theme.textTheme.bodySmall?.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Color _indexColor(double score) {
    if (score < 35) return AppTheme.success;
    if (score < 55) return AppTheme.warning;
    if (score < 75) return const Color(0xFFE8834A);
    return AppTheme.error;
  }
}

// ── Shared shell ──────────────────────────────────────────────────

class _Shell extends StatelessWidget {
  const _Shell({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border),
      ),
      child: child,
    );
  }
}
