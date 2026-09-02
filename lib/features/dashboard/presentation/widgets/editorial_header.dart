import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/controversy_index.dart';

/// The editorial profile header: an oversized name, a one-line subtitle,
/// a four-cell stat table, and a large portrait. The dense chrome that
/// used to live in the app bar moves here so the page opens like a
/// published profile rather than a dashboard.
class EditorialHeader extends StatelessWidget {
  const EditorialHeader({super.key, required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);
    final wide = MediaQuery.of(context).size.width >= 720;

    final index = computeControversyIndex(celebrity.biography.controversies);
    final stats = <(String, String)>[
      ('Index', '${index.rounded}'),
      ('Sentiment', '${celebrity.sentimentData.overallScore.round()}'),
      ('Coverage', '${celebrity.mediaItems.length}'),
      ('Episodes', '${celebrity.biography.controversies.length}'),
    ];

    final nameBlock = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          celebrity.name,
          style: theme.textTheme.displaySmall?.copyWith(
            fontWeight: FontWeight.w800,
            height: 0.98,
            letterSpacing: -1,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          celebrity.verified
              ? '${_profession(celebrity)} · resolved on Wikidata'
              : _profession(celebrity),
          style: theme.textTheme.titleMedium?.copyWith(
            color: palette.textSecondary,
          ),
        ),
        const SizedBox(height: 24),
        _StatTable(stats: stats),
      ],
    );

    final portrait = _Portrait(
      imageUrl: celebrity.imageUrl,
      name: celebrity.name,
    );

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
      child: wide
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 5, child: nameBlock),
                const SizedBox(width: 28),
                Expanded(flex: 4, child: portrait),
              ],
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                nameBlock,
                const SizedBox(height: 24),
                portrait,
              ],
            ),
    );
  }

  static String _profession(Celebrity c) {
    final p = c.biography.profession.trim();
    return p.isEmpty ? 'Public figure' : p;
  }
}

class _StatTable extends StatelessWidget {
  const _StatTable({required this.stats});

  final List<(String, String)> stats;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final theme = Theme.of(context);
    final side = BorderSide(color: palette.borderStrong);

    Widget cell(String k, String v, {required bool first}) => Expanded(
          child: Container(
            decoration: BoxDecoration(
              border: Border(left: first ? BorderSide.none : side),
            ),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 6),
            child: Column(
              children: [
                Text(
                  k.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: palette.textMuted,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  v,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
          ),
        );

    return Container(
      constraints: const BoxConstraints(maxWidth: 460),
      decoration: BoxDecoration(
        border: Border.all(color: palette.borderStrong),
        borderRadius: BorderRadius.circular(4),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          for (var i = 0; i < stats.length; i++)
            cell(stats[i].$1, stats[i].$2, first: i == 0),
        ],
      ),
    );
  }
}

class _Portrait extends StatelessWidget {
  const _Portrait({required this.imageUrl, required this.name});

  final String? imageUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    final fallback = DecoratedBox(
      decoration: BoxDecoration(color: palette.elevated),
      child: Center(
        child: Text(
          _initials(name),
          style: Theme.of(context).textTheme.displayMedium?.copyWith(
                fontWeight: FontWeight.w800,
                color: palette.textPrimary,
              ),
        ),
      ),
    );

    final Widget content = (imageUrl == null || imageUrl!.isEmpty)
        ? fallback
        : ColorFiltered(
            colorFilter: const ColorFilter.matrix(<double>[
              0.2126, 0.7152, 0.0722, 0, 0, //
              0.2126, 0.7152, 0.0722, 0, 0, //
              0.2126, 0.7152, 0.0722, 0, 0, //
              0, 0, 0, 1, 0,
            ]),
            child: CachedNetworkImage(
              imageUrl: imageUrl!,
              fit: BoxFit.cover,
              alignment: const Alignment(0, -0.25),
              placeholder: (_, __) => fallback,
              errorWidget: (_, __, ___) => fallback,
            ),
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(18),
      child: AspectRatio(
        aspectRatio: 4 / 5,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border.all(color: palette.border),
            borderRadius: BorderRadius.circular(18),
          ),
          child: content,
        ),
      ),
    );
  }

  static String _initials(String name) => name
      .split(RegExp(r'\s+'))
      .where((w) => w.isNotEmpty)
      .take(2)
      .map((w) => w[0].toUpperCase())
      .join();
}
