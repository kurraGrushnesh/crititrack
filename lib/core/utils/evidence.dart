/// The Evidence & Source Explorer — a normalised view over the sources
/// CritiTrack already retrieved for a profile: the deduped media feed,
/// the sourced controversy records, and the career record's Wikidata
/// citations. This is the Dart twin of `site/lib/evidence.ts`; nothing
/// here is fetched separately, and every field is derived from
/// [Celebrity] the app already holds.
///
/// "Evidence" means exactly what the retrieved record supports — that a
/// claim was reported, by whom, and how independently. It is never a
/// verdict on whether the claim is true, and is kept apart from
/// sentiment (tone of coverage) and from popularity (how much coverage
/// there was): a widely-syndicated, unanimous, negative story is still
/// one independent source saying one thing, not ten.
library;

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/domain/models/media_item.dart';
import 'package:crititrack/core/domain/models/person_facts.dart';
import 'package:crititrack/core/domain/models/sentiment_data.dart';

enum SourceType {
  news,
  government,
  wikidata,
  wikipedia,
  youtube,
  reddit,
  archive,
  other,
}

extension SourceTypeLabel on SourceType {
  String get label => switch (this) {
    SourceType.news => 'News',
    SourceType.government => 'Government / Official',
    SourceType.wikidata => 'Wikidata',
    SourceType.wikipedia => 'Wikipedia',
    SourceType.youtube => 'YouTube',
    SourceType.reddit => 'Reddit',
    SourceType.archive => 'Archive',
    SourceType.other => 'Other',
  };
}

enum EvidenceStrength { strong, moderate, limited, conflicting, insufficient }

extension EvidenceStrengthLabel on EvidenceStrength {
  String get label => switch (this) {
    EvidenceStrength.strong => 'Strong',
    EvidenceStrength.moderate => 'Moderate',
    EvidenceStrength.limited => 'Limited',
    EvidenceStrength.conflicting => 'Conflicting',
    EvidenceStrength.insufficient => 'Insufficient',
  };
}

/// The record type an evidence item primarily supports.
enum EvidenceCategory { controversy, career, news }

class EvidenceItem {
  const EvidenceItem({
    required this.evidenceId,
    required this.sourceUrl,
    required this.sourceName,
    required this.sourceType,
    required this.title,
    required this.publicationDate,
    required this.snippet,
    required this.category,
    required this.relatedControversies,
    required this.relatedToSentiment,
    required this.duplicateCount,
    required this.independentSourceCount,
    required this.evidenceStrength,
    required this.strengthReason,
    this.sentimentTag,
  });

  final String evidenceId;
  final String? sourceUrl;
  final String sourceName;
  final SourceType sourceType;
  final String title;
  final String? publicationDate;
  final String? snippet;
  final EvidenceCategory category;
  final List<String> relatedControversies;
  final bool relatedToSentiment;
  final int? duplicateCount;
  final int? independentSourceCount;
  final EvidenceStrength evidenceStrength;
  final String strengthReason;

  /// News items only — kept just long enough to detect disagreement
  /// across sources covering the same controversy.
  final String? sentimentTag;

  EvidenceItem copyWith({
    EvidenceStrength? evidenceStrength,
    String? strengthReason,
  }) => EvidenceItem(
    evidenceId: evidenceId,
    sourceUrl: sourceUrl,
    sourceName: sourceName,
    sourceType: sourceType,
    title: title,
    publicationDate: publicationDate,
    snippet: snippet,
    category: category,
    relatedControversies: relatedControversies,
    relatedToSentiment: relatedToSentiment,
    duplicateCount: duplicateCount,
    independentSourceCount: independentSourceCount,
    evidenceStrength: evidenceStrength ?? this.evidenceStrength,
    strengthReason: strengthReason ?? this.strengthReason,
    sentimentTag: sentimentTag,
  );
}

// ── Source type ──────────────────────────────────────────────────────

final RegExp _govHost = RegExp(
  r'\.(gov|mil)(\.[a-z]{2})?$',
  caseSensitive: false,
);

