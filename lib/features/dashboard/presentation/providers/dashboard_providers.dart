/// Riverpod providers for the dashboard feature.
///
/// Uses [ProxyCelebrityRepository], which makes a single call to the
/// CritiTrack Cloud Functions backend. All third-party API keys live
/// server-side; the app never holds them.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';
import 'package:crititrack/features/dashboard/data/proxy_celebrity_repository.dart';

/// Singleton [ProxyCelebrityRepository] — one call to the backend proxy.
final celebrityRepositoryProvider = Provider<CelebrityRepository>((ref) {
  final repo = ProxyCelebrityRepository();
  ref.onDispose(repo.dispose);
  return repo;
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
