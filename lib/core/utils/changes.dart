/// Change Detection — the Dart twin of `site/lib/changes.ts`. Compares
/// two real [Celebrity] snapshots (the last one the Firestore-backed
/// repository has on record — see `previousSnapshot` on
/// `CelebrityRepository` — and the one just fetched) and surfaces only
/// the differences that are actually meaningful.
///
/// Every comparison reads the same normalised, already-computed fields
/// the rest of the app renders (career timeline, claims, coverage,
/// the deterministic index) — never raw JSON — so array order, image
/// URLs, or a refreshed timestamp never becomes a "change".
///
/// Two web dimensions are intentionally not ported here: Attention
/// (mobile does not fetch Wikipedia pageviews — see coverage.dart's
/// documented limitation) and Reddit (mobile's media pipeline has no
/// Reddit ingestion — same limitation as coverage.dart).
library;

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/helpers.dart' show sentimentLabel;

const String kChangeMethodologyVersion = '1.0';

enum ChangeType {
  careerChange,
  professionChange,
  organizationChange,
  controversyChange,
  claimChange,
  newsChange,
  sentimentChange,
  critiscoreChange,
  relationshipChange,
  profileChange,
  sourceCoverageChange,
  dataAvailabilityChange,
}

enum ChangeSeverity { info, minor, significant, major }

enum ChangeConfidence { high, medium, low }

class ChangeEvent {
  const ChangeEvent({
    required this.changeId,
    required this.entityId,
    required this.changeType,
    required this.severity,
    required this.title,
    required this.summary,
    required this.previousValue,
    required this.currentValue,
    required this.detectedAt,
    required this.effectiveDate,
    required this.evidenceIds,
    required this.relatedClaimIds,
    required this.methodologyVersion,
    required this.confidence,
    required this.sourceCoverage,
  });

  final String changeId;
  final String entityId;
  final ChangeType changeType;
  final ChangeSeverity severity;
  final String title;
  final String summary;
  final String? previousValue;
  final String? currentValue;
  final DateTime detectedAt;
  final String? effectiveDate;
  final List<String> evidenceIds;
  final List<String> relatedClaimIds;
  final String methodologyVersion;
  final ChangeConfidence confidence;
  final String? sourceCoverage;
}

int _counter = 0;
String _nextId(String entityId, ChangeType type) {
  _counter += 1;
  return '$entityId-${type.name}-$_counter';
}

/// Resets the id counter — tests only, so ids are deterministic per run.
void resetChangeIdCounter() => _counter = 0;

String _careerKey(CareerEntry e) =>
    '${(e.role ?? '').toLowerCase()}|${(e.organization ?? '').toLowerCase()}|${e.start ?? ''}';

// ── Career & profession ──────────────────────────────────────────────

List<ChangeEvent> _careerChanges(
  String entityId,
  DateTime detectedAt,
  List<CareerEntry> previous,
  List<CareerEntry> current,
) {
  final prevKeys = previous.map(_careerKey).toSet();
  final out = <ChangeEvent>[];
  for (final e in current) {
    if (prevKeys.contains(_careerKey(e))) continue;
    if (e.role == null && e.organization == null) continue;
    final who = [e.role, e.organization].whereType<String>().join(' at ');
    out.add(
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.careerChange),
        entityId: entityId,
        changeType: ChangeType.careerChange,
        severity: e.sourceUrl != null ? ChangeSeverity.minor : ChangeSeverity.info,
        title: 'New role detected: $who',
        summary:
            'A new sourced career record appeared: $who${e.start != null ? " (from ${e.start})" : ""}.',
        previousValue: null,
        currentValue: who,
        detectedAt: detectedAt,
        effectiveDate: e.start?.toString(),
        evidenceIds: const [],
        relatedClaimIds: const [],
        methodologyVersion: kChangeMethodologyVersion,
        confidence: e.sourceUrl != null ? ChangeConfidence.high : ChangeConfidence.low,
        sourceCoverage: e.sourceUrl != null ? 'sourced' : 'unsourced',
      ),
    );
  }
  return out;
}

