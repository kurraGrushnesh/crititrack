library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class BiographyCard extends StatefulWidget {
  const BiographyCard({
    super.key,
    required this.biography,
    required this.name,
    this.imageUrl,
    this.facts = PersonFacts.empty,
    this.verified = false,
    this.flat = false,
  });

  /// Editorial mode: no card, no gradient header (the name and portrait
  /// already sit in the page header), just the sourced facts and prose
  /// with the section's own padding.
  final bool flat;

  final Biography biography;
  final String name;

  /// Portrait image URL, when available.
  final String? imageUrl;

  /// Structured facts read from Wikidata claims.
  final PersonFacts facts;

  /// Whether the subject resolved to a documented person on Wikidata.
  final bool verified;

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

  /// Sourced works if Wikidata has any, otherwise the generated list.
  List<String> _works(Biography bio) =>
      widget.facts.notableWorks.isNotEmpty
          ? widget.facts.notableWorks
          : bio.notableWorks;

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
      decoration: widget.flat
          ? null
          : BoxDecoration(
              gradient: palette.cardGradient,
              borderRadius: AppTheme.radiusLg,
              border: Border.all(color: palette.border),
              boxShadow: palette.cardShadow,
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Gradient Header ──────────────────────────────────────
          // Skipped in editorial mode: the name, portrait and
          // verification already sit in the page header.
          if (!widget.flat)
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
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
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
                            _VerificationChip(verified: widget.verified),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          // ── Structured facts ────────────────────────────────────
          // Above the prose, because that is the distinction worth
          // making on this screen: everything here came off a
          // Wikidata claim, and everything below it came from a
          // model.
          if (widget.facts.isNotEmpty) _FactsStrip(facts: widget.facts),

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
          // Wikidata's P800 wins when the entity has one. The model's
          // list is the fallback, and the subtitle says which is on
          // screen — the same sourced-versus-generated distinction the
          // facts strip above draws, applied to a field that used to be
          // generated unconditionally.
          if (_works(bio).isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Notable Works', style: theme.textTheme.labelLarge),
                  Text(
                    widget.facts.notableWorks.isNotEmpty
                        ? 'From Wikidata'
                        : 'Generated — not a sourced list',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: palette.textMuted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 34,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: _works(bio).length,
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
                        _works(bio)[i],
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

/// Says whether the subject was resolved to a documented person.
///
/// Deliberately quiet when verified — a badge on everything is noise. The
/// unverified state is the one worth surfacing, because it tells the
/// reader the profile could not be tied to a known public figure.
class _VerificationChip extends StatelessWidget {
  const _VerificationChip({required this.verified});

  final bool verified;

  @override
  Widget build(BuildContext context) {
    final label = verified ? 'Verified figure' : 'Unverified';
    final icon = verified ? Icons.verified_rounded : Icons.help_outline_rounded;

    return Tooltip(
      message:
          verified
              ? 'Matched to a documented person on Wikidata.'
              : 'This name could not be matched to a documented public figure, '
                  'so treat the profile below with extra caution.',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: verified ? 0.2 : 0.28),
          borderRadius: AppTheme.radiusSm,
          border:
              verified
                  ? null
                  : Border.all(color: Colors.white.withValues(alpha: 0.55)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 11, color: Colors.white),
            const SizedBox(width: 4),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Hard facts, read from Wikidata rather than generated.
///
/// Rendered at whatever precision Wikidata actually asserts. A profile
/// that shows "1 January 1856" for someone whose birth year is all that
/// was ever recorded is stating something nobody knows.
class _FactsStrip extends StatelessWidget {
  const _FactsStrip({required this.facts});

  final PersonFacts facts;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final born = facts.birthDisplay;
    final died = facts.deathDisplay;
    final age = facts.age;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 18,
            runSpacing: 8,
            children: [
              if (born != null)
                _Fact(
                  label: 'Born',
                  value: age == null ? born : '$born  ·  $age',
                ),
              if (died != null) _Fact(label: 'Died', value: died),
              if (facts.birthPlace != null)
                _Fact(label: 'From', value: facts.birthPlace!),
              if (facts.citizenship.isNotEmpty)
                _Fact(
                  label:
                      facts.citizenship.length == 1
                          ? 'Citizenship'
                          : 'Citizenships',
                  value: facts.citizenship.join(', '),
                ),
              if (facts.education.isNotEmpty)
                _Fact(label: 'Educated at', value: facts.education.join(' · ')),
            ],
          ),
          if (facts.occupations.isNotEmpty) ...[
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final occupation in facts.occupations)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: palette.elevated,
                      borderRadius: AppTheme.radiusSm,
                      border: Border.all(color: palette.border),
                    ),
                    child: Text(
                      occupation,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
          ],
          if (facts.awards.isNotEmpty) _Awards(awards: facts.awards),
          if (facts.links.isNotEmpty) _PrimarySources(links: facts.links),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(
                Icons.fact_check_outlined,
                size: 12,
                color: palette.textMuted,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  'From Wikidata. The description below is generated.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: palette.textMuted,
                    fontSize: 12,
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

class _Fact extends StatelessWidget {
  const _Fact({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: theme.textTheme.labelSmall?.copyWith(
            color: palette.textMuted,
            fontSize: 11,
            letterSpacing: 0.8,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 1),
        Text(
          value,
          style: theme.textTheme.bodySmall?.copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

/// Awards actually recorded against this person, newest first.
///
/// Sourced from Wikidata, unlike the generated "notable achievements"
/// list beside it. An award is dated and checkable, which is the kind of
/// claim this app is meant to be built from — so it is shown as fact,
/// with its year, rather than folded into prose.
class _Awards extends StatefulWidget {
  const _Awards({required this.awards});

  final List<Award> awards;

  @override
  State<_Awards> createState() => _AwardsState();
}

class _AwardsState extends State<_Awards> {
  static const _collapsed = 4;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final all = widget.awards;
    final shown = _expanded ? all : all.take(_collapsed).toList();
    final hidden = all.length - shown.length;

    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.emoji_events_outlined,
                size: 15,
                color: palette.textMuted,
              ),
              const SizedBox(width: 6),
              Text(
                all.length == 1
                    ? '1 recorded award'
                    : '${all.length} '
                        'recorded awards',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: palette.textMuted,
                  fontSize: 11,
                  letterSpacing: 0.8,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          for (final award in shown)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Fixed width so the years form a column and the
                  // titles align, which is what makes a list of eleven
                  // scannable rather than a wall.
                  SizedBox(
                    width: 38,
                    child: Text(
                      award.year?.toString() ?? '—',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color:
                            award.year == null
                                ? palette.textMuted
                                : palette.brandText,
                        fontWeight: FontWeight.w700,
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      award.label,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if (hidden > 0 || _expanded)
            SizedBox(
              height: 44,
              child: TextButton(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  minimumSize: const Size(0, 44),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                onPressed: () => setState(() => _expanded = !_expanded),
                child: Text(_expanded ? 'Show fewer' : 'Show $hidden more'),
              ),
            ),
        ],
      ),
    );
  }
}

/// The subject's own accounts and IMDb, where Wikidata records them.
///
/// For a tool arguing from evidence, "go and check for yourself" is part
/// of the argument. Every link here is a primary source rather than
/// something written about them.
class _PrimarySources extends StatelessWidget {
  const _PrimarySources({required this.links});

  final Map<String, String> links;

  static const _order = ['website', 'x', 'instagram', 'imdb'];

  static const _labels = {
    'website': 'Official site',
    'x': 'X',
    'instagram': 'Instagram',
    'imdb': 'IMDb',
  };

  static const _icons = {
    'website': Icons.public_rounded,
    'x': Icons.alternate_email_rounded,
    'instagram': Icons.photo_camera_outlined,
    'imdb': Icons.movie_outlined,
  };

  Future<void> _open(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
      return;
    }
    if (!context.mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('That link could not be opened.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    final present = _order.where(links.containsKey).toList();
    if (present.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final key in present)
            SizedBox(
              height: 44,
              child: OutlinedButton.icon(
                onPressed: () => _open(context, links[key]!),
                icon: Icon(_icons[key], size: 15),
                label: Text(_labels[key]!),
                style: OutlinedButton.styleFrom(
                  foregroundColor: palette.textSecondary,
                  side: BorderSide(color: palette.border),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  textStyle: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
