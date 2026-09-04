/// The Claim Verification Matrix — the Dart twin of `site/lib/claims.ts`.
/// Breaks a controversy record down into the discrete things actually
/// being claimed (an allegation was reported, someone denied it, a body
/// investigated it, an authority ruled on it) and shows, for each one,
/// exactly what evidence backs it, what evidence cuts against it, and
/// what that evidence set does and doesn't establish.
///
/// This is a read-time derivation over [EvidenceItem]s already built by
/// `evidence.dart` — nothing here is fetched, stored, or generated
/// separately, and no model decides a claim's status. "Status" is never
/// a truth verdict: the strongest label this ever produces is "resolved
/// by authoritative finding", and only when the linked evidence itself
/// is a court/official record reporting a ruling.
library;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/evidence.dart';

enum ClaimType {
  allegation,
  reportedEvent,
  statement,
  denial,
  response,
  legalFinding,
  officialFinding,
  careerClaim,
  other,
}

extension ClaimTypeLabel on ClaimType {
  String get label => switch (this) {
    ClaimType.allegation => 'Allegation',
    ClaimType.reportedEvent => 'Reported event',
    ClaimType.statement => 'Statement',
    ClaimType.denial => 'Denial',
    ClaimType.response => 'Response',
    ClaimType.legalFinding => 'Legal finding',
    ClaimType.officialFinding => 'Official finding',
    ClaimType.careerClaim => 'Career / professional claim',
    ClaimType.other => 'Other',
  };
}

enum ClaimStatus {
  supported,
  partiallySupported,
  conflicting,
  reportedUncorroborated,
  insufficientEvidence,
  resolvedAuthoritative,
  unknown,
}

extension ClaimStatusLabel on ClaimStatus {
  String get label => switch (this) {
    ClaimStatus.supported => 'Supported by available evidence',
    ClaimStatus.partiallySupported => 'Partially supported',
    ClaimStatus.conflicting => 'Conflicting evidence',
    ClaimStatus.reportedUncorroborated =>
      'Reported / not independently corroborated',
    ClaimStatus.insufficientEvidence => 'Insufficient evidence',
    ClaimStatus.resolvedAuthoritative => 'Resolved by authoritative finding',
    ClaimStatus.unknown => 'Unknown',
  };
}

enum ClaimConfidence { high, medium, low }

extension ClaimConfidenceLabel on ClaimConfidence {
  String get label => switch (this) {
    ClaimConfidence.high => 'High',
    ClaimConfidence.medium => 'Medium',
    ClaimConfidence.low => 'Low',
  };
}

const String kClaimMethodologyVersion = 'cvm-1';

class Claim {
  const Claim({
    required this.claimId,
    required this.entityId,
    required this.controversyId,
    required this.timelineEventId,
    required this.claimText,
    required this.claimType,
    required this.dateContext,
    required this.status,
    required this.confidence,
    required this.supportingEvidenceIds,
    required this.contradictingEvidenceIds,
    required this.neutralEvidenceIds,
    required this.responseEvidenceIds,
    required this.createdAt,
    required this.updatedAt,
    required this.methodologyVersion,
    required this.statusReason,
  });

  final String claimId;
  final String? entityId;
  final String controversyId;
  final String? timelineEventId;
  final String claimText;
  final ClaimType claimType;
  final String? dateContext;
  final ClaimStatus status;
  final ClaimConfidence confidence;
  final List<String> supportingEvidenceIds;
  final List<String> contradictingEvidenceIds;
  final List<String> neutralEvidenceIds;
  final List<String> responseEvidenceIds;
  final String? createdAt;
  final String? updatedAt;
  final String methodologyVersion;
  final String statusReason;

  int get evidenceCount =>
      {
        ...supportingEvidenceIds,
        ...contradictingEvidenceIds,
        ...neutralEvidenceIds,
        ...responseEvidenceIds,
      }.length;
}

// ── Deterministic text classifiers ──────────────────────────────────
//
// Plain keyword/regex checks over real, already-retrieved headlines and
// summaries — not model inference. They only ever route an existing
// piece of evidence into a bucket; they never author claim text or
// invent that an event happened.

final RegExp _responseRe = RegExp(
  r'\b(den(y|ies|ied|ying)|spokesperson|representative (said|stated)|responds?|responded|responding|issued a statement|declined to comment)\b',
  caseSensitive: false,
);