List<ChangeEvent> _professionChange(
  String entityId,
  DateTime detectedAt,
  String previous,
  String current,
) {
  String norm(String s) => s.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');
  if (current.isEmpty || norm(previous) == norm(current)) return const [];
  return [
    ChangeEvent(
      changeId: _nextId(entityId, ChangeType.professionChange),
      entityId: entityId,
      changeType: ChangeType.professionChange,
      severity: ChangeSeverity.minor,
      title: 'Profession updated',
      summary:
          'Listed profession changed from "${previous.isEmpty ? "unknown" : previous}" to "$current".',
      previousValue: previous.isEmpty ? null : previous,
      currentValue: current,
      detectedAt: detectedAt,
      effectiveDate: null,
      evidenceIds: const [],
      relatedClaimIds: const [],
      methodologyVersion: kChangeMethodologyVersion,
      confidence: ChangeConfidence.high,
      sourceCoverage: null,
    ),
  ];
}

// ── Controversies & claims ───────────────────────────────────────────

ChangeSeverity _controversySeverityBand(Controversy c) {
  if (c.severity >= 4) return ChangeSeverity.major;
  if (c.severity >= 2) return ChangeSeverity.significant;
  return ChangeSeverity.minor;
}

List<ChangeEvent> _controversyChanges(
  String entityId,
  DateTime detectedAt,
  List<Controversy> previous,
  List<Controversy> current,
) {
  final prevByKey = {for (final c in previous) titleSlug(c.title): c};
  final out = <ChangeEvent>[];

  for (final c in current) {
    final before = prevByKey[titleSlug(c.title)];
    if (before == null) {
      out.add(
        ChangeEvent(
          changeId: _nextId(entityId, ChangeType.controversyChange),
          entityId: entityId,
          changeType: ChangeType.controversyChange,
          severity: _controversySeverityBand(c),
          title: 'New supported controversy: ${c.title}',
          summary: c.summary.isNotEmpty ? c.summary : c.title,
          previousValue: null,
          currentValue: c.status,
          detectedAt: detectedAt,
          effectiveDate: c.year?.toString(),
          evidenceIds: const [],
          relatedClaimIds: const [],
          methodologyVersion: kChangeMethodologyVersion,
          confidence:
              c.sources.length >= 2
                  ? ChangeConfidence.high
                  : c.sources.length == 1
                  ? ChangeConfidence.medium
                  : ChangeConfidence.low,
          sourceCoverage: '${c.sources.length} source${c.sources.length == 1 ? "" : "s"}',
        ),
      );
      continue;
    }
    if (before.status != c.status) {
      out.add(
        ChangeEvent(
          changeId: _nextId(entityId, ChangeType.controversyChange),
          entityId: entityId,
          changeType: ChangeType.controversyChange,
          severity: ChangeSeverity.significant,
          title: 'Controversy status updated: ${c.title}',
          summary: 'Status changed from "${before.status}" to "${c.status}".',
          previousValue: before.status,
          currentValue: c.status,
          detectedAt: detectedAt,
          effectiveDate: c.year?.toString(),
          evidenceIds: const [],
          relatedClaimIds: const [],
          methodologyVersion: kChangeMethodologyVersion,
          confidence: ChangeConfidence.high,
          sourceCoverage: null,
        ),
      );
    }
    if (c.sources.length > before.sources.length) {
      out.add(
        ChangeEvent(
          changeId: _nextId(entityId, ChangeType.controversyChange),
          entityId: entityId,
          changeType: ChangeType.controversyChange,
          severity: ChangeSeverity.minor,
          title: 'New supporting evidence: ${c.title}',
          summary:
              'Source count increased from ${before.sources.length} to ${c.sources.length}.',
          previousValue: '${before.sources.length} sources',
          currentValue: '${c.sources.length} sources',
          detectedAt: detectedAt,
          effectiveDate: null,
          evidenceIds: const [],
          relatedClaimIds: const [],
          methodologyVersion: kChangeMethodologyVersion,
          confidence: ChangeConfidence.medium,
          sourceCoverage: '${c.sources.length} sources',
        ),
      );
    }
  }
  return out;
}

const Map<ClaimStatus, int> _claimStatusRank = {
  ClaimStatus.insufficientEvidence: 0,
  ClaimStatus.reportedUncorroborated: 1,
  ClaimStatus.partiallySupported: 2,
  ClaimStatus.conflicting: 2,
  ClaimStatus.supported: 3,
  ClaimStatus.resolvedAuthoritative: 4,
  ClaimStatus.unknown: -1,
};

