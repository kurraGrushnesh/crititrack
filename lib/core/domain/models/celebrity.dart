/// Domain model representing a celebrity's complete profile data.
///
/// This is the primary entity hydrated from either Firestore cache
/// or fresh API responses. It aggregates biography, sentiment, and
/// media data into a single immutable structure that the dashboard
/// screen renders.
library;

import 'package:equatable/equatable.dart';

import 'controversy.dart';
import 'media_item.dart';
import 'sentiment_data.dart';

class Celebrity extends Equatable {
  const Celebrity({
    required this.slug,
    required this.name,
    required this.biography,
    required this.sentimentData,
    required this.mediaItems,
    required this.fetchedAt,
    this.cacheVersion = 1,
  });

  /// Firestore document ID — URL-safe lowercase slug.
  final String slug;

  /// Display name as returned by OpenAI.
  final String name;

  /// Structured biography data.
  final Biography biography;

  /// Aggregated sentiment analysis results.
  final SentimentData sentimentData;

  /// Combined list of news, YouTube, and Instagram items.
  final List<MediaItem> mediaItems;

  /// When this data was last fetched from external APIs.
  final DateTime fetchedAt;

  /// Schema version for cache migration.
  final int cacheVersion;

  /// Whether the cached data is still within the 24-hour TTL.
  bool get isFresh => DateTime.now().difference(fetchedAt).inHours < 24;

  @override
  List<Object?> get props => [slug, name, fetchedAt, cacheVersion];

  /// Creates a copy with optional field overrides.
  Celebrity copyWith({
    String? slug,
    String? name,
    Biography? biography,
    SentimentData? sentimentData,
    List<MediaItem>? mediaItems,
    DateTime? fetchedAt,
    int? cacheVersion,
  }) {
    return Celebrity(
      slug: slug ?? this.slug,
      name: name ?? this.name,
      biography: biography ?? this.biography,
      sentimentData: sentimentData ?? this.sentimentData,
      mediaItems: mediaItems ?? this.mediaItems,
      fetchedAt: fetchedAt ?? this.fetchedAt,
      cacheVersion: cacheVersion ?? this.cacheVersion,
    );
  }

  /// Serializes to a Firestore-compatible map.
  Map<String, dynamic> toFirestore() {
    return {
      'name': name,
      'biography': biography.toMap(),
      'sentimentScore': sentimentData.overallScore,
      'positiveRatio': sentimentData.positiveRatio,
      'negativeRatio': sentimentData.negativeRatio,
      'neutralRatio': sentimentData.neutralRatio,
      'trendDirection': sentimentData.trendDirection,
      'sentimentExplanation': sentimentData.explanation,
      'fetchedAt': fetchedAt.toIso8601String(),
      'cacheVersion': cacheVersion,
      // Phase 2: Evidence fragments
      'evidence': sentimentData.evidence.map((e) => e.toMap()).toList(),
      // Phase 4: Forecast
      'forecast': sentimentData.forecast,
      // Phase 5: Per-source scores
      if (sentimentData.scoreNews != null) 'scoreNews': sentimentData.scoreNews,
      if (sentimentData.scoreYoutube != null)
        'scoreYoutube': sentimentData.scoreYoutube,
      if (sentimentData.scoreInstagram != null)
        'scoreInstagram': sentimentData.scoreInstagram,
    };
  }

  /// Deserializes from a Firestore document map.
  factory Celebrity.fromFirestore(
    String slug,
    Map<String, dynamic> data, {
    List<MediaItem> mediaItems = const [],
    List<SentimentSnapshot> sentimentSnapshots = const [],
  }) {
    return Celebrity(
      slug: slug,
      name: data['name'] as String? ?? '',
      biography: Biography.fromMap(
        data['biography'] as Map<String, dynamic>? ?? {},
      ),
      sentimentData: SentimentData(
        overallScore: (data['sentimentScore'] as num?)?.toDouble() ?? 50.0,
        positiveRatio: (data['positiveRatio'] as num?)?.toDouble() ?? 0.33,
        negativeRatio: (data['negativeRatio'] as num?)?.toDouble() ?? 0.33,
        neutralRatio: (data['neutralRatio'] as num?)?.toDouble() ?? 0.34,
        trendDirection: data['trendDirection'] as String? ?? 'stable',
        explanation: data['sentimentExplanation'] as String? ?? '',
        trendData: sentimentSnapshots,
        dominantEmotion: data['dominantEmotion'] as String? ?? 'neutral',
        // Phase 2: Evidence
        evidence:
            (data['evidence'] as List<dynamic>?)
                ?.map(
                  (e) => SentimentEvidence.fromMap(e as Map<String, dynamic>),
                )
                .toList() ??
            [],
        // Phase 4: Forecast
        forecast:
            (data['forecast'] as List<dynamic>?)
                ?.map((e) => (e as num).toDouble())
                .toList() ??
            [],
        // Phase 5: Per-source scores
        scoreNews: (data['scoreNews'] as num?)?.toDouble(),
        scoreYoutube: (data['scoreYoutube'] as num?)?.toDouble(),
        scoreInstagram: (data['scoreInstagram'] as num?)?.toDouble(),
      ),
      mediaItems: mediaItems,
      fetchedAt:
          DateTime.tryParse(data['fetchedAt'] as String? ?? '') ??
          DateTime.now(),
      cacheVersion: data['cacheVersion'] as int? ?? 1,
    );
  }
}

/// Structured biography returned by OpenAI.
class Biography extends Equatable {
  const Biography({
    required this.profession,
    required this.summary,
    required this.background,
    required this.notableWorks,
    required this.controversies,
  });

  final String profession;
  final String summary;
  final String background;
  final List<String> notableWorks;

  /// Structured controversy / criticism episodes. May be empty.
  final List<Controversy> controversies;

  @override
  List<Object?> get props => [profession, summary];

  Map<String, dynamic> toMap() => {
    'profession': profession,
    'summary': summary,
    'background': background,
    'notableWorks': notableWorks,
    'controversies': controversies.map((c) => c.toMap()).toList(),
  };

  factory Biography.fromMap(Map<String, dynamic> map) {
    return Biography(
      profession: map['profession'] as String? ?? '',
      summary: map['summary'] as String? ?? '',
      background: map['background'] as String? ?? '',
      notableWorks: List<String>.from(map['notableWorks'] ?? []),
      controversies: _parseControversies(map['controversies']),
    );
  }

  /// Tolerant parser: accepts the new list-of-objects shape, and also
  /// the legacy list-of-strings shape from older cache documents.
  static List<Controversy> _parseControversies(dynamic raw) {
    if (raw is! List) return const [];
    return raw
        .map<Controversy?>((e) {
          if (e is Map<String, dynamic>) return Controversy.fromMap(e);
          if (e is Map) {
            return Controversy.fromMap(Map<String, dynamic>.from(e));
          }
          if (e is String && e.trim().isNotEmpty) {
            return Controversy(
              title: e.trim(),
              summary: e.trim(),
              category: ControversyCategory.other,
              severity: 2,
              status: ControversyStatus.historical,
            );
          }
          return null;
        })
        .whereType<Controversy>()
        .toList();
  }
}
