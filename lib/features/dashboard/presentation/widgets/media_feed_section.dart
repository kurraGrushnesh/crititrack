/// Media coverage section.
///
/// Styled to match the Controversy Tracker: a bordered card with a
/// header, a one-line summary, selectable source filters, and a vertical
/// list of compact media rows. Each row opens its URL — externally on
/// web, in the in-app WebView on mobile.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/utils/helpers.dart';

class MediaFeedSection extends StatefulWidget {
  const MediaFeedSection({
    super.key,
    required this.mediaItems,
    required this.slug,
  });

  final List<MediaItem> mediaItems;
  final String slug;

  @override
  State<MediaFeedSection> createState() => _MediaFeedSectionState();
}

/// `null` = show everything; otherwise restrict to one [MediaType].
class _MediaFeedSectionState extends State<MediaFeedSection> {
  MediaType? _filter;

  int _count(MediaType type) =>
      widget.mediaItems.where((i) => i.type == type).length;

  List<MediaItem> get _visible {
    final items =
        _filter == null
            ? widget.mediaItems
            : widget.mediaItems.where((i) => i.type == _filter).toList();
    return [...items]..sort((a, b) {
      final ad = a.publishedAt;
      final bd = b.publishedAt;
      if (ad == null && bd == null) return 0;
      if (ad == null) return 1;
      if (bd == null) return -1;
      return bd.compareTo(ad);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final items = widget.mediaItems;

    if (items.isEmpty) {
      return _Shell(
        child: Row(
          children: [
            Icon(Icons.feed_rounded, size: 20, color: palette.textMuted),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'No media coverage found for ${fromSlug(widget.slug)} yet.',
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      );
    }

    final news = _count(MediaType.news);
    final videos = _count(MediaType.youtube);
    final posts = _count(MediaType.instagram);
    final newest = items
        .map((i) => i.publishedAt)
        .whereType<DateTime>()
        .fold<DateTime?>(
          null,
          (acc, d) => acc == null || d.isAfter(acc) ? d : acc,
        );

    final visible = _visible;

    return _Shell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header ──────────────────────────────────────────────
          Row(
            children: [
              const Icon(
                Icons.newspaper_rounded,
                size: 20,
                color: AppTheme.secondary,
              ),
              const SizedBox(width: 8),
              Text('Media Coverage', style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 12),

          // ── Summary line ────────────────────────────────────────
          Text(
            [
              if (news > 0) '$news ${news == 1 ? "article" : "articles"}',
              if (videos > 0) '$videos ${videos == 1 ? "video" : "videos"}',
              if (posts > 0) '$posts ${posts == 1 ? "post" : "posts"}',
              if (newest != null) 'latest ${timeAgo(newest)}',
            ].join('  ·  '),
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: 14),

          // ── Source filters ──────────────────────────────────────
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _FilterChip(
                label: 'All',
                count: items.length,
                selected: _filter == null,
                onTap: () => setState(() => _filter = null),
              ),
              for (final type in MediaType.values)
                if (_count(type) > 0)
                  _FilterChip(
                    label: _typeLabel(type),
                    count: _count(type),
                    selected: _filter == type,
                    color: _typeColor(type),
                    onTap: () => setState(() => _filter = type),
                  ),
            ],
          ),
          const SizedBox(height: 14),

          // ── List ────────────────────────────────────────────────
          if (visible.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                'Nothing in this category.',
                style: theme.textTheme.bodyMedium,
              ),
            )
          else
            ...visible.map((item) => _MediaRow(item: item, slug: widget.slug)),
        ],
      ),
    );
  }
}

// ── Media row ─────────────────────────────────────────────────────

class _MediaRow extends StatelessWidget {
  const _MediaRow({required this.item, required this.slug});

  final MediaItem item;
  final String slug;

  Future<void> _open(BuildContext context) async {
    if (item.url.isEmpty) return;
    if (kIsWeb) {
      final uri = Uri.parse(item.url);
      if (await canLaunchUrl(uri)) await launchUrl(uri);
      return;
    }
    if (!context.mounted) return;
    context.go(
      '/dashboard/$slug/media?url=${Uri.encodeComponent(item.url)}'
      '&title=${Uri.encodeComponent(item.title)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final color = _typeColor(item.type);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: palette.elevated,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: palette.border),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: AppTheme.radiusMd,
          onTap: () => _open(context),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Thumb(item: item, accent: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleSmall?.copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w600,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: color,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              item.source ?? _typeLabel(item.type),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: palette.textSecondary,
                              ),
                            ),
                          ),
                          if (item.publishedAt != null) ...[
                            Text(
                              '  ·  ',
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: palette.textMuted,
                              ),
                            ),
                            Text(
                              timeAgo(item.publishedAt!),
                              style: theme.textTheme.labelSmall,
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 6),
                Icon(
                  Icons.open_in_new_rounded,
                  size: 15,
                  color: palette.textMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Thumb extends StatelessWidget {
  const _Thumb({required this.item, required this.accent});

  final MediaItem item;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    const size = 60.0;
    final palette = context.palette;

    final fallback = Container(
      width: size,
      height: size,
      color: palette.card,
      alignment: Alignment.center,
      child: Icon(_typeIcon(item.type), color: palette.textMuted, size: 22),
    );

    return ClipRRect(
      borderRadius: AppTheme.radiusSm,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.thumbnailUrl != null && item.thumbnailUrl!.isNotEmpty)
              CachedNetworkImage(
                imageUrl: item.thumbnailUrl!,
                fit: BoxFit.cover,
                placeholder: (_, __) => fallback,
                errorWidget: (_, __, ___) => fallback,
              )
            else
              fallback,
            if (item.type == MediaType.youtube)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(5),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// ── Filter chip ───────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
    this.color,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    final c = color ?? Theme.of(context).colorScheme.primary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? c.withValues(alpha: 0.15) : palette.elevated,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? c.withValues(alpha: 0.5) : palette.border,
            ),
          ),
          child: Text(
            '$label · $count',
            style: TextStyle(
              color: selected ? c : palette.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}

// ── Shared shell (mirrors ControversySection) ─────────────────────

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

// ── Type helpers ──────────────────────────────────────────────────

String _typeLabel(MediaType type) => switch (type) {
  MediaType.news => 'News',
  MediaType.youtube => 'Videos',
  MediaType.instagram => 'Instagram',
};

IconData _typeIcon(MediaType type) => switch (type) {
  MediaType.news => Icons.article_rounded,
  MediaType.youtube => Icons.play_circle_rounded,
  MediaType.instagram => Icons.camera_alt_rounded,
};

Color _typeColor(MediaType type) => switch (type) {
  MediaType.news => AppTheme.secondary,
  MediaType.youtube => const Color(0xFFFF4444),
  MediaType.instagram => const Color(0xFFE1306C),
};