List<ChangeEvent> _claimChanges(
  String entityId,
  DateTime detectedAt,
  List<Claim> previous,
  List<Claim> current,
) {
  final prevByKey = {for (final c in previous) c.claimId: c};
  final out = <ChangeEvent>[];

  for (final c in current) {
    final before = prevByKey[c.claimId];
    if (before == null || before.status == c.status) continue;

    final improved = _claimStatusRank[c.status]! > _claimStatusRank[before.status]!;
    final newSupport =
        c.supportingEvidenceIds.where((id) => !before.supportingEvidenceIds.contains(id)).toList();
    final newContradict =
        c.contradictingEvidenceIds.where((id) => !before.contradictingEvidenceIds.contains(id)).toList();

    var why = c.statusReason;
    if (newSupport.isNotEmpty) {
      why = '${newSupport.length} new supporting source(s) were retrieved.';
    } else if (newContradict.isNotEmpty) {
      why = '${newContradict.length} new contradicting source(s) were retrieved.';
    }

    out.add(
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.claimChange),
        entityId: entityId,
        changeType: ChangeType.claimChange,
        severity:
            c.status == ClaimStatus.conflicting || improved
                ? ChangeSeverity.significant
                : ChangeSeverity.minor,
        title: 'Claim status changed: ${c.claimText}',
        summary: why,
        previousValue: before.status.name,
        currentValue: c.status.name,
        detectedAt: detectedAt,
        effectiveDate: c.dateContext,
        evidenceIds: [...newSupport, ...newContradict],
        relatedClaimIds: [c.claimId],
        methodologyVersion: c.methodologyVersion,
        confidence: switch (c.confidence) {
          ClaimConfidence.high => ChangeConfidence.high,
          ClaimConfidence.medium => ChangeConfidence.medium,
          ClaimConfidence.low => ChangeConfidence.low,
        },
        sourceCoverage: null,
      ),
    );
  }
  return out;
}

// ── News (deduplicated by underlying event) ─────────────────────────

const _stopwords = {
  'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'and', 'or',
  'is', 'was', 'were', 'be', 'been', 'with', 'by', 'from', 'as', 'his',
  'her', 'their', 'its', 'it', 'that', 'this', 'after', 'over', 'new',
};

Set<String> _significantWords(String text) {
  final cleaned = text.toLowerCase().replaceAll(RegExp(r'[^\p{L}\p{N}\s]', unicode: true), ' ');
  return cleaned.split(RegExp(r'\s+')).where((w) => w.length > 3 && !_stopwords.contains(w)).toSet();
}

bool _sameEvent(String a, String b) {
  final wa = _significantWords(a);
  final wb = _significantWords(b);
  if (wa.isEmpty || wb.isEmpty) return false;
  final shared = wa.where(wb.contains).length;
  return shared / (wa.length < wb.length ? wa.length : wb.length) >= 0.6;
}

List<ChangeEvent> _newsChanges(
  String entityId,
  DateTime detectedAt,
  List<MediaItem> previous,
  List<MediaItem> current,
  List<Controversy> controversies,
) {
  final prevUrls = previous.map((m) => m.url).toSet();
  final newItems = current.where((m) => m.type == MediaType.news && !prevUrls.contains(m.url)).toList();
  if (newItems.isEmpty) return const [];

  final trackedTitles = controversies.map((c) => c.title).toList();
  final untracked = newItems.where((m) => !trackedTitles.any((t) => _sameEvent(t, m.title))).toList();

  final clusters = <List<MediaItem>>[];
  for (final item in untracked) {
    final day = item.publishedAt?.toIso8601String().substring(0, 10);
    final cluster = clusters.cast<List<MediaItem>?>().firstWhere(
      (c) =>
          c![0].publishedAt?.toIso8601String().substring(0, 10) == day && _sameEvent(c[0].title, item.title),
      orElse: () => null,
    );
    if (cluster != null) {
      cluster.add(item);
    } else {
      clusters.add([item]);
    }
  }

  final out = <ChangeEvent>[];
  for (final cluster in clusters) {
    final publishers = cluster.map((m) => m.source).whereType<String>().toSet().length;
    if (publishers < 2) continue;
    final rep = cluster.first;
    out.add(
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.newsChange),
        entityId: entityId,
        changeType: ChangeType.newsChange,
        severity: publishers >= 5 ? ChangeSeverity.significant : ChangeSeverity.minor,
        title: 'New event: ${rep.title}',
        summary:
            '${cluster.length} article${cluster.length == 1 ? "" : "s"}, $publishers independent publisher${publishers == 1 ? "" : "s"}.',
        previousValue: null,
        currentValue: '${cluster.length} articles',
        detectedAt: detectedAt,
        effectiveDate: rep.publishedAt?.toIso8601String(),
        evidenceIds: cluster.map((m) => 'media-${m.id}').toList(),
        relatedClaimIds: const [],
        methodologyVersion: kChangeMethodologyVersion,
        confidence: publishers >= 3 ? ChangeConfidence.high : ChangeConfidence.medium,
        sourceCoverage: '$publishers independent publishers',
      ),
    );
  }
  return out;
}

