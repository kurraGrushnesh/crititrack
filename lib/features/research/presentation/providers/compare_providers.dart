/// Riverpod wiring for Advanced Compare. Entity resolution reuses the
/// existing `dashboardProvider(slug)` — the same Firestore-first,
/// proxy-backed repository every other screen uses — so a name already
/// viewed elsewhere in the app is served from cache, never refetched.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/compare.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/relationships.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/core/utils/historical.dart';
import 'package:crititrack/features/research/data/compare_repository.dart';

final compareRepositoryProvider = Provider<CompareRepository>((ref) => CompareRepository());

final savedComparisonsProvider = NotifierProvider<SavedComparisonsController, List<Comparison>>(
  SavedComparisonsController.new,
);

class SavedComparisonsController extends Notifier<List<Comparison>> {
  CompareRepository get _repo => ref.read(compareRepositoryProvider);

  @override
  List<Comparison> build() => _repo.all();

  Future<Comparison> create({required List<String> entityIds, List<String> entityNames = const [], String? title}) async {
    final now = DateTime.now();
    final comparison = createComparison(
      comparisonId: 'cmp-${now.microsecondsSinceEpoch}',
      userId: 'local',
      entityIds: entityIds,
      entityNames: entityNames,
      title: title,
      now: now,
    );
    await _repo.save(comparison);
    state = _repo.all();
    return comparison;
  }

  Future<void> remove(String comparisonId) async {
    await _repo.delete(comparisonId);
    state = _repo.all();
  }
}

/// One saved comparison's live view — mutable filters/time range,
/// persisted through [CompareRepository].
final comparisonViewProvider = NotifierProvider.family<ComparisonViewController, Comparison?, String>(
  ComparisonViewController.new,
);

class ComparisonViewController extends FamilyNotifier<Comparison?, String> {
  CompareRepository get _repo => ref.read(compareRepositoryProvider);

  @override
  Comparison? build(String arg) => _repo.get(arg);

  Future<void> rename(String title) async {
    final current = state;
    if (current == null) return;
    final next = renameComparison(current, title, DateTime.now());
    state = next;
    await _repo.save(next);
  }

  Future<void> setTopic(ComparisonTopic topic) async {
    final current = state;
    if (current == null) return;
    final next = updateComparisonFilters(current, topic: topic, now: DateTime.now());
    state = next;
    await _repo.save(next);
  }

  Future<void> setDataMode(ComparisonDataMode mode) async {
    final current = state;
    if (current == null) return;
    final next = updateComparisonFilters(current, dataMode: mode, now: DateTime.now());
    state = next;
    await _repo.save(next);
  }

  Future<void> setTimeRange(HistoricalTimeRange range) async {
    final current = state;
    if (current == null) return;
    final next = updateComparisonTimeRange(current, range, DateTime.now());
    state = next;
    await _repo.save(next);
  }
}

/// Builds one entity's comparison context from its already-loaded
/// [Celebrity] — reusing the exact same evidence/claims/coverage/
/// historical derivations the rest of the app computes. Attention data
/// is not fetched on mobile (see `coverage.dart`'s own note on this),
/// so `attentionSummary` is always null here — a disclosed platform
/// limitation, not a guess.
EntityComparisonContext buildEntityContextFromCelebrity(Celebrity celebrity) {
  final evidenceItems = buildEvidenceItems(
    media: celebrity.mediaItems,
    controversies: celebrity.biography.controversies,
    career: celebrity.facts.career,
    sentimentEvidence: celebrity.sentimentData.evidence,
  );
  final claims = buildClaimMatrix(celebrity.biography.controversies, evidenceItems, entityId: celebrity.wikidataId);
  final coverageReport = buildCoverageReport(celebrity: celebrity, evidenceItems: evidenceItems, claims: claims);
  final historicalOverview = buildHistoricalOverview(celebrity: celebrity, claims: claims, changeEvents: const []);
  final hasControversies = celebrity.biography.controversies.isNotEmpty;
  final index = hasControversies ? computeControversyIndex(celebrity.biography.controversies) : null;

  return EntityComparisonContext(
    entityId: celebrity.wikidataId ?? celebrity.slug,
    entityName: celebrity.name,
    profession: celebrity.biography.profession.isNotEmpty ? celebrity.biography.profession : null,
    currentRole: celebrity.facts.careerInsights.current,
    // Raw Wikidata occupation strings — mobile has no resolved industry
    // taxonomy (see coverage.dart's own note on this gap).
    industries: celebrity.facts.occupations,
    critiScore: index?.score,
    critiScoreBandLabel: index != null ? scoreBandFor(index.score).band.label : null,
    sentimentScore: celebrity.sentimentData.overallScore,
    sentimentBandLabel: sentimentLabel(celebrity.sentimentData.overallScore),
    career: celebrity.facts.career,
    organizations: celebrity.facts.organizations,
    controversies: celebrity.biography.controversies,
    claims: claims,
    // No timeline-based event clustering call here — a simple count of
    // retrieved news items, disclosed as unclustered (unlike the web
    // version, which reuses buildTimeline's day-grouping).
    meaningfulNewsCount: celebrity.mediaItems.where((m) => m.type == MediaType.news).length,
    coverageReport: coverageReport,
    historicalOverview: historicalOverview,
    attentionSummary: null,
    relationships: buildRelationships(
      subjectEntityId: celebrity.wikidataId ?? celebrity.slug,
      subjectName: celebrity.name,
      wikidataRelationships: celebrity.facts.relationships,
      career: celebrity.facts.career,
      evidenceItems: evidenceItems,
    ),
  );
}
