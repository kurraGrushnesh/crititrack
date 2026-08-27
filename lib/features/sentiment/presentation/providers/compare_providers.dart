/// Riverpod providers for the comparative analytics feature.
///
/// Phase 3 — lets users select 2+ celebrities and see their
/// sentiment trajectories overlaid with computed correlation.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:celeb_sentiment_tracker/core/domain/models/celebrity.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/presentation/providers/dashboard_providers.dart';

/// Currently selected celebrity slugs for comparison.
final compareSelectionProvider = StateProvider<List<String>>((ref) => []);

/// Loads all selected celebrities' data in parallel.
///
/// Re-reads whenever the selection list changes. Each celebrity
/// is fetched via the existing [dashboardProvider].
final compareDataProvider = FutureProvider<List<Celebrity>>((ref) async {
  final slugs = ref.watch(compareSelectionProvider);
  if (slugs.isEmpty) return [];

  final futures = slugs.map((slug) async {
    final asyncValue = ref.watch(dashboardProvider(slug));
    return asyncValue.when(
      data: (celeb) => celeb,
      loading: () => null,
      error: (_, __) => null,
    );
  });

  final results = await Future.wait(futures);
  return results.whereType<Celebrity>().toList();
});
