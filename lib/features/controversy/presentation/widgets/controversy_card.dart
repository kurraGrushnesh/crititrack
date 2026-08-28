/// A single expandable controversy entry used inside [ControversySection].
///
/// Collapsed: severity indicator, title, year, category, status.
/// Expanded: the neutral summary plus any cited sources.
library;

import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/theme/app_theme.dart';

/// Maps a 1–5 severity to a colour on the amber → red ramp.
Color severityColor(int severity) {
  switch (severity) {
    case 1:
      return AppTheme.warning;
    case 2:
      return const Color(0xFFF0A94E);
    case 3:
      return const Color(0xFFE8834A);
    case 4:
      return const Color(0xFFE06A52);
    default:
      return AppTheme.error;
  }
}

String severityLabel(int severity) {
  switch (severity) {
    case 1:
      return 'Minor';
    case 2:
      return 'Notable';
    case 3:
      return 'Serious';
    case 4:
      return 'Severe';
    default:
      return 'Major';
  }
}

class ControversyCard extends StatefulWidget {
  const ControversyCard({super.key, required this.controversy});

  final Controversy controversy;

  @override
  State<ControversyCard> createState() => _ControversyCardState();
}

class _ControversyCardState extends State<ControversyCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final c = widget.controversy;
    final sevColor = severityColor(c.severity);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(
          color:
              c.isOngoing
                  ? AppTheme.error.withValues(alpha: 0.35)
                  : palette.border,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: AppTheme.radiusMd,
          onTap: () => setState(() => _expanded = !_expanded),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Severity rail ──────────────────────────────
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: sevColor.withValues(alpha: 0.15),
                        borderRadius: AppTheme.radiusSm,
                        border: Border.all(
                          color: sevColor.withValues(alpha: 0.4),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${c.severity}',
                        style: TextStyle(
                          color: sevColor,
                          fontWeight: FontWeight.w700,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            c.title,
                            style: theme.textTheme.titleSmall?.copyWith(
                              color: palette.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Wrap(
                            spacing: 6,
                            runSpacing: 4,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              _MiniTag(
                                label: severityLabel(c.severity),
                                color: sevColor,
                              ),
                              _MiniTag(
                                label: c.category,
                                color: palette.brandText,
                              ),
                              if (c.year != null)
                                _MiniTag(
                                  label: '${c.year}',
                                  color: palette.textSecondary,
                                ),
                              _StatusTag(status: c.status),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      _expanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 20,
                      color: palette.textMuted,
                    ),
                  ],
                ),
                AnimatedSize(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeInOut,
                  alignment: Alignment.topLeft,
                  child:
                      !_expanded
                          ? const SizedBox(width: double.infinity)
                          : Padding(
                            padding: const EdgeInsets.only(top: 10, left: 46),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (c.summary.isNotEmpty)
                                  Text(
                                    c.summary,
                                    style: theme.textTheme.bodyMedium?.copyWith(
                                      height: 1.5,
                                    ),
                                  ),
                                if (c.sources.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    'Sources: ${c.sources.join(' · ')}',
                                    style: theme.textTheme.bodySmall?.copyWith(
                                      color: palette.textMuted,
                                      fontStyle: FontStyle.italic,
                                    ),
                                  ),
                                ],
                              ],
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

class _MiniTag extends StatelessWidget {
  const _MiniTag({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _StatusTag extends StatelessWidget {
  const _StatusTag({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (status) {
      ControversyStatus.ongoing => (AppTheme.error, 'Ongoing'),
      ControversyStatus.resolved => (AppTheme.success, 'Resolved'),
      _ => (context.palette.textMuted, 'Historical'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(5),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