// ── Sentiment ─────────────────────────────────────────────────────────

const int _minSentimentSample = 10;

List<ChangeEvent> _sentimentChange(
  String entityId,
  DateTime detectedAt,
  Celebrity previous,
  Celebrity current,
) {
  final sampleSize = current.sentimentData.sampleSize;
  if (sampleSize == null) return const [];
  final prevBand = sentimentLabel(previous.sentimentData.overallScore);
  final currBand = sentimentLabel(current.sentimentData.overallScore);
  if (prevBand == currBand) return const [];

  if (sampleSize < _minSentimentSample) {
    return [
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.sentimentChange),
        entityId: entityId,
        changeType: ChangeType.sentimentChange,
        severity: ChangeSeverity.info,
        title: 'Sentiment shift detected but data is limited',
        summary: 'Sentiment data insufficient to determine a meaningful change.',
        previousValue: prevBand,
        currentValue: currBand,
        detectedAt: detectedAt,
        effectiveDate: null,
        evidenceIds: const [],
        relatedClaimIds: const [],
        methodologyVersion: kChangeMethodologyVersion,
        confidence: ChangeConfidence.low,
        sourceCoverage: '$sampleSize mentions',
      ),
    ];
  }

  final magnitude =
      (current.sentimentData.overallScore - previous.sentimentData.overallScore).abs();
  final severity = magnitude >= 30 ? ChangeSeverity.significant : ChangeSeverity.minor;
  final confidenceScore = current.sentimentData.confidence;
  final confidence =
      confidenceScore != null && confidenceScore >= 0.75
          ? ChangeConfidence.high
          : confidenceScore != null && confidenceScore >= 0.5
          ? ChangeConfidence.medium
          : ChangeConfidence.low;

  return [
    ChangeEvent(
      changeId: _nextId(entityId, ChangeType.sentimentChange),
      entityId: entityId,
      changeType: ChangeType.sentimentChange,
      severity: severity,
      title: 'Sentiment shifted $currBand',
      summary:
          'Sentiment moved from $prevBand to $currBand, based on $sampleSize analyzed mentions. '
          'This reflects the tone of coverage, not proof of wrongdoing.',
      previousValue: prevBand,
      currentValue: currBand,
      detectedAt: detectedAt,
      effectiveDate: null,
      evidenceIds: const [],
      relatedClaimIds: const [],
      methodologyVersion: kChangeMethodologyVersion,
      confidence: confidence,
      sourceCoverage: '$sampleSize mentions',
    ),
  ];
}

// ── CritiScore (deterministic, mirrors the backend formula) ─────────

