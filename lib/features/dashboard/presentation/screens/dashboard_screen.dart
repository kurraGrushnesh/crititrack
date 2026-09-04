/// Full dashboard screen displaying the three-section celebrity profile.
///
/// Uses a [CustomScrollView] with [SliverAppBar] to render:
///   1. Biography card
///   2. Media feed (news, YouTube, Instagram)
///   3. Sentiment analysis dashboard with charts
///
/// Responsive: single-column on mobile, two-column on tablet/web.
/// Dependencies: [dashboardProvider] for async celebrity data.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import 'package:crititrack/core/constants/app_constants.dart';
import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/constants/api_config.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/export/celebrity_export.dart';
import 'package:crititrack/features/share/data/card_renderer.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/theme/theme_toggle.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/controversy/presentation/widgets/controversy_section.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/biography_card.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/career_section.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/disambiguation_bar.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/editorial_header.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/media_feed_section.dart';
import 'package:crititrack/features/dashboard/presentation/widgets/sentiment_section.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncCeleb = ref.watch(dashboardProvider(slug));

    return Scaffold(
      body: asyncCeleb.when(
        data: (celebrity) => _DashboardContent(celebrity: celebrity),
        loading: () => _ShimmerSkeleton(slug: slug),
        error:
            (error, st) => _ErrorContent(
              error: error,
              slug: slug,
              onRetry: () => ref.invalidate(dashboardProvider(slug)),
            ),
      ),
    );
  }
}

// ── Dashboard Content ────────────────────────────────────────────

class _DashboardContent extends ConsumerWidget {
  const _DashboardContent({required this.celebrity});
  final Celebrity celebrity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth >= AppConstants.mobileBreakpoint;
    final palette = context.palette;

