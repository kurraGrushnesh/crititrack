// The Claim Verification Matrix's normalisation, evidence-relationship
// classification, and honesty rules — a claim's status must never be
// invented, and a status must never read as a truth verdict.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/evidence.dart';

EvidenceItem ev({
  String evidenceId = 'media-1',
  String title = 'Star faces new allegations',
  String? snippet,
  String? publicationDate = '2024-03-01',
  int? independentSourceCount = 1,
  EvidenceStrength evidenceStrength = EvidenceStrength.limited,
  SourceType sourceType = SourceType.news,
  String? sentimentTag,
}) => EvidenceItem(
  evidenceId: evidenceId,
  sourceUrl: 'https://reuters.com/story',
  sourceName: 'Reuters',
  sourceType: sourceType,
  title: title,
  publicationDate: publicationDate,
  snippet: snippet,
  category: EvidenceCategory.controversy,
  relatedControversies: const ['New allegations'],
  relatedToSentiment: false,
  duplicateCount: 1,
  independentSourceCount: independentSourceCount,
  evidenceStrength: evidenceStrength,
  strengthReason: 'reported by a single publisher found so far',
  sentimentTag: sentimentTag,
);

Controversy controversy({
  String title = 'New allegations',
  String summary = 'Person was accused of misconduct.',
  int severity = 4,
  int? year = 2024,
  List<String> sources = const ['https://reuters.com/story'],
}) => Controversy(
  title: title,
  summary: summary,
  category: ControversyCategory.legal,
  severity: severity,
  status: ControversyStatus.ongoing,
  year: year,
  sources: sources,
);

