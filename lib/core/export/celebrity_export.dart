/// Serialises a profile so someone can do their own analysis on it.
///
/// Export is part of the product's argument, not a convenience feature: a
/// score you cannot inspect is a score you have to take on trust. Handing
/// over the underlying records — every controversy with its severity and
/// sources, every media item with its URL — is what lets a reader check
/// the conclusion instead of believing it.
///
/// Both formats carry a provenance header naming the app, the fetch time
/// and which figures are algorithmically assessed, so an exported file
/// cannot be mistaken for a primary source once it leaves the app.
library;

import 'dart:convert';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/utils/controversy_index.dart';

abstract final class CelebrityExport {
  /// Pretty-printed JSON of the whole record.
  static String toJson(Celebrity c) {
    final index = computeControversyIndex(c.biography.controversies);

    return const JsonEncoder.withIndent('  ').convert({
      'exportedBy': 'CritiTrack',
      'exportedAt': DateTime.now().toUtc().toIso8601String(),
      'disclaimer':
          'Sentiment scores, controversy severities and the controversy '
          'index are algorithmically assessed from public reporting, not '
          'verified fact. Check the cited sources before relying on them.',
      'figure': {
        'name': c.name,
        'slug': c.slug,
        'wikidataId': c.wikidataId,
        'verified': c.verified,
        'profession': c.biography.profession,
        'dataFetchedAt': c.fetchedAt.toUtc().toIso8601String(),
      },
      'sentiment': {
        'score': c.sentimentData.overallScore,
        'scoreLow': c.sentimentData.scoreLow,
        'scoreHigh': c.sentimentData.scoreHigh,
        'confidence': c.sentimentData.confidence,
        'confidenceLabel': c.sentimentData.confidenceLabel,
        'sampleSize': c.sentimentData.sampleSize,
        'trendDirection': c.sentimentData.trendDirection,
        'dominantEmotion': c.sentimentData.dominantEmotion,
        'positiveRatio': c.sentimentData.positiveRatio,
        'neutralRatio': c.sentimentData.neutralRatio,
        'negativeRatio': c.sentimentData.negativeRatio,
        'evidence':
            c.sentimentData.evidence
                .map((e) => {'fragment': e.fragment, 'source': e.source})
                .toList(),
      },
      'controversyIndex': {
        'score': index.rounded,
        'label': index.label,
        'episodes': index.total,
        'peakSeverity': index.peakSeverity,
        'ongoing': index.ongoingCount,
      },
      'controversies':
          c.biography.controversies
              .map(
                (x) => {
                  'title': x.title,
                  'summary': x.summary,
                  'category': x.category,
                  'severity': x.severity,
                  'status': x.status,
                  'year': x.year,
                  'sources': x.sources,
                },
              )
              .toList(),
      'media':
          c.mediaItems
              .map(
                (m) => {
                  'type': m.type.name,
                  'title': m.title,
                  'url': m.url,
                  'source': m.source,
                  'publishedAt': m.publishedAt?.toUtc().toIso8601String(),
                },
              )
              .toList(),
    });
  }

  /// Controversies as CSV — the table most people actually want to sort
  /// and filter in a spreadsheet.
  static String controversiesCsv(Celebrity c) {
    final rows = <List<String>>[
      ['title', 'category', 'severity', 'status', 'year', 'sources', 'summary'],
      for (final x in c.biography.controversies)
        [
          x.title,
          x.category,
          '${x.severity}',
          x.status,
          x.year?.toString() ?? '',
          x.sources.join('; '),
          x.summary,
        ],
    ];
    return _encodeCsv(rows);
  }

  /// Media coverage as CSV.
  static String mediaCsv(Celebrity c) {
    final rows = <List<String>>[
      ['type', 'title', 'source', 'publishedAt', 'url'],
      for (final m in c.mediaItems)
        [
          m.type.name,
          m.title,
          m.source ?? '',
          m.publishedAt?.toUtc().toIso8601String() ?? '',
          m.url,
        ],
    ];
    return _encodeCsv(rows);
  }

  /// A filename-safe stem, e.g. `crititrack-zendaya-2026-08-28`.
  static String fileStem(Celebrity c) {
    final date = DateTime.now().toUtc().toIso8601String().substring(0, 10);
    final slug = c.slug.isEmpty ? 'figure' : c.slug;
    return 'crititrack-$slug-$date';
  }

  /// RFC 4180 encoding.
  ///
  /// A field is quoted whenever it contains a comma, a quote, or any line
  /// break, and embedded quotes are doubled. Controversy summaries are
  /// free text written by a model, so they routinely contain commas and
  /// quotation marks — getting this wrong silently corrupts every row
  /// after the first bad one.
  static String _encodeCsv(List<List<String>> rows) {
    final buffer = StringBuffer();
    for (final row in rows) {
      buffer.writeln(row.map(_encodeField).join(','));
    }
    return buffer.toString();
  }

  static String _encodeField(String value) {
    // Normalise line breaks so a CR alone cannot split a record.
    final v = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
    final needsQuotes = v.contains(',') || v.contains('"') || v.contains('\n');
    if (!needsQuotes) return v;
    return '"${v.replaceAll('"', '""')}"';
  }
}