    return Stack(
      children: [
        // A single warm glow bleeding down from the top-right, matching
        // the web hero. Static and behind everything, so it costs a
        // paint and nothing else.
        const Positioned.fill(child: _AmbientGlow()),
        _dashboardScroll(context, isWide, palette),
      ],
    );
  }

  Widget _dashboardScroll(
    BuildContext context,
    bool isWide,
    AppPalette palette,
  ) {
    return CustomScrollView(
      slivers: [
        // ── Slim app bar ────────────────────────────────────────
        // Just the back button and the profile actions; the name,
        // portrait and stats now open the scroll body (EditorialHeader).
        SliverAppBar(
          floating: true,
          pinned: false,
          backgroundColor: palette.background,
          surfaceTintColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            tooltip: 'Back to search',
            onPressed: () => GoRouter.of(context).go('/'),
          ),
          title: Text(
            cacheTimestamp(celebrity.fetchedAt),
            style: TextStyle(fontSize: 11, color: palette.textMuted),
          ),
          actions: [
            Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: sentimentColor(
                  celebrity.sentimentData.overallScore,
                ).withValues(alpha: 0.15),
                borderRadius: AppTheme.radiusSm,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    trendIcon(celebrity.sentimentData.trendDirection),
                    size: 16,
                    // Text variant for both: the chip behind them is a
                    // 15% tint of the same hue, which is what made the
                    // fill colour unreadable here in light mode.
                    color: sentimentTextColor(
                      context,
                      celebrity.sentimentData.overallScore,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${celebrity.sentimentData.overallScore.toInt()}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: sentimentTextColor(
                        context,
                        celebrity.sentimentData.overallScore,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            _WatchButton(celebrity: celebrity),
            _ExportButton(celebrity: celebrity),
            const ThemeToggle(compact: true),
            const SizedBox(width: 4),
          ],
        ),

        // ── Editorial header: name, subtitle, stats, portrait ───
        SliverToBoxAdapter(child: EditorialHeader(celebrity: celebrity)),

        // ── Which person this is ────────────────────────────────
        // Governs whether the rest of the screen is about the person
        // the reader meant.
        SliverToBoxAdapter(
          child: DisambiguationBar(
            slug: celebrity.slug,
            resolvedName: celebrity.name,
            resolvedDescription: celebrity.biography.profession,
            candidates: celebrity.candidates,
          ),
        ),

        // ── Content ─────────────────────────────────────────────
        if (isWide)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Left column: Bio + Media
                  Expanded(
                    child: Column(
                      children: [
                        BiographyCard(
                          biography: celebrity.biography,
                          name: celebrity.name,
                          imageUrl: celebrity.imageUrl,
                          facts: celebrity.facts,
                          verified: celebrity.verified,
                        ),
                        const SizedBox(height: 16),
                        CareerSection(facts: celebrity.facts),
                        const SizedBox(height: 16),
                        MediaFeedSection(
                          mediaItems: celebrity.mediaItems,
                          slug: celebrity.slug,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  // Right column: Controversy + Sentiment
                  Expanded(
                    child: Column(
                      children: [
                        ControversySection(
                          controversies: celebrity.biography.controversies,
                          name: celebrity.name,
                        ),
                        const SizedBox(height: 16),
                        SentimentSection(
                          sentimentData: celebrity.sentimentData,
                          mediaItems: celebrity.mediaItems,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          )
        else ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: BiographyCard(
                biography: celebrity.biography,
                name: celebrity.name,
                imageUrl: celebrity.imageUrl,
                facts: celebrity.facts,
                verified: celebrity.verified,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: CareerSection(facts: celebrity.facts),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: ControversySection(
                controversies: celebrity.biography.controversies,
                name: celebrity.name,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: MediaFeedSection(
                mediaItems: celebrity.mediaItems,
                slug: celebrity.slug,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SentimentSection(
                sentimentData: celebrity.sentimentData,
                mediaItems: celebrity.mediaItems,
              ),
            ),
          ),
        ],
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }
}

// ── Ambient glow ────────────────────────────────────────────────
// A soft sage radial wash behind the dashboard, echoing the web hero.
// Purely decorative: ignores pointer events and does not animate.

class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0.9, -1.1),
            radius: 1.1,
            colors: [
              AppTheme.primary.withValues(alpha: 0.16),
              palette.background.withValues(alpha: 0),
            ],
            stops: const [0, 0.6],
          ),
        ),
      ),
    );
  }
}

// ── Shimmer Skeleton ─────────────────────────────────────────────

class _ShimmerSkeleton extends StatelessWidget {
  const _ShimmerSkeleton({required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    return Scaffold(
      appBar: AppBar(
        title: Text(fromSlug(slug)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: 'Back to search',
          onPressed: () => GoRouter.of(context).go('/'),
        ),
        actions: const [ThemeToggle(compact: true), SizedBox(width: 4)],
      ),
      // The sweeping highlight is decorative and continuous, so under
      // reduced motion the skeleton is drawn as plain blocks. The layout
      // is identical either way — what is removed is the movement, not
      // the indication that something is loading.
      body: _Maybe(
        animate: !MediaQuery.of(context).disableAnimations,
        baseColor: palette.elevated,
        highlightColor: Color.alphaBlend(palette.glass, palette.elevated),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bio skeleton
              _box(double.infinity, 200),
              const SizedBox(height: 16),
              // Career timeline skeleton
              _box(double.infinity, 180),
              const SizedBox(height: 16),
              // Media skeleton
              _box(double.infinity, 160),
              const SizedBox(height: 16),
              // Charts skeleton
              Row(
                children: [
                  Expanded(child: _box(double.infinity, 80)),
                  const SizedBox(width: 8),
                  Expanded(child: _box(double.infinity, 80)),
                  const SizedBox(width: 8),
                  Expanded(child: _box(double.infinity, 80)),
                ],
              ),
              const SizedBox(height: 16),
              _box(double.infinity, 250),
            ],
          ),
        ),
      ),
    );
  }

  Widget _box(double w, double h) => Container(
    width: w,
    height: h,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: AppTheme.radiusMd,
    ),
  );
}

// ── Error Content ────────────────────────────────────────────────

class _ErrorContent extends StatelessWidget {
  const _ErrorContent({
    required this.error,
    required this.slug,
    required this.onRetry,
  });

