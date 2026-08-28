// Export: RFC 4180 correctness and provenance in the payload.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';
import 'package:crititrack/core/export/celebrity_export.dart';

Celebrity sample({
  List<Controversy> controversies = const [],
  List<MediaItem> media = const [],
}) {
  return Celebrity(
    slug: 'jane-doe',
    name: 'Jane Doe',
    wikidataId: 'Q1',
    verified: true,
    biography: Biography(
      profession: 'Actor',
      summary: 'A performer.',
      background: 'Background.',
      notableWorks: const ['Film A'],
      controversies: controversies,
    ),
    sentimentData: const SentimentData(
      overallScore: 71,
      positiveRatio: 0.5,
      negativeRatio: 0.2,
      neutralRatio: 0.3,
      trendDirection: 'up',
      explanation: 'Coverage skews positive.',
      trendData: [],
      dominantEmotion: 'admiration',
      confidence: 0.62,
      confidenceLabel: 'Moderate confidence',
      scoreLow: 63,
      scoreHigh: 79,
      sampleSize: 12,
    ),
    mediaItems: media,
    fetchedAt: DateTime.utc(2026, 8, 28, 12),
  );
}

const messyControversy = Controversy(
  title: 'Dispute over "creative control", per filings',
  summary: 'A disagreement.\nIt continued, at length, for months.',
  category: ControversyCategory.legal,
  severity: 4,
  status: ControversyStatus.resolved,
  year: 2021,
  sources: ['Variety', 'Reuters'],
);

/// Minimal RFC 4180 reader, so the tests check real parseability rather
/// than just string-matching the writer's own output.
List<List<String>> parseCsv(String input) {
  final rows = <List<String>>[];
  var row = <String>[];
  final field = StringBuffer();
  var inQuotes = false;

  for (var i = 0; i < input.length; i++) {
    final ch = input[i];
    if (inQuotes) {
      if (ch == '"') {
        if (i + 1 < input.length && input[i + 1] == '"') {
          field.write('"');
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field.write(ch);
      }
    } else if (ch == '"') {
      inQuotes = true;
    } else if (ch == ',') {
      row.add(field.toString());
      field.clear();
    } else if (ch == '\n') {
      row.add(field.toString());
      field.clear();
      rows.add(row);
      row = <String>[];
    } else {
      field.write(ch);
    }
  }
  if (field.isNotEmpty || row.isNotEmpty) {
    row.add(field.toString());
    rows.add(row);
  }
  return rows;
}

void main() {
  group('JSON export', () {
    test('is valid JSON and carries provenance', () {
      final decoded =
          jsonDecode(CelebrityExport.toJson(sample())) as Map<String, dynamic>;

      expect(decoded['exportedBy'], 'CritiTrack');
      expect(decoded['exportedAt'], isA<String>());
      expect(
        decoded['disclaimer'],
        contains('algorithmically assessed'),
        reason: 'an exported file must not read as a primary source',
      );
    });

    test('includes the confidence band, not just the score', () {
      final d =
          jsonDecode(CelebrityExport.toJson(sample())) as Map<String, dynamic>;
      final s = d['sentiment'] as Map<String, dynamic>;
      expect(s['score'], 71);
      expect(s['scoreLow'], 63);
      expect(s['scoreHigh'], 79);
      expect(s['confidence'], 0.62);
      expect(s['sampleSize'], 12);
    });

    test('includes the computed controversy index', () {
      final d =
          jsonDecode(
                CelebrityExport.toJson(
                  sample(controversies: const [messyControversy]),
                ),
              )
              as Map<String, dynamic>;
      final idx = d['controversyIndex'] as Map<String, dynamic>;
      expect(idx['episodes'], 1);
      expect(idx['peakSeverity'], 4);
      expect(idx['label'], isA<String>());
    });

    test('carries the resolved entity so a claim can be traced', () {
      final d =
          jsonDecode(CelebrityExport.toJson(sample())) as Map<String, dynamic>;
      final f = d['figure'] as Map<String, dynamic>;
      expect(f['wikidataId'], 'Q1');
      expect(f['verified'], true);
    });
  });

  group('CSV export', () {
    test('quotes commas, quotes and newlines so rows stay parseable', () {
      // Model-written summaries routinely contain all three; getting this
      // wrong silently corrupts every row after the first bad one.
      final csv = CelebrityExport.controversiesCsv(
        sample(controversies: const [messyControversy]),
      );
      final rows = parseCsv(csv);

      expect(rows.length, 2, reason: 'header plus exactly one record');
      expect(rows[1][0], 'Dispute over "creative control", per filings');
      expect(rows[1][6], contains('\n'));
      expect(rows[1][6], contains('at length'));
    });

    test('doubles embedded quotes rather than escaping them', () {
      final csv = CelebrityExport.controversiesCsv(
        sample(controversies: const [messyControversy]),
      );
      expect(csv, contains('""creative control""'));
      expect(csv, isNot(contains(r'\"')));
    });

    test('every row has the same column count as the header', () {
      final csv = CelebrityExport.controversiesCsv(
        sample(
          controversies: const [
            messyControversy,
            Controversy(
              title: 'Plain one',
              summary: 'No punctuation here',
              category: ControversyCategory.other,
              severity: 1,
              status: ControversyStatus.historical,
            ),
          ],
        ),
      );
      final rows = parseCsv(csv);
      final width = rows.first.length;
      for (final r in rows) {
        expect(r.length, width);
      }
    });

    test('an empty year becomes an empty cell, not the word null', () {
      final csv = CelebrityExport.controversiesCsv(
        sample(
          controversies: const [
            Controversy(
              title: 'No year',
              summary: 'x',
              category: ControversyCategory.other,
              severity: 1,
              status: ControversyStatus.historical,
            ),
          ],
        ),
      );
      expect(csv, isNot(contains('null')));
    });

    test('media CSV includes the URL so a claim can be checked', () {
      final csv = CelebrityExport.mediaCsv(
        sample(
          media: [
            MediaItem(
              id: '1',
              type: MediaType.news,
              title: 'A headline, with a comma',
              url: 'https://example.com/a',
              source: 'Example',
              publishedAt: DateTime.utc(2026, 8, 27),
            ),
          ],
        ),
      );
      final rows = parseCsv(csv);
      expect(rows[1][1], 'A headline, with a comma');
      expect(rows[1][4], 'https://example.com/a');
    });

    test('an empty record still emits a usable header', () {
      final rows = parseCsv(CelebrityExport.controversiesCsv(sample()));
      expect(rows.length, 1);
      expect(rows.first.first, 'title');
    });
  });

  test('filename stem is safe and dated', () {
    final stem = CelebrityExport.fileStem(sample());
    expect(stem, startsWith('crititrack-jane-doe-'));
    expect(stem, matches(RegExp(r'^[a-z0-9-]+$')));
  });
}
