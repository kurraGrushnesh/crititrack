/// Domain models for sentiment analysis results.
///
/// [SentimentData] represents the aggregated analysis of retrieved
/// headlines — ratios, trend direction, per-source scores and the
/// explanation paragraph. Scores come from the three-method ensemble in
/// `functions/lib/sentiment/`, not from a single model call, so the
/// spread between methods can be reported as a confidence band.
///
/// [SentimentSnapshot] represents one measured day, stored in the
/// `sentiment_snapshots` Firestore sub-collection. Only days the
/// refresher actually measured are recorded; the series is not
/// backfilled.
///
/// [SentimentEvidence] represents a model-cited fragment explaining
/// what drove the sentiment score (Phase 2).
library;

import 'package:equatable/equatable.dart';

/// A single evidence fragment cited by the model (Phase 2).
class SentimentEvidence extends Equatable {
  const SentimentEvidence({
    required this.fragment,
    required this.source,
    this.mediaId,
  });

  /// Short excerpt (≤ 12 words) the model pointed to.
  final String fragment;

  /// Which data source: "news", "youtube", or "instagram".
  final String source;

  /// The retrieved item this fragment was matched back to.
  ///
  /// Null when no single article was clearly the source. The panel
  /// renders those fragments as plain text rather than as something
  /// tappable, because a link that lands on the wrong article is
  /// worse than no link: it attributes a quote to coverage that
  /// never carried it, under that outlet's name.
  final String? mediaId;

  @override
  List<Object?> get props => [fragment, source, mediaId];

  Map<String, dynamic> toMap() => {
    'fragment': fragment,
    'source': source,
    'mediaId': mediaId,
  };

  factory SentimentEvidence.fromMap(Map<String, dynamic> map) {
    return SentimentEvidence(
      fragment: map['fragment'] as String? ?? '',
      mediaId: map['mediaId'] as String?,
      source: map['source'] as String? ?? 'news',
    );
  }
}

/// Aggregated sentiment analysis for a celebrity.
class SentimentData extends Equatable {
  const SentimentData({
    required this.overallScore,
    required this.positiveRatio,
    required this.negativeRatio,
    required this.neutralRatio,
    required this.trendDirection,
    required this.explanation,
    required this.trendData,
    required this.dominantEmotion,
    this.evidence = const [],
    this.forecast = const [],
    this.scoreNews,
    this.scoreYoutube,
    this.scoreInstagram,
    this.confidence,
    this.confidenceLabel,
    this.scoreLow,
    this.scoreHigh,
    this.sampleSize,
  });

  /// Overall sentiment score on a 0–100 scale.
  /// Computed as: positiveRatio × 100, adjusted by trend.
  final double overallScore;

  /// Proportion of positive headlines (0.0–1.0).
  final double positiveRatio;

  /// Proportion of negative headlines (0.0–1.0).
  final double negativeRatio;

  /// Proportion of neutral headlines (0.0–1.0).
  final double neutralRatio;

  /// Trend direction: "up", "down", or "stable".
  final String trendDirection;

  /// Model-written 2–3 paragraph explanation of why sentiment is
  /// trending this way. Prose, not evidence — the numbers beside it are
  /// computed, and the screen distinguishes the two.
  final String explanation;

  /// 7-day trend data for the line chart.
  final List<SentimentSnapshot> trendData;

  /// Dominant emotional tone: "joy", "anger", "surprise", etc.
  final String dominantEmotion;

  /// Evidence fragments the model cited (Phase 2).
  final List<SentimentEvidence> evidence;

  /// Forecasted scores for the next h days (Phase 4).
  final List<double> forecast;

  /// Ensemble agreement, 0-1 (Phase 3). Null when only one method ran.
  ///
  /// Derived from how closely the scoring methods landed on each item, how
  /// much coverage there was, and how many methods were available. A score
  /// without this is an assertion; a score with it is a measurement.
  final double? confidence;

  /// Plain-language reading of [confidence], supplied by the backend.
  final String? confidenceLabel;

  /// Lower and upper bounds of the confidence band, 0-100.
  final double? scoreLow;
  final double? scoreHigh;