SourceType sourceTypeFor({String? url, MediaType? mediaType}) {
  final host = (url != null ? Uri.tryParse(url)?.host : null) ?? '';
  if (host.isNotEmpty && _govHost.hasMatch(host)) return SourceType.government;
  if (host.contains('wikidata.org')) return SourceType.wikidata;
  if (host.contains('wikipedia.org')) return SourceType.wikipedia;
  if (host.contains('web.archive.org')) return SourceType.archive;
  if (mediaType == MediaType.youtube) return SourceType.youtube;
  if (mediaType == null && host.isNotEmpty) return SourceType.news;
  return SourceType.other;
}

// ── Topic overlap (for linking a media item to a controversy) ─────────

const _stopwords = {
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'is',
  'was',
  'were',
  'be',
  'been',
  'with',
  'by',
  'from',
  'as',
  'his',
  'her',
  'their',
  'its',
  'it',
  'that',
  'this',
  'after',
  'over',
};

Set<String> _significantWords(String text) {
  final cleaned = text.toLowerCase().replaceAll(
    RegExp(r'[^\p{L}\p{N}\s]', unicode: true),
    ' ',
  );
  return cleaned
      .split(RegExp(r'\s+'))
      .where((w) => w.length > 3 && !_stopwords.contains(w))
      .toSet();
}

/// Conservative: only true when the two texts share real, specific
/// words — never a guess dressed up as a relationship.
bool _sharesTopic(String a, String b) {
  final wa = _significantWords(a);
  final wb = _significantWords(b);
  if (wa.isEmpty || wb.isEmpty) return false;
  final shared = wa.where(wb.contains).length;
  final minSize = wa.length < wb.length ? wa.length : wb.length;
  return shared / minSize >= 0.5;
}

// ── Builders ─────────────────────────────────────────────────────────

(EvidenceStrength, String) _newsStrength(MediaItem m) {
  final independent = m.independentSourceCount ?? 1;
  if (independent >= 3) {
    return (
      EvidenceStrength.strong,
      '$independent independent publishers reported it',
    );
  }
  if (independent == 2) {
    return (EvidenceStrength.moderate, '2 independent publishers reported it');
  }
  return (
    EvidenceStrength.limited,
    'reported by a single publisher found so far',
  );
}

List<EvidenceItem> _mediaEvidence(
  List<MediaItem> media,
  List<Controversy> controversies,
  List<SentimentEvidence> sentimentEvidence,
) {
  final linkedIds =
      sentimentEvidence.map((e) => e.mediaId).whereType<String>().toSet();

  return media.map((m) {
    final related =
        controversies
            .where((c) => _sharesTopic(c.title, m.title))
            .map((c) => c.title)
            .toList();
    final (strength, reason) = _newsStrength(m);
    return EvidenceItem(
      evidenceId: 'media-${m.id}',
      sourceUrl: Uri.tryParse(m.url) != null ? m.url : null,
      sourceName: m.source ?? Uri.tryParse(m.url)?.host ?? m.title,
      sourceType: sourceTypeFor(url: m.url, mediaType: m.type),
      title: m.title,
      publicationDate: m.publishedAt?.toIso8601String().split('T').first,
      snippet: m.description,
      category:
          related.isNotEmpty
              ? EvidenceCategory.controversy
              : EvidenceCategory.news,
      relatedControversies: related,
      relatedToSentiment: linkedIds.contains(m.id),
      duplicateCount: m.duplicateCount ?? 1,
      independentSourceCount: m.independentSourceCount ?? 1,
      evidenceStrength: strength,
      strengthReason: reason,
      sentimentTag: m.sentimentTag,
    );
  }).toList();
}

/// A controversy's own cited sources that are not already represented
/// by a media item at the same URL (so a source is never listed twice).
List<EvidenceItem> _controversyEvidence(
  List<Controversy> controversies,
  List<MediaItem> media,
) {
  final mediaUrls = media.map((m) => m.url).toSet();
  final out = <EvidenceItem>[];
  for (final c in controversies) {
    for (var i = 0; i < c.sources.length; i++) {
      final raw = c.sources[i];
      if (mediaUrls.contains(raw)) continue;
      final uri = Uri.tryParse(raw);
      final isLink =
          uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
      out.add(
        EvidenceItem(
          evidenceId: 'controversy-${c.title}-$i',
          sourceUrl: isLink ? raw : null,
          sourceName:
              isLink ? uri.host.replaceFirst(RegExp(r'^www\.'), '') : raw,
          sourceType: isLink ? sourceTypeFor(url: raw) : SourceType.other,
          title: c.title,
          publicationDate: c.year?.toString(),
          snippet: c.summary.isNotEmpty ? c.summary : null,
          category: EvidenceCategory.controversy,
          relatedControversies: [c.title],
          relatedToSentiment: false,
          duplicateCount: null,
          independentSourceCount: null,
          evidenceStrength:
              isLink ? EvidenceStrength.moderate : EvidenceStrength.limited,
          strengthReason:
              isLink
                  ? 'cited source for this controversy record'
                  : 'named source, no direct link on file',
        ),
      );
    }
  }
  return out;
}

