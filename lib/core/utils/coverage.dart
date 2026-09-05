/// The Data Coverage & Confidence Center — the Dart twin of
/// `site/lib/coverage.ts`. Answers "how much usable data do we actually
/// have about this person", one intelligence dimension at a time, from
/// data the app already holds — no new fetch, no combined truth score.
///
/// The Flutter data model is thinner than the web's in a few places, so
/// three web dimensions are intentionally not ported here rather than
/// faked: Attention (Wikipedia pageviews are not fetched on mobile), a
/// taxonomy-resolved Professional Identity (mobile only has the raw
/// `occupations` string list, not the resolved occupation graph), and
/// Reddit (mobile's media pipeline only ingests news/YouTube/Instagram —
/// there is no Reddit ingestion to report coverage for). All three are
/// documented limitations, not silent gaps.
library;

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/utils/claims.dart';
import 'package:crititrack/core/utils/evidence.dart';

const String kCoverageVersion = 'coverage-1';

enum CoverageLevel { high, medium, low, insufficient, unavailable }

extension CoverageLevelLabel on CoverageLevel {
  String get label => switch (this) {
    CoverageLevel.high => 'High',
    CoverageLevel.medium => 'Medium',
    CoverageLevel.low => 'Low',
    CoverageLevel.insufficient => 'Insufficient',
    CoverageLevel.unavailable => 'Unavailable',
  };
}

enum DataStatus { available, limited, insufficient, conflicting, unavailable, notApplicable }

extension DataStatusLabel on DataStatus {
  String get label => switch (this) {
    DataStatus.available => 'Available',
    DataStatus.limited => 'Limited',
    DataStatus.insufficient => 'Insufficient',
    DataStatus.conflicting => 'Conflicting',
    DataStatus.unavailable => 'Unavailable',
    DataStatus.notApplicable => 'Not applicable',
  };
}

enum CoverageDimensionKey {
  identity,
  professional,
  career,
  news,
  evidence,
  claims,
  controversies,
  sentiment,
  youtube,
  wikipedia,
  historical,
  sourceDiversity,
}

extension CoverageDimensionKeyLabel on CoverageDimensionKey {
  String get label => switch (this) {
    CoverageDimensionKey.identity => 'Entity Identity',
    CoverageDimensionKey.professional => 'Professional Identity',
    CoverageDimensionKey.career => 'Career',
    CoverageDimensionKey.news => 'News',
    CoverageDimensionKey.evidence => 'Evidence',
    CoverageDimensionKey.claims => 'Claims',
    CoverageDimensionKey.controversies => 'Controversies',
    CoverageDimensionKey.sentiment => 'Sentiment',
    CoverageDimensionKey.youtube => 'YouTube',
    CoverageDimensionKey.wikipedia => 'Wikipedia',
    CoverageDimensionKey.historical => 'Historical Data',
    CoverageDimensionKey.sourceDiversity => 'Source Diversity',
  };
}

class CoverageTimeRange {
  const CoverageTimeRange({this.earliest, this.latest, this.gapNote});
  final String? earliest;
  final String? latest;
  final String? gapNote;
}

class CoverageDimension {
  const CoverageDimension({
    required this.key,
    required this.level,
    required this.status,
    required this.reasons,
    this.timeRange,
  });

  final CoverageDimensionKey key;
  final CoverageLevel level;
  final DataStatus status;
  final List<String> reasons;
  final CoverageTimeRange? timeRange;

  String get label => key.label;
}

class CoverageReport {
  const CoverageReport({required this.dimensions, required this.coverageVersion});
  final List<CoverageDimension> dimensions;
  final String coverageVersion;
}

CoverageDimension _dim(
  CoverageDimensionKey key,
  CoverageLevel level,
  DataStatus status,
  List<String> reasons, [
  CoverageTimeRange? timeRange,
]) => CoverageDimension(key: key, level: level, status: status, reasons: reasons, timeRange: timeRange);

CoverageTimeRange? _dateSpan(Iterable<String?> dates) {
  final sorted = dates.whereType<String>().toList()..sort();
  if (sorted.isEmpty) return null;
  return CoverageTimeRange(earliest: sorted.first, latest: sorted.last);
}

String? _largestGap(List<String> dates, int maxDays) {
  final sorted = {...dates}.toList()..sort();
  var worstSpan = 0.0;
  var worstStart = '';
  var worstEnd = '';
  for (var i = 1; i < sorted.length; i++) {
    final a = DateTime.tryParse(sorted[i - 1]);
    final b = DateTime.tryParse(sorted[i]);
    if (a == null || b == null) continue;
    final days = b.difference(a).inHours / 24;
    if (days > worstSpan) {
      worstSpan = days;
      worstStart = sorted[i - 1];
      worstEnd = sorted[i];
    }
  }
  if (worstSpan <= maxDays) return null;
  return '$worstStart to $worstEnd';
}

