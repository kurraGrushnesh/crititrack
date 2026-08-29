/// Dashboard section dedicated to a public figure's controversy history.
///
/// Renders:
///   1. A 0–100 **Controversy Index** with a severity meter and quick stats.
///   2. A category breakdown.
///   3. A timeline of [ControversyCard]s, orderable by severity or by
///      date.
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
    final palette = context.palette;

    if (controversies.isEmpty) {
      return _Shell(
        child: Row(
          children: [
            const Icon(
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
              const Icon(Icons.gavel_rounded, size: 20, color: AppTheme.accent),
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
                      color: palette.elevated,
                      borderRadius: AppTheme.radiusSm,
                      border: Border.all(color: palette.border),
                    ),
                    child: Text(
                      '${e.key} · ${e.value}',
                      style: TextStyle(
                        color: palette.textSecondary,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  );
                }).toList(),
          ),
          const SizedBox(height: 16),

          // ── Timeline ────────────────────────────────────────────
          _Timeline(controversies: controversies),

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
                  'Index and severities are algorithmically assessed from public '
                  'reporting',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textMuted,
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
}

// ── Index panel ───────────────────────────────────────────────────

class _IndexPanel extends StatelessWidget {
  const _IndexPanel({required this.index});

  final ControversyIndex index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
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
                    color: palette.textMuted,
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
                Container(height: 8, color: palette.elevated),
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
              color: palette.textSecondary,
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
    final palette = context.palette;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.softShadow,
      ),
      child: child,
    );
  }
}

/// How the timeline is ordered.
enum _Order {
  /// Ongoing first, then severity, then recency. The default, because
  /// "what is this person in trouble for" is the question the screen
  /// exists to answer.
  severity('Most serious'),

  /// Newest first. Answers a different question — how a record built up
  /// over time — which severity ordering actively obscures.
  chronological('By date');

  const _Order(this.label);
  final String label;
}

/// The episode list, with its ordering.
///
/// Held as state here rather than on the section so that switching the
/// order does not rebuild the index panel and the category breakdown,
/// neither of which depends on it.
class _Timeline extends StatefulWidget {
  const _Timeline({required this.controversies});

  final List<Controversy> controversies;

  @override
  State<_Timeline> createState() => _TimelineState();
}

class _TimelineState extends State<_Timeline> {
  _Order _order = _Order.severity;

  List<Controversy> get _sorted {
    final list = [...widget.controversies];
    list.sort(_order == _Order.severity ? _bySeverityThenRecency : _byDate);
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final sorted = _sorted;
    final n = sorted.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Timeline · $n ${n == 1 ? "episode" : "episodes"}',
                style: theme.textTheme.labelLarge,
              ),
            ),
            // Only worth offering when there is more than one thing to
            // order.
            if (n > 1)
              for (final order in _Order.values)
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: _OrderButton(
                    order: order,
                    selected: order == _order,
                    onTap: () => setState(() => _order = order),
                  ),
                ),
          ],
        ),
        const SizedBox(height: 8),
        if (_order == _Order.chronological &&
            sorted.any((c) => c.year == null)) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(
              'Episodes with no recorded year are listed last.',
              style: theme.textTheme.bodySmall?.copyWith(
                color: palette.textMuted,
                fontSize: 10.5,
              ),
            ),
          ),
        ],
        ...sorted.map((c) => ControversyCard(controversy: c)),
      ],
    );
  }
}

class _OrderButton extends StatelessWidget {
  const _OrderButton({
    required this.order,
    required this.selected,
    required this.onTap,
  });

  final _Order order;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Semantics(
      button: true,
      selected: selected,
      label: 'Order the timeline: ${order.label}',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          // 48dp minimum tap target, matching the accessibility guards.
          child: SizedBox(
            height: 48,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color:
                      selected
                          ? AppTheme.primary.withValues(alpha: 0.14)
                          : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: selected ? AppTheme.primary : palette.border,
                  ),
                ),
                child: Text(
                  order.label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: selected ? AppTheme.primary : palette.textSecondary,
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

/// Ongoing first, then severity, then recency.
int _bySeverityThenRecency(Controversy a, Controversy b) {
  if (a.isOngoing != b.isOngoing) return a.isOngoing ? -1 : 1;
  if (a.severity != b.severity) return b.severity.compareTo(a.severity);
  return (b.year ?? 0).compareTo(a.year ?? 0);
}

/// Newest first, with undated episodes last.
///
/// Undated ones sort last rather than as year zero: a record with no
/// recorded year is not from antiquity, it is simply unknown, and burying
/// it at the bottom says that more honestly than placing it before 1900.
int _byDate(Controversy a, Controversy b) {
  final ay = a.year;
  final by = b.year;

  if (ay == null && by == null) return _bySeverityThenRecency(a, b);
  if (ay == null) return 1;
  if (by == null) return -1;
  if (ay != by) return by.compareTo(ay);

  return _bySeverityThenRecency(a, b);
}
