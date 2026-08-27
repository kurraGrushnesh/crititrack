/// Media feed section with filter TabBar and horizontal PageView cards.
///
/// Displays news, YouTube, and Instagram items with type-specific
/// card layouts. All cards open their URL in an in-app WebView.
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

class _MediaFeedSectionState extends State<MediaFeedSection>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<MediaItem> _filteredItems() {
    final items = widget.mediaItems;
    return switch (_tabController.index) {
      1 => items.where((i) => i.type == MediaType.news).toList(),
      2 => items.where((i) => i.type == MediaType.youtube).toList(),
      3 => items.where((i) => i.type == MediaType.instagram).toList(),
      _ => items,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final filtered = _filteredItems();

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceCard,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header + TabBar ──────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                const Icon(
                  Icons.dynamic_feed_rounded,
                  size: 20,
                  color: AppTheme.secondary,
                ),
                const SizedBox(width: 8),
                Text('Media Feed', style: theme.textTheme.titleMedium),
                const Spacer(),
                Text(
                  '${widget.mediaItems.length} items',
                  style: theme.textTheme.labelSmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          TabBar(
            controller: _tabController,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            indicatorSize: TabBarIndicatorSize.label,
            dividerHeight: 0,
            tabs: [
              _tab('All', widget.mediaItems.length),
              _tab(
                'News',
                widget.mediaItems.where((i) => i.type == MediaType.news).length,
              ),
              _tab(
                'Videos',
                widget.mediaItems
                    .where((i) => i.type == MediaType.youtube)
                    .length,
              ),
              _tab(
                'Instagram',
                widget.mediaItems
                    .where((i) => i.type == MediaType.instagram)
                    .length,
              ),
            ],
          ),
          const SizedBox(height: 12),

          // ── Cards ───────────────────────────────────────────────
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: Text(
                  'No items in this category',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            )
          else
            SizedBox(
              height: 200,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder:
                    (context, i) =>
                        _MediaCard(item: filtered[i], slug: widget.slug),
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _tab(String label, int count) {
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label),
          if (count > 0) ...[
            const SizedBox(width: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count', style: const TextStyle(fontSize: 10)),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Media Card ───────────────────────────────────────────────────

class _MediaCard extends StatelessWidget {
  const _MediaCard({required this.item, required this.slug});
  final MediaItem item;
  final String slug;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: () async {
        if (kIsWeb) {
          final uri = Uri.parse(item.url);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri);
          }
        } else {
          context.go(
            '/dashboard/$slug/media?url=${Uri.encodeComponent(item.url)}&title=${Uri.encodeComponent(item.title)}',
          );
        }
      },
      child: Container(
        width: 260,
        decoration: BoxDecoration(
          color: AppTheme.surfaceElevated,
          borderRadius: AppTheme.radiusMd,
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(12),
                topRight: Radius.circular(12),
              ),
              child: SizedBox(
                height: 110,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (item.thumbnailUrl != null)
                      CachedNetworkImage(
                        imageUrl: item.thumbnailUrl!,
                        fit: BoxFit.cover,
                        placeholder:
                            (_, __) => Container(
                              color: AppTheme.surfaceCard,
                              child: const Center(
                                child: Icon(
                                  Icons.image_rounded,
                                  color: AppTheme.textMuted,
                                  size: 32,
                                ),
                              ),
                            ),
                        errorWidget:
                            (_, __, ___) => Container(
                              color: AppTheme.surfaceCard,
                              child: const Center(
                                child: Icon(
                                  Icons.broken_image_rounded,
                                  color: AppTheme.textMuted,
                                  size: 32,
                                ),
                              ),
                            ),
                      )
                    else
                      Container(
                        color: AppTheme.surfaceCard,
                        child: Center(
                          child: Icon(
                            _typeIcon(item.type),
                            color: AppTheme.textMuted,
                            size: 32,
                          ),
                        ),
                      ),
                    // YouTube play overlay
                    if (item.type == MediaType.youtube)
                      Center(
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.6),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 28,
                          ),
                        ),
                      ),
                    // Type badge
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: _typeColor(item.type).withValues(alpha: 0.9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              _typeIcon(item.type),
                              color: Colors.white,
                              size: 12,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              item.source ?? item.type.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Title + Meta
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppTheme.textPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                    if (item.publishedAt != null)
                      Text(
                        timeAgo(item.publishedAt!),
                        style: theme.textTheme.labelSmall,
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _typeIcon(MediaType type) => switch (type) {
    MediaType.news => Icons.article_rounded,
    MediaType.youtube => Icons.play_circle_rounded,
    MediaType.instagram => Icons.camera_alt_rounded,
  };

  Color _typeColor(MediaType type) => switch (type) {
    MediaType.news => AppTheme.secondary,
    MediaType.youtube => const Color(0xFFFF0000),
    MediaType.instagram => const Color(0xFFE1306C),
  };
}
