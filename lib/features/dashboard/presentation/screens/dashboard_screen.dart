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
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';

import 'package:celeb_sentiment_tracker/core/constants/app_constants.dart';
import 'package:celeb_sentiment_tracker/core/domain/models/celebrity.dart';
import 'package:celeb_sentiment_tracker/core/theme/app_theme.dart';
import 'package:celeb_sentiment_tracker/core/utils/helpers.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/presentation/widgets/biography_card.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/presentation/widgets/media_feed_section.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/presentation/widgets/sentiment_section.dart';

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

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.celebrity});
  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isWide = screenWidth >= AppConstants.mobileBreakpoint;

    return CustomScrollView(
      slivers: [
        // ── SliverAppBar ────────────────────────────────────────
        SliverAppBar(
          expandedHeight: 120,
          floating: true,
          pinned: true,
          backgroundColor: AppTheme.surfaceDark,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
            onPressed: () => GoRouter.of(context).go('/'),
          ),
          flexibleSpace: FlexibleSpaceBar(
            titlePadding: const EdgeInsets.only(
              left: 56,
              bottom: 16,
              right: 16,
            ),
            title: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  celebrity.name,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                Text(
                  cacheTimestamp(celebrity.fetchedAt),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF1A1040), AppTheme.surfaceDark],
                ),
              ),
            ),
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
                    color: sentimentColor(celebrity.sentimentData.overallScore),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '${celebrity.sentimentData.overallScore.toInt()}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: sentimentColor(
                        celebrity.sentimentData.overallScore,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
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
                        ),
                        const SizedBox(height: 16),
                        MediaFeedSection(
                          mediaItems: celebrity.mediaItems,
                          slug: celebrity.slug,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  // Right column: Sentiment
                  Expanded(
                    child: SentimentSection(
                      sentimentData: celebrity.sentimentData,
                      mediaItems: celebrity.mediaItems,
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
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
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

// ── Shimmer Skeleton ─────────────────────────────────────────────

class _ShimmerSkeleton extends StatelessWidget {
  const _ShimmerSkeleton({required this.slug});
  final String slug;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(fromSlug(slug)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => GoRouter.of(context).go('/'),
        ),
      ),
      body: Shimmer.fromColors(
        baseColor: AppTheme.surfaceCard,
        highlightColor: AppTheme.surfaceElevated,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Bio skeleton
              _box(double.infinity, 200),
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

  (IconData, String, String) _classifyError(Object error) {
    // The error object from Riverpod wraps the Failure toString()
    final errorStr = error.toString();

    if (errorStr.contains('ModelNotFoundFailure') ||
        errorStr.contains('model configuration needs updating')) {
      return (
        Icons.model_training_rounded,
        'AI Model Unavailable',
        'The AI model has been deprecated or is not available. '
            'The developer needs to update the model configuration.',
      );
    }
    if (errorStr.contains('ApiKeyFailure') ||
        errorStr.contains('Invalid') && errorStr.contains('API key')) {
      return (
        Icons.vpn_key_off_rounded,
        'API Key Error',
        'The Groq API key is invalid or expired. '
            'Update it in the .env file.',
      );
    }
    if (errorStr.contains('RateLimitFailure') ||
        errorStr.contains('Too many requests')) {
      return (
        Icons.speed_rounded,
        'Rate Limited',
        'Too many requests. Please wait a moment and try again.',
      );
    }
    if (errorStr.contains('NetworkFailure') ||
        errorStr.contains('No internet')) {
      return (
        Icons.wifi_off_rounded,
        'No Connection',
        'Please check your internet connection and try again.',
      );
    }

    return (Icons.error_outline_rounded, 'Couldn\'t Load Data', errorStr);
  }
}