// ── Identity ─────────────────────────────────────────────────────────
//
// Mobile has no resolution-confidence band field — only whether a
// Wikidata entity was found and whether Wikidata confirms the subject
// is a documented human. That is a real, weaker signal than the web's
// banded resolution, so this reads at most "high", never claims more
// precision than the data supports.

CoverageDimension identityCoverage(String? wikidataId, bool verified) {
  if (wikidataId == null) {
    return _dim(CoverageDimensionKey.identity, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No Wikidata entity was resolved for this name.',
    ]);
  }
  final reasons = ['Stable entity ID ($wikidataId)', verified ? 'Confirmed as a documented person' : 'Not confirmed as a documented person'];
  if (verified) {
    return _dim(CoverageDimensionKey.identity, CoverageLevel.high, DataStatus.available, reasons);
  }
  return _dim(CoverageDimensionKey.identity, CoverageLevel.medium, DataStatus.limited, reasons);
}

// ── Professional identity (raw occupation list, no taxonomy on mobile) ─

CoverageDimension professionalCoverage(List<String> occupations) {
  if (occupations.isEmpty) {
    return _dim(CoverageDimensionKey.professional, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No occupation data found on the resolved entity.',
    ]);
  }
  final n = occupations.length;
  final reasons = ['$n occupation${n == 1 ? "" : "s"} recorded'];
  final level = n >= 2 ? CoverageLevel.high : CoverageLevel.medium;
  return _dim(CoverageDimensionKey.professional, level, DataStatus.available, reasons);
}

// ── Career ───────────────────────────────────────────────────────────

CoverageDimension careerCoverage(List<CareerEntry> timeline) {
  final n = timeline.length;
  if (n == 0) {
    return _dim(CoverageDimensionKey.career, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No sourced career records found.',
    ]);
  }
  final sourced = timeline.where((e) => e.sourceUrl != null).length;
  final years = [
    for (final e in timeline) ...[if (e.start != null) e.start!, if (e.end != null) e.end!],
  ];
  final span = years.isEmpty
      ? null
      : CoverageTimeRange(
          earliest: '${years.reduce((a, b) => a < b ? a : b)}',
          latest: '${years.reduce((a, b) => a > b ? a : b)}',
        );
  final reasons = ['$n sourced career record${n == 1 ? "" : "s"}'];
  if (span != null) reasons.add('Coverage: ${span.earliest}–${span.latest}');
  if (sourced < n) reasons.add('${n - sourced} record(s) without a direct source link');

  final level = n >= 6
      ? CoverageLevel.high
      : n >= 3
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final status = sourced == 0
      ? DataStatus.insufficient
      : sourced < n
      ? DataStatus.limited
      : DataStatus.available;
  return _dim(CoverageDimensionKey.career, level, status, reasons, span);
}

// ── News ─────────────────────────────────────────────────────────────

List<MediaItem> _mediaOfType(List<MediaItem> media, MediaType type) =>
    media.where((m) => m.type == type).toList();

CoverageDimension newsCoverage(List<MediaItem> media) {
  final news = _mediaOfType(media, MediaType.news);
  final n = news.length;
  if (n == 0) {
    return _dim(CoverageDimensionKey.news, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No relevant news articles were retrieved.',
    ]);
  }
  final publishers = news.map((m) => m.source).whereType<String>().toSet().length;
  final span = _dateSpan(news.map((m) => m.publishedAt?.toIso8601String().split('T').first));
  final reasons = [
    '$n relevant article${n == 1 ? "" : "s"}',
    '$publishers independent publisher${publishers == 1 ? "" : "s"}',
  ];
  final level = n >= 50 && publishers >= 5
      ? CoverageLevel.high
      : n >= 10 && publishers >= 2
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final status = publishers >= 2 ? DataStatus.available : DataStatus.limited;
  return _dim(CoverageDimensionKey.news, level, status, reasons, span);
}

// ── Evidence ─────────────────────────────────────────────────────────