final RegExp _contradictRe = RegExp(
  r'\b(clears?|cleared|dismiss(es|ed)?|charges?\s+(were\s+)?dropped|drop(s|ped)?\s+(the\s+)?(charges|case|lawsuit)|no evidence|unfounded|debunked|retracts?|retracted)\b',
  caseSensitive: false,
);

final RegExp _resolutionRe = RegExp(
  r'\b(convicted|conviction|acquitted|acquittal|sentenced|verdict|ruled|ruling|guilty plea|liable|found (in favor|against)|ordered to pay|settlement (reached|announced)|settled the)\b',
  caseSensitive: false,
);

final RegExp _findingRe = RegExp(
  r'\b(court|judge|jury|tribunal)\b',
  caseSensitive: false,
);

final RegExp _investigationRe = RegExp(
  r'\b(investigat\w*|probe|inquiry)\b',
  caseSensitive: false,
);

final RegExp _allegationRe = RegExp(
  r'\b(alleg\w*|accus\w*|claims?\s+(that|of))\b',
  caseSensitive: false,
);

String _textOf(EvidenceItem e) => '${e.title} ${e.snippet ?? ""}';

const Map<EvidenceStrength, int> _strengthRank = {
  EvidenceStrength.strong: 3,
  EvidenceStrength.moderate: 2,
  EvidenceStrength.limited: 1,
  EvidenceStrength.conflicting: 0,
  EvidenceStrength.insufficient: -1,
};

EvidenceStrength? _strongestOf(List<EvidenceItem> items) {
  if (items.isEmpty) return null;
  return items
      .reduce(
        (best, e) =>
            _strengthRank[e.evidenceStrength]! > _strengthRank[best.evidenceStrength]!
                ? e
                : best,
      )
      .evidenceStrength;
}

({String? earliest, String? latest}) _dateSpan(List<EvidenceItem> items) {
  final dates =
      items.map((e) => e.publicationDate).whereType<String>().toList()..sort();
  return (
    earliest: dates.isEmpty ? null : dates.first,
    latest: dates.isEmpty ? null : dates.last,
  );
}

({ClaimStatus status, ClaimConfidence confidence, String reason}) _statusFor(
  List<EvidenceItem> supports,
  List<EvidenceItem> contradicts,
  List<EvidenceItem> neutral,
) {
  if (supports.isEmpty && contradicts.isEmpty && neutral.isEmpty) {
    return (
      status: ClaimStatus.insufficientEvidence,
      confidence: ClaimConfidence.low,
      reason: 'No supporting evidence currently available.',
    );
  }
  if (contradicts.isNotEmpty && supports.isNotEmpty) {
    return (
      status: ClaimStatus.conflicting,
      confidence: ClaimConfidence.medium,
      reason:
          '${supports.length} source${supports.length == 1 ? "" : "s"} report the event, while '
          '${contradicts.length} identified source${contradicts.length == 1 ? "" : "s"} dispute it — the evidence is conflicting.',
    );
  }
  if (contradicts.isNotEmpty) {
    return (
      status: ClaimStatus.conflicting,
      confidence: ClaimConfidence.medium,
      reason:
          'The only evidence linked to this claim disputes it; no independent report corroborates it.',
    );
  }
  final best = _strongestOf(supports);
  if (best == EvidenceStrength.strong) {
    return (
      status: ClaimStatus.supported,
      confidence: ClaimConfidence.high,
      reason: '${supports.length} independently reporting sources support this claim.',
    );
  }
  if (best == EvidenceStrength.moderate) {
    return (
      status: ClaimStatus.supported,
      confidence: ClaimConfidence.medium,
      reason: 'Two independent publishers reported this claim.',
    );
  }
  if (best == EvidenceStrength.limited && neutral.isNotEmpty) {
    return (
      status: ClaimStatus.partiallySupported,
      confidence: ClaimConfidence.low,
      reason:
          'A single source reports this directly, with additional background context available.',
    );
  }
  if (best == EvidenceStrength.limited) {
    return (
      status: ClaimStatus.reportedUncorroborated,
      confidence: ClaimConfidence.low,
      reason:
          'Reported by a limited source set; independent corroboration not available.',
    );
  }
  return (
    status: ClaimStatus.insufficientEvidence,
    confidence: ClaimConfidence.low,
    reason: 'No supporting evidence currently available.',
  );
}

String titleSlug(String title) {
  final normalized = title.toLowerCase();
  return normalized
      .replaceAll(RegExp(r'[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-|-$'), '');
}