List<EvidenceItem> _careerEvidence(List<CareerEntry> entries) {
  final out = <EvidenceItem>[];
  for (var i = 0; i < entries.length; i++) {
    final e = entries[i];
    if (e.sourceUrl == null) continue;
    out.add(
      EvidenceItem(
        evidenceId: 'career-$i-${e.start ?? "u"}',
        sourceUrl: e.sourceUrl,
        sourceName: e.sourceName,
        sourceType: sourceTypeFor(url: e.sourceUrl),
        title:
            [e.role, e.organization].whereType<String>().join(', ').isNotEmpty
                ? [e.role, e.organization].whereType<String>().join(', ')
                : 'Career record',
        publicationDate: e.start?.toString(),
        snippet: null,
        category: EvidenceCategory.career,
        relatedControversies: const [],
        relatedToSentiment: false,
        duplicateCount: null,
        independentSourceCount: null,
        evidenceStrength: EvidenceStrength.moderate,
        strengthReason: 'structured Wikidata claim, not a news report',
      ),
    );
  }
  return out;
}

/// Marks a news item's evidence as "conflicting" when the controversy it
/// relates to has other linked sources tagged with the opposite
/// sentiment — a real, observable signal, never an assertion about
/// which side is right.
List<EvidenceItem> _flagConflicts(List<EvidenceItem> items) {
  final byControversy = <String, List<EvidenceItem>>{};
  for (final e in items) {
    for (final title in e.relatedControversies) {
      (byControversy[title] ??= []).add(e);
    }
  }

  final conflicted = <String>{};
  byControversy.forEach((title, list) {
    final tags = list.map((e) => e.sentimentTag).whereType<String>().toSet();
    if (tags.contains('positive') && tags.contains('negative')) {
      conflicted.add(title);
    }
  });
  if (conflicted.isEmpty) return items;

  return items.map((e) {
    final isConflicted = e.relatedControversies.any(conflicted.contains);
    if (!isConflicted || e.sentimentTag == null) return e;
    return e.copyWith(
      evidenceStrength: EvidenceStrength.conflicting,
      strengthReason:
          'coverage of this episode is not unanimous — see the other linked sources',
    );
  }).toList();
}

/// The controversy titles [_flagConflicts] found split coverage for.
List<String> conflictingControversies(List<EvidenceItem> items) {
  final byControversy = <String, Set<String>>{};
  for (final e in items) {
    for (final title in e.relatedControversies) {
      final tags = byControversy[title] ??= {};
      if (e.sentimentTag != null) tags.add(e.sentimentTag!);
    }
  }
  return byControversy.entries
      .where(
        (e) => e.value.contains('positive') && e.value.contains('negative'),
      )
      .map((e) => e.key)
      .toList();
}

/// Evidence items for one controversy, by title. Empty means exactly
/// that — no supporting source was retrieved for it — never padded.
List<EvidenceItem> evidenceForControversy(
  List<EvidenceItem> items,
  String title,
) => items.where((e) => e.relatedControversies.contains(title)).toList();

/// The unified, deduplicated evidence list for a profile. Every item
/// traces to something already retrieved — no separate fetch, no new
/// collection.
List<EvidenceItem> buildEvidenceItems({
  required List<MediaItem> media,
  required List<Controversy> controversies,
  required List<CareerEntry> career,
  required List<SentimentEvidence> sentimentEvidence,
}) {
  final news = _mediaEvidence(media, controversies, sentimentEvidence);
  return [
    ..._flagConflicts(news),
    ..._controversyEvidence(controversies, media),
    ..._careerEvidence(career),
  ];
}