CoverageDimension evidenceCoverage(List<EvidenceItem> items) {
  final total = items.length;
  if (total == 0) {
    return _dim(CoverageDimensionKey.evidence, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No evidence records were built for this profile.',
    ]);
  }
  final corroborated = items
      .where((e) => e.evidenceStrength == EvidenceStrength.strong || e.evidenceStrength == EvidenceStrength.moderate)
      .length;
  final conflicting = items.any((e) => e.evidenceStrength == EvidenceStrength.conflicting);
  final sourceTypes = items.map((e) => e.sourceType).toSet().length;
  final reasons = [
    '$total evidence record${total == 1 ? "" : "s"}',
    '$sourceTypes source type${sourceTypes == 1 ? "" : "s"} represented',
    '$corroborated well-corroborated',
  ];
  final level = corroborated >= 3
      ? CoverageLevel.high
      : corroborated >= 1
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final status = conflicting
      ? DataStatus.conflicting
      : corroborated > 0
      ? DataStatus.available
      : DataStatus.insufficient;
  return _dim(CoverageDimensionKey.evidence, level, status, reasons);
}

// ── Claims ───────────────────────────────────────────────────────────

CoverageDimension claimsCoverage(List<Claim> claims, int controversyCount) {
  if (controversyCount == 0) {
    return _dim(CoverageDimensionKey.claims, CoverageLevel.unavailable, DataStatus.notApplicable, [
      'No documented controversies exist to derive claims from.',
    ]);
  }
  final total = claims.length;
  final resolved = claims
      .where((c) => c.status == ClaimStatus.supported || c.status == ClaimStatus.resolvedAuthoritative)
      .length;
  final conflicting = claims.where((c) => c.status == ClaimStatus.conflicting).length;
  final reasons = ['$total structured claim${total == 1 ? "" : "s"}', '$resolved supported or resolved'];
  if (conflicting > 0) reasons.add('$conflicting conflicting');
  final level = total == 0
      ? CoverageLevel.unavailable
      : resolved / total >= 0.5
      ? CoverageLevel.high
      : resolved > 0
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final status = conflicting > 0
      ? DataStatus.conflicting
      : total == 0
      ? DataStatus.unavailable
      : DataStatus.available;
  return _dim(CoverageDimensionKey.claims, level, status, reasons);
}

// ── Controversies ────────────────────────────────────────────────────

CoverageDimension controversiesCoverage(List<Controversy> controversies) {
  final n = controversies.length;
  if (n == 0) {
    return _dim(CoverageDimensionKey.controversies, CoverageLevel.insufficient, DataStatus.insufficient, [
      'No supported controversy records are currently available.',
    ]);
  }
  final reasons = ['$n documented, corroborated episode${n == 1 ? "" : "s"}'];
  final level = n >= 3 ? CoverageLevel.high : CoverageLevel.medium;
  return _dim(CoverageDimensionKey.controversies, level, DataStatus.available, reasons);
}

// ── Sentiment ────────────────────────────────────────────────────────

CoverageDimension sentimentCoverage(SentimentData data, List<MediaItem> media) {
  final sampleSize = data.sampleSize;
  if (sampleSize == null || sampleSize == 0) {
    return _dim(CoverageDimensionKey.sentiment, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No sentiment sample was collected.',
    ]);
  }
  final publishers = media
      .where((m) => m.sentimentTag != null)
      .map((m) => m.source)
      .whereType<String>()
      .toSet()
      .length;
  final days = data.trendData.length;
  final confidence = data.confidence;
  final level = confidence == null
      ? CoverageLevel.low
      : confidence >= 0.75
      ? CoverageLevel.high
      : confidence >= 0.5
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final reasons = ['$sampleSize analyzed mention${sampleSize == 1 ? "" : "s"}'];
  if (days > 0) reasons.add('$days-day trend window');
  if (publishers > 0) reasons.add('coverage from $publishers publisher${publishers == 1 ? "" : "s"}');
  reasons.add(confidence != null ? 'method agreement: ${level.label}' : 'method agreement not computed');
  final span = _dateSpan(data.trendData.map((t) => t.date));
  return _dim(
    CoverageDimensionKey.sentiment,
    level,
    level == CoverageLevel.low ? DataStatus.limited : DataStatus.available,
    reasons,
    span,
  );
}

// ── YouTube ──────────────────────────────────────────────────────────
//
// Reddit is not ported: the mobile media pipeline only ingests
// news/YouTube/Instagram (see [MediaType]), so there is no real Reddit
// signal to report coverage for.

CoverageDimension youtubeCoverage(List<MediaItem> media) {
  final items = _mediaOfType(media, MediaType.youtube);
  final n = items.length;
  if (n == 0) {
    return _dim(CoverageDimensionKey.youtube, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No relevant videos were retrieved.',
    ]);
  }
  final distinct = items.map((m) => m.channelTitle ?? m.source).whereType<String>().toSet().length;
  final span = _dateSpan(items.map((m) => m.publishedAt?.toIso8601String().split('T').first));
  final reasons = [
    '$n relevant video${n == 1 ? "" : "s"}',
    '$distinct distinct channel${distinct == 1 ? "" : "s"}',
  ];
  final level = n >= 20 && distinct >= 3
      ? CoverageLevel.high
      : n >= 5
      ? CoverageLevel.medium
      : CoverageLevel.low;
  return _dim(CoverageDimensionKey.youtube, level, DataStatus.available, reasons, span);
}