/// Builds the Claim Verification Matrix for one controversy. Always
/// returns at least the base "reported event" claim (even with no
/// evidence — status then reads "insufficient evidence" rather than the
/// claim being omitted). Denial, response, and official-finding claims
/// are only added when a linked evidence item's own text contains that
/// signal.
List<Claim> buildClaimsForControversy(
  Controversy controversy,
  List<EvidenceItem> linkedEvidence, {
  String? entityId,
}) {
  final controversyId = titleSlug(controversy.title);
  final claims = <Claim>[];

  final findingItems =
      linkedEvidence
          .where(
            (e) =>
                _findingRe.hasMatch(_textOf(e)) ||
                _resolutionRe.hasMatch(_textOf(e)),
          )
          .toList();
  final responseItems =
      linkedEvidence
          .where(
            (e) =>
                _responseRe.hasMatch(_textOf(e)) && !findingItems.contains(e),
          )
          .toList();
  final contradictItems =
      linkedEvidence
          .where(
            (e) =>
                _contradictRe.hasMatch(_textOf(e)) &&
                !findingItems.contains(e),
          )
          .toList();
  final investigationItems =
      linkedEvidence
          .where(
            (e) =>
                _investigationRe.hasMatch(_textOf(e)) &&
                !findingItems.contains(e) &&
                !responseItems.contains(e) &&
                !contradictItems.contains(e),
          )
          .toList();
  final baseSupportItems =
      linkedEvidence
          .where(
            (e) =>
                !findingItems.contains(e) &&
                !responseItems.contains(e) &&
                !contradictItems.contains(e) &&
                !investigationItems.contains(e),
          )
          .toList();

  // ── Base claim: the reported allegation/event itself ────────────────
  {
    final result = _statusFor(baseSupportItems, contradictItems, [
      ...findingItems,
      ...investigationItems,
    ]);
    final span = _dateSpan(linkedEvidence);
    final claimType =
        _allegationRe.hasMatch('${controversy.title} ${controversy.summary}')
            ? ClaimType.allegation
            : ClaimType.reportedEvent;
    claims.add(
      Claim(
        claimId: '$controversyId-base',
        entityId: entityId,
        controversyId: controversyId,
        timelineEventId: null,
        claimText:
            controversy.summary.isNotEmpty
                ? controversy.summary
                : controversy.title,
        claimType: claimType,
        dateContext:
            span.latest ?? (controversy.year != null ? '${controversy.year}' : null),
        status: result.status,
        confidence: result.confidence,
        supportingEvidenceIds: baseSupportItems.map((e) => e.evidenceId).toList(),
        contradictingEvidenceIds: contradictItems.map((e) => e.evidenceId).toList(),
        neutralEvidenceIds:
            [...findingItems, ...investigationItems].map((e) => e.evidenceId).toList(),
        responseEvidenceIds: responseItems.map((e) => e.evidenceId).toList(),
        createdAt: span.earliest,
        updatedAt: span.latest,
        methodologyVersion: kClaimMethodologyVersion,
        statusReason: result.reason,
      ),
    );
  }

  // ── Response / denial claims — one per distinct responding item ─────
  for (var i = 0; i < responseItems.length; i++) {
    final e = responseItems[i];
    final independent = e.independentSourceCount ?? 1;
    final strong = independent >= 2;
    final isDenial = RegExp(
      r'\bden(y|ies|ied|ying)\b',
      caseSensitive: false,
    ).hasMatch(_textOf(e));
    claims.add(
      Claim(
        claimId: '$controversyId-response-$i',
        entityId: entityId,
        controversyId: controversyId,
        timelineEventId: null,
        claimText: e.title,
        claimType: isDenial ? ClaimType.denial : ClaimType.response,
        dateContext: e.publicationDate,
        status:
            strong ? ClaimStatus.supported : ClaimStatus.reportedUncorroborated,
        confidence: strong ? ClaimConfidence.medium : ClaimConfidence.low,
        supportingEvidenceIds: [e.evidenceId],
        contradictingEvidenceIds: const [],
        neutralEvidenceIds: const [],
        responseEvidenceIds: [e.evidenceId],
        createdAt: e.publicationDate,
        updatedAt: e.publicationDate,
        methodologyVersion: kClaimMethodologyVersion,
        statusReason:
            strong
                ? 'Multiple independent sources report this response.'
                : 'Reported by a limited source set; independent corroboration not available.',
      ),
    );
  }

  // ── Investigation claims (opened, outcome not yet known) ────────────
  for (var i = 0; i < investigationItems.length; i++) {
    final e = investigationItems[i];
    final independent = e.independentSourceCount ?? 1;
    claims.add(
      Claim(
        claimId: '$controversyId-investigation-$i',
        entityId: entityId,
        controversyId: controversyId,
        timelineEventId: null,
        claimText: e.title,
        claimType: ClaimType.officialFinding,
        dateContext: e.publicationDate,
        status:
            independent >= 2
                ? ClaimStatus.partiallySupported
                : ClaimStatus.reportedUncorroborated,
        confidence:
            independent >= 2 ? ClaimConfidence.medium : ClaimConfidence.low,
        supportingEvidenceIds: [e.evidenceId],
        contradictingEvidenceIds: const [],
        neutralEvidenceIds: const [],
        responseEvidenceIds: const [],
        createdAt: e.publicationDate,
        updatedAt: e.publicationDate,
        methodologyVersion: kClaimMethodologyVersion,
        statusReason:
            independent >= 2
                ? 'Multiple independent sources report that this was investigated; no outcome is recorded.'
                : 'Reported by a limited source set; independent corroboration not available.',
      ),
    );
  }

  // ── Legal / official finding claims ──────────────────────────────────
  for (var i = 0; i < findingItems.length; i++) {
    final e = findingItems[i];
    final text = _textOf(e);
    final isCourt = _findingRe.hasMatch(text);
    final resolved =
        _resolutionRe.hasMatch(text) &&
        (e.sourceType == SourceType.government || isCourt);
    claims.add(
      Claim(
        claimId: '$controversyId-finding-$i',
        entityId: entityId,
        controversyId: controversyId,
        timelineEventId: null,
        claimText: e.title,
        claimType: isCourt ? ClaimType.legalFinding : ClaimType.officialFinding,
        dateContext: e.publicationDate,
        status:
            resolved
                ? ClaimStatus.resolvedAuthoritative
                : ClaimStatus.reportedUncorroborated,
        confidence: resolved ? ClaimConfidence.high : ClaimConfidence.low,
        supportingEvidenceIds: [e.evidenceId],
        contradictingEvidenceIds: const [],
        neutralEvidenceIds: const [],
        responseEvidenceIds: const [],
        createdAt: e.publicationDate,
        updatedAt: e.publicationDate,
        methodologyVersion: kClaimMethodologyVersion,
        statusReason:
            resolved
                ? 'A court or official record reports a finding; CritiTrack states the finding as reported, not as its own judgment.'
                : 'A finding was reported but the source is not itself an authoritative record.',
      ),
    );
  }

  return claims;
}

