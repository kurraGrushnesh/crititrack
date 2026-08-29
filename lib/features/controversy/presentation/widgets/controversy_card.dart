/// A single expandable controversy entry used inside [ControversySection].
///
/// Collapsed: severity indicator, title, year, category, status.
/// Expanded: the neutral summary plus any cited sources.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:crititrack/core/security/safe_url.dart';

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
                                  const SizedBox(height: 10),
                                  _Sources(sources: c.sources),
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


/// The citations behind one record.
///
/// A source that is a URL is tappable; one that is only a publication
/// name is a label. Both are shown, because the gate that lets a record
/// through requires a source to be *named*, not to be linkable — and a
/// card that quietly hid the unlinkable ones would misrepresent what is
/// actually backing it.
///
/// Every URL goes through [SafeUrl] first (SEC-06). These strings come
/// from a model, so a `javascript:` or `file:` scheme is exactly the kind
/// of thing that must never reach a launcher.
class _Sources extends StatelessWidget {
  const _Sources({required this.sources});

  final List<String> sources;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SOURCES',
          style: theme.textTheme.labelSmall?.copyWith(
            color: palette.textMuted,
            fontSize: 9,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [for (final s in sources) _SourceChip(source: s)],
        ),
      ],
    );
  }
}

class _SourceChip extends StatelessWidget {
  const _SourceChip({required this.source});

  final String source;

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

    final uri = SafeUrl.parse(source);
    final label = uri == null ? source : SafeUrl.displayHost(source);

    final chip = Container(
      constraints: const BoxConstraints(maxWidth: 240),
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: palette.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            uri == null ? Icons.description_outlined : Icons.link_rounded,
            size: 12,
            color: uri == null ? palette.textMuted : AppTheme.primary,
          ),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.labelSmall?.copyWith(
                color: uri == null ? palette.textSecondary : AppTheme.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );

    if (uri == null) return chip;

    return Semantics(
      link: true,
      label: 'Open source $label',
      excludeSemantics: true,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(6),
          onTap: () => _open(context, uri),
          // 48dp minimum tap target, matching the accessibility guards.
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 48),
            child: Align(
              alignment: Alignment.centerLeft,
              widthFactor: 1,
              child: chip,
            ),
          ),
        ),
      ),
    );
  }
}