  final Object error;
  final String slug;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (icon, title, message) = _classifyError(error);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          tooltip: 'Back to search',
          onPressed: () => GoRouter.of(context).go('/'),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.error.withValues(alpha: 0.1),
                ),
                child: Icon(icon, size: 64, color: AppTheme.error),
              ),
              const SizedBox(height: 24),
              Text(title, style: theme.textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                message,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => GoRouter.of(context).go('/'),
                child: const Text('Back to Search'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Maps a failure to an icon, a headline and a body.
  ///
  /// Matches on the sealed [Failure] hierarchy rather than sniffing
  /// `toString()`, and shows the failure's own message. The previous
  /// version discarded that message and substituted generic advice, so a
  /// backend that was simply unreachable was reported as "check your
  /// internet connection" — sending the user to look in the wrong place.
  (IconData, String, String) _classifyError(Object error) {
    if (error is Failure) {
      return switch (error) {
        // In the published demo there is no server to fail to reach, so
        // both the headline and the icon would be pointing at a network
        // problem the reader does not have. The body already explains
        // it; this stops the two from contradicting each other.
        NetworkFailure() => (
          ApiConfig.isDemo ? Icons.science_outlined : Icons.wifi_off_rounded,
          ApiConfig.isDemo
              ? 'This demo has no backend'
              : 'Cannot reach the server',
          error.message,
        ),
        RateLimitFailure() => (
          Icons.hourglass_top_rounded,
          'Too many requests',
          error.message,
        ),
        ApiKeyFailure() => (
          Icons.lock_person_rounded,
          'Not signed in',
          error.message,
        ),
        ModelNotFoundFailure() => (
          Icons.model_training_rounded,
          'Analysis unavailable',
          error.message,
        ),
        NotFoundFailure() => (
          Icons.person_search_rounded,
          'Nothing found',
          error.message,
        ),
        ParseFailure() => (
          Icons.data_object_rounded,
          'Unexpected response',
          error.message,
        ),
        FirebaseFailure() => (
          Icons.cloud_off_rounded,
          'Storage unavailable',
          error.message,
        ),
        ServerFailure() => (
          Icons.error_outline_rounded,
          'Something went wrong',
          error.message,
        ),
      };
    }

    return (Icons.error_outline_rounded, 'Could not load data', '$error');
  }
}

/// Star control that adds or removes the figure from the watchlist.
///
/// The watchlist is local-first, so this is instant and works offline;
/// the cloud mirror happens in the background.
class _WatchButton extends ConsumerWidget {
  const _WatchButton({required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final watched = ref
        .watch(watchlistProvider)
        .any((f) => f.slug == celebrity.slug);

    return IconButton(
      icon: Icon(
        watched ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
      ),
      tooltip: watched ? 'Remove from watchlist' : 'Add to watchlist',
      onPressed: () async {
        final added = await ref
            .read(watchlistProvider.notifier)
            .toggle(
              WatchedFigure(
                slug: celebrity.slug,
                name: celebrity.name,
                addedAt: DateTime.now(),
                imageUrl: celebrity.imageUrl,
                lastScore: celebrity.sentimentData.overallScore,
              ),
            );

        if (!context.mounted) return;
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Text(
                added
                    ? '${celebrity.name} added to your watchlist'
                    : '${celebrity.name} removed from your watchlist',
              ),
              duration: const Duration(seconds: 2),
            ),
          );
      },
    );
  }
}

/// Copies the figure's full record out of the app.
///
/// A score you cannot inspect is a score you have to take on trust, so the
/// underlying records go with it: every controversy with its severity and
/// sources, every media item with its URL.
///
/// Clipboard rather than a file download: it needs no extra permission, no
/// platform-specific plumbing, and behaves identically on web, Android and
/// iOS. A file export can layer on top later without changing this.
class _ExportButton extends StatelessWidget {
  const _ExportButton({required this.celebrity});

  final Celebrity celebrity;

  Future<void> _shareCard(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(
          content: Text('Preparing image…'),
          duration: Duration(seconds: 1),
        ),
      );

    final ok = await ShareCardRenderer.share(context, celebrity);
    if (ok) return;

    // Saying nothing would look like the share sheet simply never opened.
    messenger
      ..hideCurrentSnackBar()
      ..showSnackBar(
        const SnackBar(content: Text('Could not create the image.')),
      );
  }

  Future<void> _copy(BuildContext context, String data, String what) async {
    await Clipboard.setData(ClipboardData(text: data));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text('$what copied to clipboard'),
          duration: const Duration(seconds: 2),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      icon: const Icon(Icons.ios_share_rounded),
      tooltip: 'Export this profile',
      onSelected: (value) {
        switch (value) {
          case 'card':
            _shareCard(context);
          case 'json':
            _copy(context, CelebrityExport.toJson(celebrity), 'Full record');
          case 'controversies':
            _copy(
              context,
              CelebrityExport.controversiesCsv(celebrity),
              'Controversies CSV',
            );
          case 'media':
            _copy(context, CelebrityExport.mediaCsv(celebrity), 'Media CSV');
        }
      },
      itemBuilder:
          (context) => const [
            PopupMenuItem(
              value: 'json',
              child: ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.data_object_rounded, size: 18),
                title: Text('Copy full record (JSON)'),
              ),
            ),
            PopupMenuItem(
              value: 'controversies',
              child: ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.gavel_rounded, size: 18),
                title: Text('Copy controversies (CSV)'),
              ),
            ),
            PopupMenuItem(
              value: 'media',
              child: ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.newspaper_rounded, size: 18),
                title: Text('Copy media coverage (CSV)'),
              ),
            ),
          ],
    );
  }
}

/// Wraps its child in a [Shimmer] only when motion is wanted.
///
/// Exists so the skeleton's layout is written once rather than twice:
/// duplicating it for the reduced-motion path is how the two versions
/// drift apart.
class _Maybe extends StatelessWidget {
  const _Maybe({
    required this.animate,
    required this.baseColor,
    required this.highlightColor,
    required this.child,
  });

  final bool animate;
  final Color baseColor;
  final Color highlightColor;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!animate) return child;
    return Shimmer.fromColors(
      baseColor: baseColor,
      highlightColor: highlightColor,
      child: child,
    );
  }
}
