/// Methodology & Audit Trail — the Dart twin of `site/lib/methodology.ts`.
/// Ties a calculated result back to the version of the code that
/// produced it, when it was calculated, and the real inputs behind it.
///
/// Nothing here recalculates an authoritative result — CritiScore stays
/// [computeControversyIndex]'s formula, evidence stays the existing
/// strength rules, claims stay Step 12's status logic. This module only
/// reads their outputs and version constants and packages them for
/// display. Where a "breakdown" component is not actually exposed by the
/// underlying calculation, this never invents one.
library;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';

/// First formally tracked version of the CritiScore formula in
/// `controversy_index.dart`. "2.0" marks the Step 9 "CritiScore 2.0"
/// presentation/transparency upgrade — the underlying arithmetic has
/// been unchanged since it shipped.
const String kCritiscoreMethodologyVersion = '2.0';

/// First formally tracked version of the backend's three-method
/// sentiment ensemble. Numbered "2.0" because it is genuinely the
/// second generation of the method (v1 was single-method).
const String kSentimentMethodologyVersion = '2.0';

/// First formally tracked version of the evidence normalisation and
/// strength rules in `evidence.dart`.
const String kEvidenceMethodologyVersion = '1.0';

/// Entity Resolution has no independent version of its own — it is
/// server-computed and only a verified flag/Wikidata id reach the app.
/// "1.0" documents the first formally tracked version of that
/// client-visible behaviour, not a claim about backend internals.
const String kEntityResolutionMethodologyVersion = '1.0';

/// First formally tracked version of the timeline assembly rules.
const String kTimelineMethodologyVersion = '1.0';

enum MethodologySystem {
  entityResolution,
  evidence,
  claims,
  critiscore,
  sentiment,
  timeline,
  coverage,
}

extension MethodologySystemLabel on MethodologySystem {
  String get label => switch (this) {
    MethodologySystem.entityResolution => 'Entity Resolution',
    MethodologySystem.evidence => 'Evidence & Sources',
    MethodologySystem.claims => 'Claim Verification',
    MethodologySystem.critiscore => 'CritiScore',
    MethodologySystem.sentiment => 'Public Sentiment',
    MethodologySystem.timeline => 'Timeline',
    MethodologySystem.coverage => 'Data Coverage',
  };

  String get version => switch (this) {
    MethodologySystem.entityResolution => kEntityResolutionMethodologyVersion,
    MethodologySystem.evidence => kEvidenceMethodologyVersion,
    MethodologySystem.claims => kClaimMethodologyVersion,
    MethodologySystem.critiscore => kCritiscoreMethodologyVersion,
    MethodologySystem.sentiment => kSentimentMethodologyVersion,
    MethodologySystem.timeline => kTimelineMethodologyVersion,
    MethodologySystem.coverage => kCoverageVersion,
  };
}

class AuditMeta {
  const AuditMeta({
    required this.system,
    required this.calculatedAt,
    required this.confidence,
  });

  final MethodologySystem system;

  /// The real timestamp available for this data — the profile's own
  /// fetch time, since CritiTrack does not store a separate
  /// per-calculation clock.
  final DateTime calculatedAt;
  final String? confidence;

  String get label => system.label;
  String get version => system.version;
}

// ── CritiScore score audit ────────────────────────────────────────────

class ScoreAudit extends AuditMeta {
  const ScoreAudit({
    required super.system,
    required super.calculatedAt,
    required super.confidence,
    required this.score,
    required this.explanation,
    required this.indexConfidence,
  });

  final double score;
  final IndexExplanation explanation;
  final IndexConfidence? indexConfidence;
}

/// The real CritiScore breakdown — [explainControversyIndex]'s
/// per-episode arithmetic, not a fabricated set of named buckets.
ScoreAudit buildScoreAudit(
  DateTime calculatedAt,
  List<Controversy> controversies, {
  int? currentYear,
}) {
  final index = computeControversyIndex(controversies, currentYear: currentYear);
  final explanation = explainControversyIndex(controversies, currentYear: currentYear);
  final confidence = indexConfidence(controversies);
  return ScoreAudit(
    system: MethodologySystem.critiscore,
    calculatedAt: calculatedAt,
    confidence: confidence?.level.label,
    score: index.score,
    explanation: explanation,
    indexConfidence: confidence,
  );
}

// ── Sentiment audit ────────────────────────────────────────────────────

class SentimentAudit extends AuditMeta {
  const SentimentAudit({
    required super.system,
    required super.calculatedAt,
    required super.confidence,
    required this.sampleSize,
    required this.methodAgreementAvailable,
    required this.periodDays,
  });

  final int? sampleSize;
  final bool methodAgreementAvailable;
  final int? periodDays;
}

SentimentAudit buildSentimentAudit(DateTime calculatedAt, SentimentData data) {
  return SentimentAudit(
    system: MethodologySystem.sentiment,
    calculatedAt: calculatedAt,
    confidence: data.confidenceLabel,
    sampleSize: data.sampleSize,
    methodAgreementAvailable: data.confidence != null,
    periodDays: data.trendData.isNotEmpty ? data.trendData.length : null,
  );
}

// ── Evidence / claim audit ─────────────────────────────────────────────

class EvidenceAudit extends AuditMeta {
  const EvidenceAudit({
    required super.system,
    required super.calculatedAt,
    required super.confidence,
    required this.supportingCount,
    required this.contradictingCount,
    required this.responseCount,
    required this.independentPublishers,
    required this.status,
  });

  final int supportingCount;
  final int contradictingCount;
  final int responseCount;
  final int independentPublishers;
  final ClaimStatus status;
}

/// Audit detail for one claim — its own evidence-relationship counts
/// (already computed by Step 12's [Claim]) plus a real independent-
/// publisher count over its supporting evidence. Never re-derives the
/// claim's status, only reports it.
EvidenceAudit buildEvidenceAudit(
  DateTime calculatedAt,
  Claim claim,
  List<EvidenceItem> evidenceItems,
) {
  final byId = {for (final e in evidenceItems) e.evidenceId: e};
  final supporting = claim.supportingEvidenceIds
      .map((id) => byId[id])
      .whereType<EvidenceItem>()
      .toList();
  final publishers = supporting.map((e) => e.sourceName).toSet().length;
  return EvidenceAudit(
    system: MethodologySystem.claims,
    calculatedAt: calculatedAt,
    confidence: claim.confidence.label,
    supportingCount: claim.supportingEvidenceIds.length,
    contradictingCount: claim.contradictingEvidenceIds.length,
    responseCount: claim.responseEvidenceIds.length,
    independentPublishers: publishers,
    status: claim.status,
  );
}