  /// How many media items the score was computed from.
  final int? sampleSize;

  /// Whether there is enough information to draw a band at all.
  bool get hasConfidence =>
      confidence != null && scoreLow != null && scoreHigh != null;

  /// Per-source sentiment scores (Phase 5). Null when unavailable.
  final double? scoreNews;
  final double? scoreYoutube;
  final double? scoreInstagram;

  @override
  List<Object?> get props => [
    overallScore,
    positiveRatio,
    negativeRatio,
    neutralRatio,
    trendDirection,
  ];

  Map<String, dynamic> toMap() => {
    'overallScore': overallScore,
    'positiveRatio': positiveRatio,
    'negativeRatio': negativeRatio,
    'neutralRatio': neutralRatio,
    'trendDirection': trendDirection,
    'explanation': explanation,
    'dominantEmotion': dominantEmotion,
    'trendData': trendData.map((s) => s.toFirestore()).toList(),
    'evidence': evidence.map((e) => e.toMap()).toList(),
    'forecast': forecast,
    if (scoreNews != null) 'scoreNews': scoreNews,
    if (scoreYoutube != null) 'scoreYoutube': scoreYoutube,
    if (scoreInstagram != null) 'scoreInstagram': scoreInstagram,
  };

  factory SentimentData.fromMap(Map<String, dynamic> map) {
    return SentimentData(
      overallScore: (map['overallScore'] as num?)?.toDouble() ?? 50.0,
      positiveRatio: (map['positiveRatio'] as num?)?.toDouble() ?? 0.33,
      negativeRatio: (map['negativeRatio'] as num?)?.toDouble() ?? 0.33,
      neutralRatio: (map['neutralRatio'] as num?)?.toDouble() ?? 0.34,
      trendDirection: map['trendDirection'] as String? ?? 'stable',
      explanation: map['explanation'] as String? ?? '',
      dominantEmotion: map['dominantEmotion'] as String? ?? 'neutral',
      trendData:
          (map['trendData'] as List<dynamic>?)
              ?.map(
                (e) =>
                    SentimentSnapshot.fromFirestore(e as Map<String, dynamic>),
              )
              .toList() ??
          [],
      evidence:
          (map['evidence'] as List<dynamic>?)
              ?.map((e) => SentimentEvidence.fromMap(e as Map<String, dynamic>))
              .toList() ??
          [],
      forecast:
          (map['forecast'] as List<dynamic>?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          [],
      scoreNews: (map['scoreNews'] as num?)?.toDouble(),
      scoreYoutube: (map['scoreYoutube'] as num?)?.toDouble(),
      scoreInstagram: (map['scoreInstagram'] as num?)?.toDouble(),
    );
  }

  /// Creates a copy with optional field overrides.
  SentimentData copyWith({
    double? overallScore,
    double? positiveRatio,
    double? negativeRatio,
    double? neutralRatio,
    String? trendDirection,
    String? explanation,
    List<SentimentSnapshot>? trendData,
    String? dominantEmotion,
    List<SentimentEvidence>? evidence,
    List<double>? forecast,
    double? scoreNews,
    double? scoreYoutube,
    double? scoreInstagram,
    double? confidence,
    String? confidenceLabel,
    double? scoreLow,
    double? scoreHigh,
    int? sampleSize,
  }) {
    return SentimentData(
      overallScore: overallScore ?? this.overallScore,
      positiveRatio: positiveRatio ?? this.positiveRatio,
      negativeRatio: negativeRatio ?? this.negativeRatio,
      neutralRatio: neutralRatio ?? this.neutralRatio,
      trendDirection: trendDirection ?? this.trendDirection,
      explanation: explanation ?? this.explanation,
      trendData: trendData ?? this.trendData,
      dominantEmotion: dominantEmotion ?? this.dominantEmotion,
      evidence: evidence ?? this.evidence,
      forecast: forecast ?? this.forecast,
      scoreNews: scoreNews ?? this.scoreNews,
      scoreYoutube: scoreYoutube ?? this.scoreYoutube,
      scoreInstagram: scoreInstagram ?? this.scoreInstagram,
      confidence: confidence ?? this.confidence,
      confidenceLabel: confidenceLabel ?? this.confidenceLabel,
      scoreLow: scoreLow ?? this.scoreLow,
      scoreHigh: scoreHigh ?? this.scoreHigh,
      sampleSize: sampleSize ?? this.sampleSize,
    );
  }
}

/// A single day's sentiment snapshot for trend charting.
///
/// Stored in `celebrities/{slug}/sentiment_snapshots/{date}`.
class SentimentSnapshot extends Equatable {
  const SentimentSnapshot({
    required this.date,
    required this.positiveCount,
    required this.negativeCount,
    required this.neutralCount,
    required this.totalMentions,
    required this.dominantEmotion,
    required this.score,
    this.rollingMu,
    this.rollingSigma,
    this.zScore,
    this.isSpike = false,
  });

