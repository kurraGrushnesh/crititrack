library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class BiographyCard extends StatefulWidget {
  const BiographyCard({
    super.key,
    required this.biography,
    required this.name,
    this.imageUrl,
  });

  final Biography biography;
  final String name;

  /// Portrait image URL, when available.
  final String? imageUrl;

  @override
  State<BiographyCard> createState() => _BiographyCardState();
}

class _BiographyCardState extends State<BiographyCard>
    with SingleTickerProviderStateMixin {
  bool _expanded = false;
  late AnimationController _animController;
  late Animation<double> _expandAnim;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _expandAnim = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _toggleExpand() {
    setState(() => _expanded = !_expanded);
    if (_expanded) {
      _animController.forward();
    } else {
      _animController.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final bio = widget.biography;

    return Container(
      decoration: BoxDecoration(
        gradient: palette.cardGradient,
        borderRadius: AppTheme.radiusLg,
        border: Border.all(color: palette.border),
        boxShadow: palette.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Gradient Header ──────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(20),
                topRight: Radius.circular(20),
              ),
            ),
            child: Row(
              children: [
                _Portrait(imageUrl: widget.imageUrl),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.name,
                        style: theme.textTheme.titleLarge?.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: AppTheme.radiusSm,
                        ),
                        child: Text(
                          bio.profession,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // ── Summary ─────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Text(bio.summary, style: theme.textTheme.bodyLarge),
          ),

          // ── Background (expand/collapse) ────────────────────────
          AnimatedSize(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                bio.background,
                maxLines: _expanded ? 100 : 3,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: GestureDetector(
              onTap: _toggleExpand,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Text(
                      _expanded ? 'Show less' : 'Read more',
                      style: TextStyle(
                        color: palette.brandText,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    RotationTransition(
                      turns: Tween(begin: 0.0, end: 0.5).animate(_expandAnim),
                      child: Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 18,
                        color: palette.brandText,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Notable Works Chips ─────────────────────────────────
          if (bio.notableWorks.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Text('Notable Works', style: theme.textTheme.labelLarge),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: bio.notableWorks.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder:
                    (_, i) => Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withValues(alpha: 0.1),
                        borderRadius: AppTheme.radiusSm,
                        border: Border.all(
                          color: AppTheme.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Text(
                        bio.notableWorks[i],
                        style: TextStyle(
                          color: palette.brandText,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
              ),
            ),
          ],

          // Controversies now render in the dedicated ControversySection
          // on the dashboard rather than inside the biography card.
          if (bio.controversies.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Row(
                children: [
                  Icon(Icons.gavel_rounded, size: 14, color: palette.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    '${bio.controversies.length} '
                    '${bio.controversies.length == 1 ? "controversy" : "controversies"}'
                    ' tracked — see Controversy Tracker below',
                    style: TextStyle(color: palette.textMuted, fontSize: 11),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

/// Circular portrait for the header — the person's photo when we have a
/// URL, otherwise a translucent person glyph on the gradient.
class _Portrait extends StatelessWidget {
  const _Portrait({this.imageUrl});

  final String? imageUrl;

  static const double _size = 56;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        shape: BoxShape.circle,
      ),
      child: const Icon(Icons.person_rounded, color: Colors.white, size: 28),
    );

    if (imageUrl == null || imageUrl!.isEmpty) return fallback;

    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.5),
          width: 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          fit: BoxFit.cover,
          placeholder: (_, __) => fallback,
          errorWidget: (_, __, ___) => fallback,
        ),
      ),
    );
  }
}