List<ChangeEvent> _critiscoreChange(
  String entityId,
  DateTime detectedAt,
  List<Controversy> previous,
  List<Controversy> current,
) {
  final prevScore = computeControversyIndex(previous).score.round();
  final currScore = computeControversyIndex(current).score.round();
  final delta = currScore - prevScore;
  if (delta == 0) return const [];

  final magnitude = delta.abs();
  final severity =
      magnitude >= 15
          ? ChangeSeverity.major
          : magnitude >= 8
          ? ChangeSeverity.significant
          : ChangeSeverity.minor;
  final confidence = indexConfidence(current);

  final newTitles = current.map((c) => titleSlug(c.title)).toSet();
  final priorTitles = previous.map((c) => titleSlug(c.title)).toSet();
  final added = current.where((c) => !priorTitles.contains(titleSlug(c.title))).toList();
  final removed = previous.where((c) => !newTitles.contains(titleSlug(c.title))).toList();

  var reason = 'The set of documented, corroborated episodes changed.';
  if (delta > 0 && added.isNotEmpty) {
    reason =
        'Score increased primarily because ${added.length} newly supported episode${added.length == 1 ? "" : "s"} increased the evidence/corroboration contribution.';
  } else if (delta < 0 && removed.isNotEmpty) {
    reason =
        'Score decreased because ${removed.length} previously counted episode${removed.length == 1 ? "" : "s"} no longer appear in the corroborated record.';
  } else if (delta > 0) {
    reason =
        "Score increased as existing episodes moved closer in time (recency weighting) or an episode's status became unresolved.";
  }

  return [
    ChangeEvent(
      changeId: _nextId(entityId, ChangeType.critiscoreChange),
      entityId: entityId,
      changeType: ChangeType.critiscoreChange,
      severity: severity,
      title: 'CritiScore ${delta > 0 ? "increased" : "decreased"} ${delta > 0 ? "+" : ""}$delta',
      summary: reason,
      previousValue: '$prevScore',
      currentValue: '$currScore',
      detectedAt: detectedAt,
      effectiveDate: null,
      evidenceIds: const [],
      relatedClaimIds: const [],
      methodologyVersion: '2.0',
      confidence: switch (confidence?.level) {
        ConfidenceLevel.high => ChangeConfidence.high,
        ConfidenceLevel.medium => ChangeConfidence.medium,
        ConfidenceLevel.low => ChangeConfidence.low,
        null => ChangeConfidence.low,
      },
      sourceCoverage: null,
    ),
  ];
}

// ── Profile metadata ─────────────────────────────────────────────────

String _normalizeBio(String s) => s.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

List<ChangeEvent> _profileChanges(
  String entityId,
  DateTime detectedAt,
  Celebrity previous,
  Celebrity current,
) {
  final out = <ChangeEvent>[];
  if (current.biography.summary.isNotEmpty &&
      _normalizeBio(previous.biography.summary) != _normalizeBio(current.biography.summary)) {
    out.add(
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.profileChange),
        entityId: entityId,
        changeType: ChangeType.profileChange,
        severity: ChangeSeverity.info,
        title: 'Biography summary updated',
        summary: "The profile's summary text changed.",
        previousValue: previous.biography.summary.isEmpty ? null : previous.biography.summary,
        currentValue: current.biography.summary,
        detectedAt: detectedAt,
        effectiveDate: null,
        evidenceIds: const [],
        relatedClaimIds: const [],
        methodologyVersion: kChangeMethodologyVersion,
        confidence: ChangeConfidence.medium,
        sourceCoverage: null,
      ),
    );
  }
  return out;
}

// ── Data coverage / availability ────────────────────────────────────

List<ChangeEvent> _coverageChanges(
  String entityId,
  DateTime detectedAt,
  Celebrity previous,
  Celebrity current,
) {
  final prevEvidence = buildEvidenceItems(
    media: previous.mediaItems,
    controversies: previous.biography.controversies,
    career: previous.facts.career,
    sentimentEvidence: previous.sentimentData.evidence,
  );
  final currEvidence = buildEvidenceItems(
    media: current.mediaItems,
    controversies: current.biography.controversies,
    career: current.facts.career,
    sentimentEvidence: current.sentimentData.evidence,
  );
  final prevReport = buildCoverageReport(
    celebrity: previous,
    evidenceItems: prevEvidence,
    claims: buildClaimMatrix(previous.biography.controversies, prevEvidence),
  );
  final currReport = buildCoverageReport(
    celebrity: current,
    evidenceItems: currEvidence,
    claims: buildClaimMatrix(current.biography.controversies, currEvidence),
  );
  final prevByKey = {for (final d in prevReport.dimensions) d.key: d.level};

  final out = <ChangeEvent>[];
  for (final d in currReport.dimensions) {
    final before = prevByKey[d.key];
    if (before == null || before == d.level) continue;

    final wentUnavailable = d.level == CoverageLevel.unavailable && before != CoverageLevel.unavailable;
    final cameBack = before == CoverageLevel.unavailable && d.level != CoverageLevel.unavailable;
    final label = d.label;

    if (wentUnavailable || cameBack) {
      out.add(
        ChangeEvent(
          changeId: _nextId(entityId, ChangeType.dataAvailabilityChange),
          entityId: entityId,
          changeType: ChangeType.dataAvailabilityChange,
          severity: ChangeSeverity.info,
          title: '$label data ${wentUnavailable ? "temporarily unavailable" : "available again"}',
          summary:
              wentUnavailable
                  ? 'The $label provider returned no usable data this refresh.'
                  : '$label data is available again.',
          previousValue: before.label,
          currentValue: d.level.label,
          detectedAt: detectedAt,
          effectiveDate: null,
          evidenceIds: const [],
          relatedClaimIds: const [],
          methodologyVersion: currReport.coverageVersion,
          confidence: ChangeConfidence.medium,
          sourceCoverage: null,
        ),
      );
      continue;
    }

    out.add(
      ChangeEvent(
        changeId: _nextId(entityId, ChangeType.sourceCoverageChange),
        entityId: entityId,
        changeType: ChangeType.sourceCoverageChange,
        severity: ChangeSeverity.info,
        title: '$label coverage: ${before.label} → ${d.level.label}',
        summary: d.reasons.isNotEmpty ? d.reasons.first : 'Coverage level changed.',
        previousValue: before.label,
        currentValue: d.level.label,
        detectedAt: detectedAt,
        effectiveDate: null,
        evidenceIds: const [],
        relatedClaimIds: const [],
        methodologyVersion: currReport.coverageVersion,
        confidence: ChangeConfidence.high,
        sourceCoverage: null,
      ),
    );
  }
  return out;
}

