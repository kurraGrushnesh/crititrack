// The Methodology & Audit Trail's version registry and audit builders —
// regression tests confirm the underlying CritiScore/sentiment/evidence
// calculations are only ever read here, never recomputed differently.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';
import 'package:crititrack/core/utils/methodology.dart';

Controversy controversy({int severity = 4, int? year = 2024}) => Controversy(
  title: 'Episode',
  summary: 'summary',
  category: ControversyCategory.legal,
  severity: severity,
  status: ControversyStatus.ongoing,
  year: year,
  sources: const ['https://reuters.com/1'],
);

EvidenceItem evidence({
  String evidenceId = 'media-1',
  String sourceName = 'Reuters',
}) => EvidenceItem(
  evidenceId: evidenceId,
  sourceUrl: 'https://reuters.com/1',
  sourceName: sourceName,
  sourceType: SourceType.news,
  title: 'A story',
  publicationDate: '2024-01-01',
  snippet: null,
  category: EvidenceCategory.controversy,
  relatedControversies: const ['Episode'],
  relatedToSentiment: false,
  duplicateCount: 1,
  independentSourceCount: 3,
  evidenceStrength: EvidenceStrength.strong,
  strengthReason: 'x',
);

Claim claim({
  ClaimStatus status = ClaimStatus.conflicting,
  List<String> supporting = const ['media-1'],
}) => Claim(
  claimId: 'episode-base',
  entityId: null,
  controversyId: 'episode',
  timelineEventId: null,
  claimText: 'text',
  claimType: ClaimType.reportedEvent,
  dateContext: null,
  status: status,
  confidence: ClaimConfidence.medium,
  supportingEvidenceIds: supporting,
  contradictingEvidenceIds: const ['media-2'],
  neutralEvidenceIds: const [],
  responseEvidenceIds: const [],
  createdAt: null,
  updatedAt: null,
  methodologyVersion: 'cvm-1',
  statusReason: 'reason',
);

void main() {
  group('MethodologySystem versions', () {
    test('every system has a non-empty version, no duplicates by label', () {
      final labels = MethodologySystem.values.map((s) => s.label).toSet();
      expect(labels.length, MethodologySystem.values.length);
      for (final s in MethodologySystem.values) {
        expect(s.version, isNotEmpty);
      }
    });

    test('critiscore and coverage versions match their own source-of-truth constants', () {
      expect(MethodologySystem.critiscore.version, kCritiscoreMethodologyVersion);
      expect(MethodologySystem.coverage.version, kCoverageVersion);
      expect(MethodologySystem.claims.version, kClaimMethodologyVersion);
    });
  });

  group('buildScoreAudit — regression: CritiScore calculation is unchanged', () {
    test("the audit's score matches computeControversyIndex exactly", () {
      final items = [controversy(), controversy(severity: 2, year: 2020)];
      final calculatedAt = DateTime.utc(2026, 9, 5);
      final audit = buildScoreAudit(calculatedAt, items);
      final direct = computeControversyIndex(items);

      expect(audit.score, direct.score);
      expect(audit.version, kCritiscoreMethodologyVersion);
      expect(audit.calculatedAt, calculatedAt);
      // The real per-episode decomposition, not a fabricated bucket list.
      expect(audit.explanation.rows, hasLength(2));
    });

    test('no controversies -> indexConfidence is null, never fabricated', () {
      final audit = buildScoreAudit(DateTime.utc(2026, 9, 5), const []);
      expect(audit.score, 0);
      expect(audit.indexConfidence, isNull);
      expect(audit.confidence, isNull);
    });
  });

  group('buildSentimentAudit — regression: sentiment fields are read, not recomputed', () {
    test('method agreement present -> flagged available, sample size passed through', () {
      final data = SentimentData(
        overallScore: -10,
        positiveRatio: 0.2,
        negativeRatio: 0.5,
        neutralRatio: 0.3,
        trendDirection: 'down',
        explanation: '',
        trendData: [
          SentimentSnapshot(
            date: '2026-08-01',
            positiveCount: 1,
            negativeCount: 1,
            neutralCount: 1,
            totalMentions: 3,
            dominantEmotion: 'neutral',
            score: -10,
          ),
        ],
        dominantEmotion: 'anger',
        sampleSize: 428,
        confidence: 0.8,
        confidenceLabel: 'High',
      );
      final audit = buildSentimentAudit(DateTime.utc(2026, 9, 5), data);
      expect(audit.methodAgreementAvailable, isTrue);
      expect(audit.sampleSize, 428);
      expect(audit.periodDays, 1);
      expect(audit.confidence, 'High');
    });

    test('no confidence figure -> flagged not available, never guessed', () {
      final data = SentimentData(
        overallScore: -10,
        positiveRatio: 0.2,
        negativeRatio: 0.5,
        neutralRatio: 0.3,
        trendDirection: 'down',
        explanation: '',
        trendData: const [],
        dominantEmotion: 'anger',
      );
      final audit = buildSentimentAudit(DateTime.utc(2026, 9, 5), data);
      expect(audit.methodAgreementAvailable, isFalse);
      expect(audit.periodDays, isNull);
    });
  });

  group('buildEvidenceAudit — regression: evidence relationships are read, not recomputed', () {
    test('independent publisher count is computed over the claim\'s own supporting evidence only', () {
      final items = [
        evidence(evidenceId: 'media-1', sourceName: 'Reuters'),
        evidence(evidenceId: 'media-2', sourceName: 'AP'),
        evidence(evidenceId: 'media-3', sourceName: 'Reuters'),
      ];
      final audit = buildEvidenceAudit(DateTime.utc(2026, 9, 5), claim(), items);
      expect(audit.supportingCount, 1);
      expect(audit.contradictingCount, 1);
      expect(audit.independentPublishers, 1);
      expect(audit.status, ClaimStatus.conflicting);
      expect(audit.version, kClaimMethodologyVersion);
    });

    test('a dangling evidence id never crashes or fabricates a source', () {
      final audit = buildEvidenceAudit(DateTime.utc(2026, 9, 5), claim(), const []);
      expect(audit.independentPublishers, 0);
    });
  });
}
