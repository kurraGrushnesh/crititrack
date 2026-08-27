/// Riverpod providers for the dashboard feature.
///
/// Uses [DirectCelebrityRepository] which calls OpenAI, NewsAPI,
/// YouTube, and Instagram APIs directly. No mock data, no Firebase
/// caching in the provider layer — results flow straight from APIs.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:celeb_sentiment_tracker/core/domain/models/celebrity.dart';
import 'package:celeb_sentiment_tracker/core/error/result.dart';
import 'package:celeb_sentiment_tracker/core/utils/helpers.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/data/celebrity_repository.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/data/direct_celebrity_repository.dart';

/// Singleton [DirectCelebrityRepository] — calls real APIs exclusively.
final celebrityRepositoryProvider = Provider<CelebrityRepository>((ref) {
  return DirectCelebrityRepository();
});

/// Celebrity data keyed by slug. Triggers real API calls on first watch.
/// Calling `ref.invalidate(dashboardProvider('slug'))` triggers a re-fetch.
final dashboardProvider = FutureProvider.family<Celebrity, String>((
  ref,
  slug,
) async {
  final repo = ref.watch(celebrityRepositoryProvider);
  final displayName = fromSlug(slug);

  final result = await repo.getCelebrity(displayName);

  return switch (result) {
    Success(:final value) => value,
    Error(:final failure) => throw failure,
  };
});

/// Force-refresh action — always bypasses cache, calls APIs fresh.
final refreshDashboardProvider = FutureProvider.family<Celebrity, String>((
  ref,
  slug,
) async {
  final repo = ref.watch(celebrityRepositoryProvider);
  final displayName = fromSlug(slug);

  final result = await repo.forceRefresh(displayName);

  return switch (result) {
    Success(:final value) => value,
    Error(:final failure) => throw failure,
  };
});
