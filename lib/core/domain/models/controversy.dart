/// Domain model for a single documented controversy / criticism episode
/// involving a public figure.
///
/// Controversies are produced by the language model as part of the
/// biography call (`functions/lib/groq.js`), filtered by the
/// corroboration gate so that a severe claim no retrieved article
/// supports is discarded rather than rendered, and shown in the
/// Controversy section of the dashboard. Unlike the earlier flat
/// `List<String>`, each entry is structured so the UI can sort by
/// severity, group by category, and show status at a glance.
library;

import 'package:equatable/equatable.dart';

/// Broad category buckets a controversy can fall into. Kept as a small
/// closed set so the UI can assign consistent colours and icons.
abstract final class ControversyCategory {
  static const legal = 'Legal';
  static const financial = 'Financial';
  static const socialMedia = 'Social media';
  static const personalConduct = 'Personal conduct';
  static const political = 'Political';
  static const professional = 'Professional';
  static const relationships = 'Relationships';
  static const other = 'Other';

  static const all = [
    legal,
    financial,
    socialMedia,
    personalConduct,
    political,
    professional,
    relationships,
    other,
  ];

  /// Normalises an arbitrary model-supplied string to one of [all],
  /// falling back to [other] for anything unrecognised.
  static String normalize(String? raw) {
    if (raw == null) return other;
    final lower = raw.toLowerCase();
    for (final c in all) {
      if (c.toLowerCase() == lower) return c;
    }
    // Loose keyword matching for near-misses.
    if (lower.contains('law') ||
        lower.contains('court') ||
        lower.contains('lawsuit')) {
      return legal;
    }
    if (lower.contains('money') ||
        lower.contains('tax') ||
        lower.contains('fraud')) {
      return financial;
    }
    if (lower.contains('tweet') ||
        lower.contains('post') ||
        lower.contains('online')) {
      return socialMedia;
    }
    if (lower.contains('politic') || lower.contains('election')) {
      return political;
    }
    if (lower.contains('work') ||
        lower.contains('career') ||
        lower.contains('set')) {
      return professional;
    }
    if (lower.contains('relationship') ||
        lower.contains('divorce') ||
        lower.contains('affair')) {
      return relationships;
    }
    return other;
  }
}

/// Lifecycle status of a controversy.
abstract final class ControversyStatus {
  static const ongoing = 'ongoing';
  static const resolved = 'resolved';
  static const historical = 'historical';

  static String normalize(String? raw) {
    final lower = (raw ?? '').toLowerCase();
    if (lower.contains('ongoing') ||
        lower.contains('active') ||
        lower.contains('current')) {
      return ongoing;
    }
    if (lower.contains('resolved') ||
        lower.contains('settled') ||
        lower.contains('over')) {
      return resolved;
    }
    return historical;
  }
}

class Controversy extends Equatable {
  const Controversy({
    required this.title,
    required this.summary,
    required this.category,
    required this.severity,
    required this.status,
    this.year,
    this.sources = const [],
  });

  /// Short headline for the episode (≤ ~10 words).
  final String title;

  /// 1–3 sentence neutral description of what happened.
  final String summary;

  /// One of [ControversyCategory.all].
  final String category;

  /// 1 (minor backlash) … 5 (major scandal with lasting consequences).
  final int severity;

  /// One of [ControversyStatus] values.
  final String status;

  /// Approximate year the episode began, when known.
  final int? year;

  /// Publication names or URLs backing the entry.
  final List<String> sources;

  bool get isOngoing => status == ControversyStatus.ongoing;

  @override
  List<Object?> get props => [title, category, severity, status, year];

  Map<String, dynamic> toMap() => {
    'title': title,
    'summary': summary,
    'category': category,
    'severity': severity,
    'status': status,
    if (year != null) 'year': year,
    'sources': sources,
  };

  factory Controversy.fromMap(Map<String, dynamic> map) {
    return Controversy(
      title:
          (map['title'] as String?)?.trim().isNotEmpty == true
              ? (map['title'] as String).trim()
              : 'Untitled controversy',
      summary: (map['summary'] as String?)?.trim() ?? '',
      category: ControversyCategory.normalize(map['category'] as String?),
      severity: ((map['severity'] as num?)?.toInt() ?? 1).clamp(1, 5),
      status: ControversyStatus.normalize(map['status'] as String?),
      year: (map['year'] as num?)?.toInt(),
      sources:
          (map['sources'] as List<dynamic>?)
              ?.map((e) => e.toString().trim())
              .where((s) => s.isNotEmpty)
              .toList() ??
          const [],
    );
  }
}