  /// The date this snapshot represents (YYYY-MM-DD or day label).
  final String date;

  final int positiveCount;
  final int negativeCount;
  final int neutralCount;
  final int totalMentions;
  final String dominantEmotion;

  /// Sentiment score for this day (0–100).
  final double score;

  // ── Anomaly Detection Fields (Phase 1) ─────────────────────────
  /// Rolling mean over the trailing window. Null if not yet computed.
  final double? rollingMu;

  /// Rolling standard deviation over the trailing window.
  final double? rollingSigma;

  /// Z-score: `(score - rollingMu) / rollingSigma`.
  final double? zScore;

  /// Whether `|zScore| > threshold` — flags unusual movement.
  final bool isSpike;

  @override
  List<Object?> get props => [date, score];

  /// Creates a copy with optional anomaly-field overrides.
  SentimentSnapshot copyWith({
    String? date,
    int? positiveCount,
    int? negativeCount,
    int? neutralCount,
    int? totalMentions,
    String? dominantEmotion,
    double? score,
    double? rollingMu,
    double? rollingSigma,
    double? zScore,
    bool? isSpike,
  }) {
    return SentimentSnapshot(
      date: date ?? this.date,
      positiveCount: positiveCount ?? this.positiveCount,
      negativeCount: negativeCount ?? this.negativeCount,
      neutralCount: neutralCount ?? this.neutralCount,
      totalMentions: totalMentions ?? this.totalMentions,
      dominantEmotion: dominantEmotion ?? this.dominantEmotion,
      score: score ?? this.score,
      rollingMu: rollingMu ?? this.rollingMu,
      rollingSigma: rollingSigma ?? this.rollingSigma,
      zScore: zScore ?? this.zScore,
      isSpike: isSpike ?? this.isSpike,
    );
  }

  Map<String, dynamic> toFirestore() => {
    'date': date,
    'positiveCount': positiveCount,
    'negativeCount': negativeCount,
    'neutralCount': neutralCount,
    'totalMentions': totalMentions,
    'dominantEmotion': dominantEmotion,
    'score': score,
    'timestamp': DateTime.now().toIso8601String(),
    if (rollingMu != null) 'rollingMu': rollingMu,
    if (rollingSigma != null) 'rollingSigma': rollingSigma,
    if (zScore != null) 'zScore': zScore,
    'isSpike': isSpike,
  };

  factory SentimentSnapshot.fromFirestore(Map<String, dynamic> data) {
    return SentimentSnapshot(
      date: data['date'] as String? ?? '',
      positiveCount: data['positiveCount'] as int? ?? 0,
      negativeCount: data['negativeCount'] as int? ?? 0,
      neutralCount: data['neutralCount'] as int? ?? 0,
      totalMentions: data['totalMentions'] as int? ?? 0,
      dominantEmotion: data['dominantEmotion'] as String? ?? 'neutral',
      score: (data['score'] as num?)?.toDouble() ?? 50.0,
      rollingMu: (data['rollingMu'] as num?)?.toDouble(),
      rollingSigma: (data['rollingSigma'] as num?)?.toDouble(),
      zScore: (data['zScore'] as num?)?.toDouble(),
      isSpike: data['isSpike'] as bool? ?? false,
    );
  }
}
