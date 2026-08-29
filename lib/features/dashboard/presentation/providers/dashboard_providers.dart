/// Riverpod providers for the dashboard feature.
///
/// Reads are Firestore-first: the scheduled refresher keeps recently-viewed
/// figures warm, so a hit renders instantly instead of waiting on Groq,
/// NewsAPI and YouTube. A miss or a stale document falls through to
/// [ProxyCelebrityRepository], the single call to the Cloud Functions
/// backend. All third-party API keys live server-side.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';
import 'package:crititrack/features/dashboard/data/firestore_celebrity_repository.dart';
import 'package:crititrack/features/dashboard/data/proxy_celebrity_repository.dart';

/// Firestore-first repository layered over the backend proxy.
///
/// Every Firestore problem — offline, rules, an unsigned-in user, or the
/// database simply not being enabled yet — is treated as a cache miss, so
/// this is strictly an optimisation over the proxy path.
final celebrityRepositoryProvider = Provider<CelebrityRepository>((ref) {
  final proxy = ProxyCelebrityRepository();
  ref.onDispose(proxy.dispose);
  return FirestoreCelebrityRepository(remote: proxy);
});

/// Wikidata ids the reader has pinned, by slug.
///
/// Set when someone picks an alternative from the disambiguation
/// list. Held beside the dashboard family rather than folded into
/// its key so that every existing `dashboardProvider(slug)` call
/// site keeps working and a pin simply changes what that slug
/// resolves to.
final pinnedEntityProvider = StateProvider<Map<String, String>>(
  (ref) => const {},
);

/// Celebrity data keyed by slug. Triggers real API calls on first watch.
/// Calling `ref.invalidate(dashboardProvider('slug'))` triggers a re-fetch.
final dashboardProvider = FutureProvider.family<Celebrity, String>((
  ref,
  slug,
) async {
  final repo = ref.watch(celebrityRepositoryProvider);
  final displayName = fromSlug(slug);

  final result = await repo.getCelebrity(
    displayName,
    qid: ref.watch(pinnedEntityProvider)[slug],
  );

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