// ── Wikipedia ────────────────────────────────────────────────────────

CoverageDimension wikipediaCoverage(Biography biography) {
  final hasText = biography.summary.isNotEmpty || biography.background.isNotEmpty;
  if (!hasText) {
    return _dim(CoverageDimensionKey.wikipedia, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No Wikipedia summary was retrieved.',
    ]);
  }
  return _dim(CoverageDimensionKey.wikipedia, CoverageLevel.high, DataStatus.available, [
    'biography extract retrieved',
  ]);
}

// ── Historical data (sentiment snapshot trend) ──────────────────────

CoverageDimension historicalCoverage(List<SentimentSnapshot> trend) {
  final n = trend.length;
  if (n == 0) {
    return _dim(CoverageDimensionKey.historical, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No historical snapshots have been recorded yet.',
    ]);
  }
  final dates = trend.map((t) => t.date).toList();
  final span = _dateSpan(dates);
  final gap = _largestGap(dates, 7);
  final reasons = ['$n historical snapshot${n == 1 ? "" : "s"}'];
  if (span?.earliest != null) reasons.add('Coverage begins: ${span!.earliest}');
  final level = n >= 30
      ? CoverageLevel.high
      : n >= 7
      ? CoverageLevel.medium
      : CoverageLevel.low;
  final status = gap != null
      ? DataStatus.limited
      : n < 7
      ? DataStatus.insufficient
      : DataStatus.available;
  final timeRange = gap != null
      ? CoverageTimeRange(earliest: span?.earliest, latest: span?.latest, gapNote: gap)
      : span;
  return _dim(CoverageDimensionKey.historical, level, status, reasons, timeRange);
}

// ── Source diversity (cross-cutting) ────────────────────────────────

CoverageDimension sourceDiversityCoverage(List<MediaItem> media, List<EvidenceItem> evidenceItems) {
  final mediaSources = media.map((m) => m.source).whereType<String>().toSet();
  final evidenceSources = evidenceItems.map((e) => e.sourceName).toSet();
  final all = {...mediaSources, ...evidenceSources};
  final total = all.length;
  if (total == 0) {
    return _dim(CoverageDimensionKey.sourceDiversity, CoverageLevel.unavailable, DataStatus.unavailable, [
      'No sources were retrieved.',
    ]);
  }
  final reasons = ['$total distinct source${total == 1 ? "" : "s"} contributed data'];
  final level = total >= 10
      ? CoverageLevel.high
      : total >= 4
      ? CoverageLevel.medium
      : CoverageLevel.low;
  return _dim(CoverageDimensionKey.sourceDiversity, level, DataStatus.available, reasons);
}

// ── Report assembly ──────────────────────────────────────────────────

CoverageReport buildCoverageReport({
  required Celebrity celebrity,
  required List<EvidenceItem> evidenceItems,
  required List<Claim> claims,
}) {
  final dimensions = [
    identityCoverage(celebrity.wikidataId, celebrity.verified),
    professionalCoverage(celebrity.facts.occupations),
    careerCoverage(celebrity.facts.career),
    newsCoverage(celebrity.mediaItems),
    evidenceCoverage(evidenceItems),
    claimsCoverage(claims, celebrity.biography.controversies.length),
    controversiesCoverage(celebrity.biography.controversies),
    sentimentCoverage(celebrity.sentimentData, celebrity.mediaItems),
    youtubeCoverage(celebrity.mediaItems),
    wikipediaCoverage(celebrity.biography),
    historicalCoverage(celebrity.sentimentData.trendData),
    sourceDiversityCoverage(celebrity.mediaItems, evidenceItems),
  ];
  return CoverageReport(dimensions: dimensions, coverageVersion: kCoverageVersion);
}

/// The compact card's subset, in display order.
const List<CoverageDimensionKey> kSummaryDimensions = [
  CoverageDimensionKey.identity,
  CoverageDimensionKey.career,
  CoverageDimensionKey.news,
  CoverageDimensionKey.evidence,
  CoverageDimensionKey.sentiment,
  CoverageDimensionKey.youtube,
  CoverageDimensionKey.historical,
];

List<CoverageDimension> summaryDimensions(CoverageReport report) {
  final byKey = {for (final d in report.dimensions) d.key: d};
  return [for (final k in kSummaryDimensions) if (byKey[k] != null) byKey[k]!];
}
