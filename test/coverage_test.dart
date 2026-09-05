// The Data Coverage & Confidence Center's dimension-by-dimension
// calculations — never a single combined score, never a fabricated
// reason, never "0" standing in for "unavailable".
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/coverage.dart';
import 'package:crititrack/core/utils/evidence.dart';

MediaItem media({
  String id = '1',
  String title = 'A story',
  String? source = 'Reuters',
  MediaType type = MediaType.news,
  DateTime? publishedAt,
  String? channelTitle,
  String? sentimentTag,
}) => MediaItem(
  id: id,
  type: type,
  title: title,
  url: 'https://reuters.com/$id',
  source: source,
  publishedAt: publishedAt ?? DateTime.utc(2024, 1, 1),
  channelTitle: channelTitle,
  sentimentTag: sentimentTag,
);

EvidenceItem evidence({
  String evidenceId = 'media-1',
  EvidenceStrength evidenceStrength = EvidenceStrength.limited,
  String? sentimentTag,
}) => EvidenceItem(
  evidenceId: evidenceId,
  sourceUrl: 'https://reuters.com/1',
  sourceName: 'Reuters',
  sourceType: SourceType.news,
  title: 'A story',
  publicationDate: '2024-01-01',
  snippet: null,
  category: EvidenceCategory.news,
  relatedControversies: const [],
  relatedToSentiment: false,
  duplicateCount: 1,
  independentSourceCount: 1,
  evidenceStrength: evidenceStrength,
  strengthReason: 'x',
  sentimentTag: sentimentTag,
);

Controversy controversy() => const Controversy(
  title: 'Episode',
  summary: 'summary',
  category: ControversyCategory.legal,
  severity: 3,
  status: ControversyStatus.ongoing,
  year: 2024,
  sources: ['https://reuters.com/1'],
);

Claim claim({ClaimStatus status = ClaimStatus.supported}) => Claim(
  claimId: 'episode-base',
  entityId: null,
  controversyId: 'episode',
  timelineEventId: null,
  claimText: 'text',
  claimType: ClaimType.reportedEvent,
  dateContext: null,
  status: status,
  confidence: ClaimConfidence.high,
  supportingEvidenceIds: const ['media-1'],
  contradictingEvidenceIds: const [],
  neutralEvidenceIds: const [],
  responseEvidenceIds: const [],
  createdAt: null,
  updatedAt: null,
  methodologyVersion: 'cvm-1',
  statusReason: 'reason',
);

