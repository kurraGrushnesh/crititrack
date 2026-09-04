/// The native "How this score was computed" bottom sheet — the mobile
/// answer to the web's `/controversy-index` page and its collapsible
/// breakdown. One card per documented episode, the same arithmetic the
/// web `IndexExplanation` shows (severity × recency × unresolved),
/// touch-friendly source links, and the explicit CritiScore-vs-sentiment
/// and corroboration-gate notes. Nothing here is computed again — it
/// reads the same deterministic result the score itself came from.
library;

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/security/safe_url.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/controversy_index.dart';

/// Opens the sheet: drag handle, drag-to-dismiss, scrollable, safe-area
/// aware, explicit close button.
Future<void> showControversyMethodologySheet(
  BuildContext context, {
  required List<Controversy> controversies,
  required ControversyIndex index,
}) {
  final palette = context.palette;
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    backgroundColor: palette.card,
    builder:
        (context) =>
            _MethodologySheet(controversies: controversies, index: index),
  );
}

class _MethodologySheet extends StatelessWidget {
  const _MethodologySheet({required this.controversies, required this.index});

  final List<Controversy> controversies;
  final ControversyIndex index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final explanation = explainControversyIndex(controversies);
    final sourceCounts = {
      for (final c in controversies) c.title: c.sources.length,
    };

    return SafeArea(
      top: false,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.82,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 12, 24),
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
                        'How this score was computed',
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
              Text(
                'Total weight ${explanation.totalWeight.toStringAsFixed(2)} → '
                '${explanation.score.toStringAsFixed(1)} / 100',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: 12),
              for (final row in explanation.rows)
                _EpisodeCard(
                  row: row,
                  sourceCount: sourceCounts[row.title] ?? 0,
                  sources:
                      controversies
                          .firstWhere(
                            (c) => c.title == row.title,
                            orElse: () => controversies.first,
                          )
                          .sources,
                ),
              const SizedBox(height: 4),
              Text(
                explanation.curve,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: palette.textMuted,
                ),
              ),
              const SizedBox(height: 10),
              _Note(
                icon: Icons.gavel_rounded,
                text:
                    'An allegation the retrieved coverage does not '
                    'corroborate is dropped before it reaches this score — '
                    'a severity 4 or 5 claim with no source never counts.',
              ),
              const SizedBox(height: 8),
              _Note(
                icon: Icons.compare_arrows_rounded,
                text:
                    'This is not Public Sentiment. CritiScore is a fixed '
                    'calculation over documented episodes; sentiment '
                    'reflects the tone of current coverage and can move '
                    'independently.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 14, color: palette.textMuted),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textMuted,
            ),
          ),
        ),
      ],
    );
  }
}

class _EpisodeCard extends StatefulWidget {
  const _EpisodeCard({
    required this.row,
    required this.sourceCount,
    required this.sources,
  });

  final IndexExplanationRow row;
  final int sourceCount;
  final List<String> sources;

  @override
  State<_EpisodeCard> createState() => _EpisodeCardState();
}

class _EpisodeCardState extends State<_EpisodeCard> {
  bool _open = false;

  String get _reason {
    final r = widget.row;
    final parts = <String>['severity ${r.severity}/5'];
    parts.add(
      r.year != null
          ? (r.contribution.recencyFactor >= 0.99
              ? 'recent (${r.year})'
              : 'older (${r.year})')
          : 'undated (mildly discounted)',
    );
    if (r.ongoing) parts.add('unresolved (weighted up)');
    parts.add(
      widget.sourceCount > 0
          ? '${widget.sourceCount} source${widget.sourceCount == 1 ? '' : 's'}'
          : 'no source on file',
    );
    return parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final r = widget.row;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
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
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        r.year != null ? '${r.title} (${r.year})' : r.title,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Text(
                      '${r.points.toStringAsFixed(1)} pts',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: palette.brandText,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  _reason,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                if (_open) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 10,
                    runSpacing: 4,
                    children: [
                      _Factor('severity', r.contribution.severityBase),
                      _Factor('recency', r.contribution.recencyFactor),
                      _Factor('unresolved', r.contribution.ongoingFactor),
                    ],
                  ),
                  if (widget.sources.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        for (final s in widget.sources) _SourceLink(source: s),
                      ],
                    ),
                  ],
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Factor extends StatelessWidget {
  const _Factor(this.label, this.value);
  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Text(
      '$label ${value.toStringAsFixed(2)}',
      style: TextStyle(color: palette.textMuted, fontSize: 11.5),
    );
  }
}

/// A large, touch-friendly source link — a full-width row, not a tiny
/// chip, per the mobile spec's "touch-friendly source links".
class _SourceLink extends StatelessWidget {
  const _SourceLink({required this.source});
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
    final palette = context.palette;
    final uri = SafeUrl.parse(source);
    final label = uri == null ? source : SafeUrl.displayHost(source);

    return Material(
      color: palette.card,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: uri == null ? null : () => _open(context, uri),
        child: Container(
          constraints: const BoxConstraints(minHeight: 40),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            border: Border.all(color: palette.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                uri == null ? Icons.description_outlined : Icons.link_rounded,
                size: 14,
                color: uri == null ? palette.textMuted : AppTheme.primary,
              ),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color:
                        uri == null ? palette.textSecondary : AppTheme.primary,
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