// ── Orchestration ────────────────────────────────────────────────────

const Map<ChangeSeverity, int> _severityRank = {
  ChangeSeverity.info: 0,
  ChangeSeverity.minor: 1,
  ChangeSeverity.significant: 2,
  ChangeSeverity.major: 3,
};

/// Detects every meaningful change between two real snapshots of the
/// same person. `detectedAt` should be the real fetch time of
/// [current] — never `DateTime.now()` computed inside this function
/// (kept an explicit parameter for purity/testing).
List<ChangeEvent> detectChanges(Celebrity previous, Celebrity current, DateTime detectedAt) {
  if (previous.slug != current.slug) return const [];
  final entityId = current.slug;

  final prevEvidence = buildEvidenceItems(
    media: previous.mediaItems,
    controversies: previous.biography.controversies,
    career: previous.facts.career,
    sentimentEvidence: previous.sentimentData.evidence,
  );
  final currEvidence = buildEvidenceItems(
    media: current.mediaItems,
    controversies: current.biography.controversies,
    career: current.facts.career,
    sentimentEvidence: current.sentimentData.evidence,
  );

  final events = [
    ..._careerChanges(entityId, detectedAt, previous.facts.career, current.facts.career),
    ..._professionChange(entityId, detectedAt, previous.biography.profession, current.biography.profession),
    ..._controversyChanges(
      entityId,
      detectedAt,
      previous.biography.controversies,
      current.biography.controversies,
    ),
    ..._claimChanges(
      entityId,
      detectedAt,
      buildClaimMatrix(previous.biography.controversies, prevEvidence),
      buildClaimMatrix(current.biography.controversies, currEvidence),
    ),
    ..._newsChanges(
      entityId,
      detectedAt,
      previous.mediaItems,
      current.mediaItems,
      current.biography.controversies,
    ),
    ..._sentimentChange(entityId, detectedAt, previous, current),
    ..._critiscoreChange(entityId, detectedAt, previous.biography.controversies, current.biography.controversies),
    ..._profileChanges(entityId, detectedAt, previous, current),
    ..._coverageChanges(entityId, detectedAt, previous, current),
  ];

  events.sort((a, b) => _severityRank[b.severity]!.compareTo(_severityRank[a.severity]!));
  return events;
}

enum ChangeFilter { all, career, controversies, claims, news, sentiment, score, profile }

const Map<ChangeFilter, List<ChangeType>> _filterTypes = {
  ChangeFilter.career: [ChangeType.careerChange, ChangeType.professionChange, ChangeType.organizationChange],
  ChangeFilter.controversies: [ChangeType.controversyChange],
  ChangeFilter.claims: [ChangeType.claimChange],
  ChangeFilter.news: [ChangeType.newsChange],
  ChangeFilter.sentiment: [ChangeType.sentimentChange],
  ChangeFilter.score: [ChangeType.critiscoreChange],
  ChangeFilter.profile: [
    ChangeType.profileChange,
    ChangeType.sourceCoverageChange,
    ChangeType.dataAvailabilityChange,
  ],
};

List<ChangeEvent> filterChanges(List<ChangeEvent> changes, ChangeFilter filter) {
  if (filter == ChangeFilter.all) return changes;
  final types = _filterTypes[filter]!;
  return changes.where((c) => types.contains(c.changeType)).toList();
}