void main() {
  group('identityCoverage', () {
    test('no wikidata id -> unavailable', () {
      expect(identityCoverage(null, false).level, CoverageLevel.unavailable);
    });
    test('resolved and verified -> high, available', () {
      final r = identityCoverage('Q1', true);
      expect(r.level, CoverageLevel.high);
      expect(r.status, DataStatus.available);
    });
    test('resolved but unverified -> medium, limited (never fabricated confidence)', () {
      final r = identityCoverage('Q1', false);
      expect(r.level, CoverageLevel.medium);
      expect(r.status, DataStatus.limited);
    });
  });

  group('professionalCoverage', () {
    test('no occupations -> unavailable', () {
      expect(professionalCoverage(const []).level, CoverageLevel.unavailable);
    });
  });

  group('careerCoverage', () {
    test('no records -> unavailable', () {
      expect(careerCoverage(const []).level, CoverageLevel.unavailable);
    });

    test('case: strong entity resolution but weak news coverage — career reads independently high', () {
      final timeline = List.generate(
        6,
        (i) => CareerEntry(
          role: 'Role',
          organization: 'Org',
          start: 2010 + i,
          end: null,
          sourceName: 'Wikidata',
          sourceUrl: 'https://www.wikidata.org/wiki/Q1',
        ),
      );
      expect(careerCoverage(timeline).level, CoverageLevel.high);
    });
  });

  group('newsCoverage — case 1 & 2: popular vs. less-famous person', () {
    test('case 1: a popular person with only duplicate-source articles reads low/limited', () {
      final items = [media(id: '1', source: 'TMZ'), media(id: '2', source: 'TMZ')];
      final r = newsCoverage(items);
      expect(r.level, CoverageLevel.low);
      expect(r.status, DataStatus.limited);
    });

    test('case 2: a less-famous person with many independent reports reads high', () {
      final items = List.generate(
        60,
        (i) => media(id: '$i', source: 'Publisher ${i % 6}'),
      );
      final r = newsCoverage(items);
      expect(r.level, CoverageLevel.high);
      expect(r.status, DataStatus.available);
    });

    test('case 3: only one source stays limited even with many articles', () {
      final items = List.generate(40, (i) => media(id: '$i', source: 'OnlyOutlet'));
      expect(newsCoverage(items).status, DataStatus.limited);
    });

    test('no news -> unavailable, reasons never say a bare 0', () {
      final r = newsCoverage(const []);
      expect(r.level, CoverageLevel.unavailable);
      for (final reason in r.reasons) {
        expect(reason, isNot(matches(RegExp(r'\b0\b'))));
      }
    });
  });

  group('evidenceCoverage — case 4', () {
    test('conflicting evidence reads a conflicting status, never averaged away', () {
      final items = [
        evidence(evidenceId: 'a', evidenceStrength: EvidenceStrength.conflicting, sentimentTag: 'negative'),
        evidence(evidenceId: 'b', evidenceStrength: EvidenceStrength.conflicting, sentimentTag: 'positive'),
      ];
      expect(evidenceCoverage(items).status, DataStatus.conflicting);
    });

    test('no evidence -> unavailable', () {
      expect(evidenceCoverage(const []).level, CoverageLevel.unavailable);
    });
  });

  group('claimsCoverage', () {
    test('zero controversies -> not applicable, never a bare zero', () {
      final r = claimsCoverage(const [], 0);
      expect(r.status, DataStatus.notApplicable);
    });

    test('conflicting claims -> conflicting status', () {
      final r = claimsCoverage([claim(status: ClaimStatus.conflicting)], 1);
      expect(r.status, DataStatus.conflicting);
    });
  });

  group('controversiesCoverage — honesty about a clean record', () {
    test('zero controversies never reads as "no controversies exist"', () {
      final r = controversiesCoverage(const []);
      expect(r.reasons.first, 'No supported controversy records are currently available.');
    });
  });

  group('sentimentCoverage — case 9: strong news but weak sentiment sample', () {
    final base = SentimentData(
      overallScore: 40,
      positiveRatio: 0.2,
      negativeRatio: 0.5,
      neutralRatio: 0.3,
      trendDirection: 'down',
      explanation: '',
      trendData: const [],
      dominantEmotion: 'anger',
    );

    test('small sample with low confidence reads low', () {
      final data = base.copyWith(sampleSize: 4, confidence: 0.2);
      expect(sentimentCoverage(data, const []).level, CoverageLevel.low);
    });

    test('no sample -> unavailable', () {
      final data = base.copyWith(sampleSize: 0, confidence: 0.9);
      expect(sentimentCoverage(data, const []).level, CoverageLevel.unavailable);
    });
  });

  group('youtubeCoverage — zero items reads unavailable, not zero', () {
    test('unavailable when no videos retrieved', () {
      final r = youtubeCoverage([media(type: MediaType.news)]);
      expect(r.level, CoverageLevel.unavailable);
      for (final reason in r.reasons) {
        expect(reason, isNot(matches(RegExp(r'\b0\b'))));
      }
    });
  });

  group('wikipediaCoverage', () {
    test('no summary/background -> unavailable', () {
      const bio = Biography(profession: '', summary: '', background: '', notableWorks: [], controversies: []);
      expect(wikipediaCoverage(bio).level, CoverageLevel.unavailable);
    });
    test('summary text present -> high', () {
      const bio = Biography(
        profession: '',
        summary: 'Bio text.',
        background: '',
        notableWorks: [],
        controversies: [],
      );
      expect(wikipediaCoverage(bio).level, CoverageLevel.high);
    });
  });

  group('historicalCoverage — case 6 & 7: no snapshots vs. sparse snapshots', () {
    test('case 6: zero snapshots -> unavailable', () {
      expect(historicalCoverage(const []).level, CoverageLevel.unavailable);
    });

    test('case 7: sparse snapshots with a real gap are flagged, never invented as continuous', () {
      final trend = [
        SentimentSnapshot(
          date: '2024-01-01',
          positiveCount: 1,
          negativeCount: 1,
          neutralCount: 1,
          totalMentions: 3,
          dominantEmotion: 'neutral',
          score: 0.1,
        ),
        SentimentSnapshot(
          date: '2024-06-01',
          positiveCount: 1,
          negativeCount: 1,
          neutralCount: 1,
          totalMentions: 3,
          dominantEmotion: 'neutral',
          score: 0.1,
        ),
        SentimentSnapshot(
          date: '2024-06-02',
          positiveCount: 1,
          negativeCount: 1,
          neutralCount: 1,
          totalMentions: 3,
          dominantEmotion: 'neutral',
          score: 0.1,
        ),
      ];
      final r = historicalCoverage(trend);
      expect(r.level, CoverageLevel.low);
      expect(r.timeRange?.gapNote, isNotNull);
    });
  });

  group('sourceDiversityCoverage — case 5: provider failure', () {
    test('zero media and zero evidence sources -> unavailable, not 0', () {
      final r = sourceDiversityCoverage(const [], const []);
      expect(r.level, CoverageLevel.unavailable);
      for (final reason in r.reasons) {
        expect(reason, isNot(matches(RegExp(r'\b0\b'))));
      }
    });
  });

  group('coverage vs. popularity', () {
    test('news coverage reasons never mention followers/views/upvotes/trending', () {
      final r = newsCoverage([media(id: '1', source: 'A'), media(id: '2', source: 'B')]);
      for (final reason in r.reasons) {
        expect(reason.toLowerCase(), isNot(contains('follower')));
        expect(reason.toLowerCase(), isNot(contains('upvote')));
        expect(reason.toLowerCase(), isNot(contains('trending')));
      }
    });
  });

  group('buildCoverageReport / summaryDimensions', () {
    Celebrity fullCelebrity() => Celebrity(
      slug: 'jane-doe',
      name: 'Jane Doe',
      wikidataId: 'Q1',
      verified: true,
      biography: const Biography(
        profession: 'Executive',
        summary: 'Jane Doe is an executive.',
        background: '',
        notableWorks: [],
        controversies: [],
      ),
      sentimentData: SentimentData(
        overallScore: 40,
        positiveRatio: 0.2,
        negativeRatio: 0.5,
        neutralRatio: 0.3,
        trendDirection: 'down',
        explanation: '',
        trendData: const [],
        dominantEmotion: 'anger',
        sampleSize: 428,
        confidence: 0.8,
      ),
      mediaItems: [media()],
      fetchedAt: DateTime.utc(2024, 1, 1),
      facts: PersonFacts.empty,
    );

    test('produces every declared dimension exactly once', () {
      final report = buildCoverageReport(celebrity: fullCelebrity(), evidenceItems: const [], claims: const []);
      final keys = report.dimensions.map((d) => d.key).toSet();
      expect(keys.length, report.dimensions.length);
      expect(report.coverageVersion, 'coverage-1');
    });

    test('reddit is not among the produced dimensions (unsupported on mobile)', () {
      final report = buildCoverageReport(celebrity: fullCelebrity(), evidenceItems: const [], claims: const []);
      expect(
        report.dimensions.any((d) => d.label == 'Reddit'),
        isFalse,
      );
    });

    test('summaryDimensions returns only the compact-card subset, in order', () {
      final report = buildCoverageReport(celebrity: fullCelebrity(), evidenceItems: const [], claims: const []);
      final summary = summaryDimensions(report);
      expect(summary.map((d) => d.key).toList(), kSummaryDimensions);
    });
  });
}