/// Builds the matrix for every corroborated controversy on a profile.
List<Claim> buildClaimMatrix(
  List<Controversy> controversies,
  List<EvidenceItem> evidenceItems, {
  String? entityId,
}) {
  final out = <Claim>[];
  for (final c in controversies) {
    final linked =
        evidenceItems.where((e) => e.relatedControversies.contains(c.title)).toList();
    out.addAll(buildClaimsForControversy(c, linked, entityId: entityId));
  }
  return out;
}

List<Claim> claimsForControversy(List<Claim> claims, String controversyTitle) {
  final id = titleSlug(controversyTitle);
  return claims.where((c) => c.controversyId == id).toList();
}

enum ClaimFilter {
  all,
  supported,
  conflicting,
  insufficient,
  responses,
  officialFindings,
}

List<Claim> filterClaims(List<Claim> claims, ClaimFilter filter) {
  switch (filter) {
    case ClaimFilter.all:
      return claims;
    case ClaimFilter.supported:
      return claims
          .where(
            (c) =>
                c.status == ClaimStatus.supported ||
                c.status == ClaimStatus.resolvedAuthoritative,
          )
          .toList();
    case ClaimFilter.conflicting:
      return claims.where((c) => c.status == ClaimStatus.conflicting).toList();
    case ClaimFilter.insufficient:
      return claims
          .where(
            (c) =>
                c.status == ClaimStatus.insufficientEvidence ||
                c.status == ClaimStatus.reportedUncorroborated,
          )
          .toList();
    case ClaimFilter.responses:
      return claims
          .where(
            (c) => c.claimType == ClaimType.denial || c.claimType == ClaimType.response,
          )
          .toList();
    case ClaimFilter.officialFindings:
      return claims
          .where(
            (c) =>
                c.claimType == ClaimType.legalFinding ||
                c.claimType == ClaimType.officialFinding,
          )
          .toList();
  }
}