void main() {
  group('titleSlug', () {
    test('is stable and URL-safe', () {
      expect(titleSlug('New allegations!'), 'new-allegations');
    });
  });

  group('buildClaimsForControversy — base claim', () {
    test('case 1: one allegation, no corroboration', () {
      final claims = buildClaimsForControversy(controversy(), [ev()]);
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.status, ClaimStatus.reportedUncorroborated);
      expect(base.confidence, ClaimConfidence.low);
      expect(base.supportingEvidenceIds, ['media-1']);
    });

    test('case 2: multiple independent reports -> supported, high confidence', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceStrength: EvidenceStrength.strong, independentSourceCount: 3),
      ]);
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.status, ClaimStatus.supported);
      expect(base.confidence, ClaimConfidence.high);
    });

    test('no evidence at all -> insufficient evidence, never fabricated', () {
      final claims = buildClaimsForControversy(
        controversy(sources: const []),
        const [],
      );
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.status, ClaimStatus.insufficientEvidence);
      expect(base.supportingEvidenceIds, isEmpty);
      expect(base.statusReason, 'No supporting evidence currently available.');
    });

    test('case 4: supporting + contradicting sources -> conflicting, never auto-majority', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(
          evidenceId: 'media-1',
          evidenceStrength: EvidenceStrength.strong,
          independentSourceCount: 3,
        ),
        ev(
          evidenceId: 'media-2',
          title: 'Charges dropped against star',
          evidenceStrength: EvidenceStrength.moderate,
        ),
      ]);
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.status, ClaimStatus.conflicting);
      expect(base.confidence, ClaimConfidence.medium);
      expect(base.contradictingEvidenceIds, ['media-2']);
    });
  });

  group('buildClaimsForControversy — denial/response', () {
    test('case 5: a denial produces its own claim, distinct from the base allegation', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-1'),
        ev(
          evidenceId: 'media-2',
          title: 'Star denies the allegations',
          independentSourceCount: 2,
        ),
      ]);
      final denial = claims.firstWhere((c) => c.claimType == ClaimType.denial);
      expect(denial.status, ClaimStatus.supported);
      expect(denial.responseEvidenceIds, ['media-2']);

      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.supportingEvidenceIds, isNot(contains('media-2')));
      expect(base.responseEvidenceIds, contains('media-2'));
    });

    test('a lone, uncorroborated denial reads as reported, not proven', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-1', title: 'Star denies the allegations'),
      ]);
      final denial = claims.firstWhere((c) => c.claimType == ClaimType.denial);
      expect(denial.status, ClaimStatus.reportedUncorroborated);
    });
  });

  group('buildClaimsForControversy — official/legal findings', () {
    test('case 6: an investigation with no outcome never becomes a finding', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(
          evidenceId: 'media-2',
          title: 'Authorities investigate allegations against star',
          independentSourceCount: 2,
        ),
      ]);
      expect(
        claims.where((c) => c.claimType == ClaimType.legalFinding),
        isEmpty,
      );
      final investigation = claims.firstWhere(
        (c) => c.claimType == ClaimType.officialFinding,
      );
      expect(investigation.status, ClaimStatus.partiallySupported);
    });

    test('case 7: a court ruling reads as a reported finding, never as a verdict', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(
          evidenceId: 'media-3',
          title: 'Court finds star liable, orders damages',
          sourceType: SourceType.government,
        ),
      ]);
      final finding = claims.firstWhere((c) => c.claimType == ClaimType.legalFinding);
      expect(finding.status, ClaimStatus.resolvedAuthoritative);
      expect(finding.confidence, ClaimConfidence.high);
      expect(finding.claimText.toLowerCase(), isNot(contains('guilty')));
    });

    test("a bare mention of 'court' with no resolution word stays unresolved", () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-3', title: 'Star to appear in court next month'),
      ]);
      final finding = claims.firstWhere((c) => c.claimType == ClaimType.legalFinding);
      expect(finding.status, ClaimStatus.reportedUncorroborated);
    });
  });

  group('case 8/9: same event vs. unrelated claims about the same person', () {
    test('two evidence items about the same event stay one base claim', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-1', publicationDate: '2024-01-01'),
        ev(evidenceId: 'media-2', publicationDate: '2024-06-01'),
      ]);
      expect(claims.where((c) => c.claimId.endsWith('-base')), hasLength(1));
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.createdAt, '2024-01-01');
      expect(base.updatedAt, '2024-06-01');
    });

    test('two unrelated controversies never merge into one claim', () {
      final claims = buildClaimMatrix(
        [
          controversy(title: 'New allegations'),
          controversy(title: 'Tax dispute'),
        ],
        [
          EvidenceItem(
            evidenceId: 'media-1',
            sourceUrl: 'https://a.example/1',
            sourceName: 'A',
            sourceType: SourceType.news,
            title: 'Star faces new allegations',
            publicationDate: '2024-01-01',
            snippet: null,
            category: EvidenceCategory.controversy,
            relatedControversies: const ['New allegations'],
            relatedToSentiment: false,
            duplicateCount: 1,
            independentSourceCount: 1,
            evidenceStrength: EvidenceStrength.limited,
            strengthReason: 'x',
          ),
          EvidenceItem(
            evidenceId: 'media-2',
            sourceUrl: 'https://b.example/2',
            sourceName: 'B',
            sourceType: SourceType.news,
            title: 'Tax dispute reported',
            publicationDate: '2024-01-01',
            snippet: null,
            category: EvidenceCategory.controversy,
            relatedControversies: const ['Tax dispute'],
            relatedToSentiment: false,
            duplicateCount: 1,
            independentSourceCount: 1,
            evidenceStrength: EvidenceStrength.limited,
            strengthReason: 'x',
          ),
        ],
      );
      final controversyIds = claims.map((c) => c.controversyId).toSet();
      expect(controversyIds, hasLength(2));
    });
  });

  group('buildClaimMatrix / lookup / filters', () {
    test('claimsForControversy finds only that controversy\'s claims', () {
      final claims = buildClaimMatrix(
        [
          controversy(title: 'New allegations'),
          controversy(title: 'Tax dispute', sources: const []),
        ],
        [ev()],
      );
      expect(claimsForControversy(claims, 'Tax dispute'), hasLength(1));
      expect(
        claimsForControversy(claims, 'Tax dispute').first.status,
        ClaimStatus.insufficientEvidence,
      );
    });

    test('filterClaims separates responses and official findings', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-1'),
        ev(evidenceId: 'media-2', title: 'Star denies the allegations'),
        ev(
          evidenceId: 'media-3',
          title: 'Court finds star liable',
          sourceType: SourceType.government,
        ),
      ]);
      expect(filterClaims(claims, ClaimFilter.responses), hasLength(1));
      expect(filterClaims(claims, ClaimFilter.officialFindings), hasLength(1));
      expect(filterClaims(claims, ClaimFilter.all), hasLength(claims.length));
    });
  });

  group('CritiScore / sentiment separation', () {
    test('a positively-toned but uncorroborated denial does not disprove the allegation', () {
      final claims = buildClaimsForControversy(controversy(), [
        ev(evidenceId: 'media-1', sentimentTag: 'negative'),
        ev(
          evidenceId: 'media-2',
          title: 'Star denies the allegations',
          sentimentTag: 'positive',
        ),
      ]);
      final base = claims.firstWhere((c) => c.claimId.endsWith('-base'));
      expect(base.status, ClaimStatus.reportedUncorroborated);
    });
  });
}
