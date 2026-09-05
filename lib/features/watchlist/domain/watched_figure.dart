/// A public figure the user follows.
///
/// Deliberately small. It stores only what the watchlist needs to render
/// a row and route to a dashboard — the full profile is fetched or served
/// from cache like any other. Keeping a copy of the whole profile here
/// would mean two sources of truth that drift apart.
///
/// Step 17 (Watch Intelligence) adds what a watch needs to track about
/// itself — what the reader has already seen, and what they want
/// emphasised — without changing the profile-cache relationship above.
/// `slug` remains the stable identity; every new field defaults so an
/// entry saved before this shipped keeps working unchanged.
library;

import 'package:equatable/equatable.dart';

/// Which kinds of ChangeEvent a reader wants surfaced. All true by
/// default — this only narrows presentation/ordering; it never
/// suppresses or invents an actual detected change.
class WatchNotificationPreferences extends Equatable {
  const WatchNotificationPreferences({
    this.careerChanges = true,
    this.organizationChanges = true,
    this.controversyChanges = true,
    this.claimChanges = true,
    this.sentimentChanges = true,
    this.attentionChanges = true,
    this.critiScoreChanges = true,
    this.profileChanges = true,
    this.sourceCoverageChanges = true,
    this.newsEvents = true,
    this.importantOnly = true,
  });

  final bool careerChanges;
  final bool organizationChanges;
  final bool controversyChanges;
  final bool claimChanges;
  final bool sentimentChanges;
  final bool attentionChanges;
  final bool critiScoreChanges;
  final bool profileChanges;
  final bool sourceCoverageChanges;
  final bool newsEvents;

  /// When true, the feed defaults to MAJOR + SIGNIFICANT only.
  final bool importantOnly;

  Map<String, dynamic> toMap() => {
    'careerChanges': careerChanges,
    'organizationChanges': organizationChanges,
    'controversyChanges': controversyChanges,
    'claimChanges': claimChanges,
    'sentimentChanges': sentimentChanges,
    'attentionChanges': attentionChanges,
    'critiScoreChanges': critiScoreChanges,
    'profileChanges': profileChanges,
    'sourceCoverageChanges': sourceCoverageChanges,
    'newsEvents': newsEvents,
    'importantOnly': importantOnly,
  };

  static WatchNotificationPreferences fromMap(Map? map) {
    const d = WatchNotificationPreferences();
    if (map == null) return d;
    bool b(dynamic v, bool fallback) => v is bool ? v : fallback;
    return WatchNotificationPreferences(
      careerChanges: b(map['careerChanges'], d.careerChanges),
      organizationChanges: b(map['organizationChanges'], d.organizationChanges),
      controversyChanges: b(map['controversyChanges'], d.controversyChanges),
      claimChanges: b(map['claimChanges'], d.claimChanges),
      sentimentChanges: b(map['sentimentChanges'], d.sentimentChanges),
      attentionChanges: b(map['attentionChanges'], d.attentionChanges),
      critiScoreChanges: b(map['critiScoreChanges'], d.critiScoreChanges),
      profileChanges: b(map['profileChanges'], d.profileChanges),
      sourceCoverageChanges: b(map['sourceCoverageChanges'], d.sourceCoverageChanges),
      newsEvents: b(map['newsEvents'], d.newsEvents),
      importantOnly: b(map['importantOnly'], d.importantOnly),
    );
  }

  @override
  List<Object?> get props => [
    careerChanges,
    organizationChanges,
    controversyChanges,
    claimChanges,
    sentimentChanges,
    attentionChanges,
    critiScoreChanges,
    profileChanges,
    sourceCoverageChanges,
    newsEvents,
    importantOnly,
  ];
}

enum WatchMinimumSeverity { all, major, significant, minor, info }

enum WatchMinimumConfidence { all, high, medium, low }

enum WatchTimeRange { day1, day7, day30, day90, all }

class WatchFilters extends Equatable {
  const WatchFilters({
    this.minimumSeverity = WatchMinimumSeverity.all,
    this.minimumConfidence = WatchMinimumConfidence.all,
    this.timeRange = WatchTimeRange.all,
  });

  final WatchMinimumSeverity minimumSeverity;
  final WatchMinimumConfidence minimumConfidence;
  final WatchTimeRange timeRange;

  Map<String, dynamic> toMap() => {
    'minimumSeverity': minimumSeverity.name,
    'minimumConfidence': minimumConfidence.name,
    'timeRange': timeRange.name,
  };

  static WatchFilters fromMap(Map? map) {
    const d = WatchFilters();
    if (map == null) return d;
    return WatchFilters(
      minimumSeverity: WatchMinimumSeverity.values.firstWhere(
        (v) => v.name == map['minimumSeverity'],
        orElse: () => d.minimumSeverity,
      ),
      minimumConfidence: WatchMinimumConfidence.values.firstWhere(
        (v) => v.name == map['minimumConfidence'],
        orElse: () => d.minimumConfidence,
      ),
      timeRange: WatchTimeRange.values.firstWhere(
        (v) => v.name == map['timeRange'],
        orElse: () => d.timeRange,
      ),
    );
  }

  @override
  List<Object?> get props => [minimumSeverity, minimumConfidence, timeRange];
}

class WatchedFigure extends Equatable {
  const WatchedFigure({
    required this.slug,
    required this.name,
    required this.addedAt,
    this.imageUrl,
    this.lastScore,
    this.wikidataId,
    this.lastViewedAt,
    this.lastSeenChangeAt,
    this.notificationPreferences = const WatchNotificationPreferences(),
    this.filters = const WatchFilters(),
  });

  /// Canonical slug — the same key the dashboard and cache use.
  final String slug;

  final String name;

  /// When the user first followed this figure. Drives list order.
  final DateTime addedAt;

  final String? imageUrl;

  /// The sentiment score when last seen, so a row can show movement
  /// without waiting on a fetch. Null until the figure has been opened.
  final double? lastScore;

  /// Wikidata id, when known — the truer stable identity behind [slug],
  /// kept alongside it (older entries predate this field).
  final String? wikidataId;

  /// When the reader last opened this watch's intelligence view.
  final DateTime? lastViewedAt;

  /// The cursor up to which detected changes count as "seen". Null means
  /// everything ever detected is unseen (a fresh watch).
  final DateTime? lastSeenChangeAt;

  final WatchNotificationPreferences notificationPreferences;
  final WatchFilters filters;

  WatchedFigure copyWith({
    String? slug,
    String? name,
    DateTime? addedAt,
    String? imageUrl,
    double? lastScore,
    String? wikidataId,
    DateTime? lastViewedAt,
    DateTime? lastSeenChangeAt,
    WatchNotificationPreferences? notificationPreferences,
    WatchFilters? filters,
  }) {
    return WatchedFigure(
      slug: slug ?? this.slug,
      name: name ?? this.name,
      addedAt: addedAt ?? this.addedAt,
      imageUrl: imageUrl ?? this.imageUrl,
      lastScore: lastScore ?? this.lastScore,
      wikidataId: wikidataId ?? this.wikidataId,
      lastViewedAt: lastViewedAt ?? this.lastViewedAt,
      lastSeenChangeAt: lastSeenChangeAt ?? this.lastSeenChangeAt,
      notificationPreferences: notificationPreferences ?? this.notificationPreferences,
      filters: filters ?? this.filters,
    );
  }

  Map<String, dynamic> toMap() => {
    'slug': slug,
    'name': name,
    'addedAt': addedAt.toIso8601String(),
    if (imageUrl != null) 'imageUrl': imageUrl,
    if (lastScore != null) 'lastScore': lastScore,
    if (wikidataId != null) 'wikidataId': wikidataId,
    if (lastViewedAt != null) 'lastViewedAt': lastViewedAt!.toIso8601String(),
    if (lastSeenChangeAt != null) 'lastSeenChangeAt': lastSeenChangeAt!.toIso8601String(),
    'notificationPreferences': notificationPreferences.toMap(),
    'filters': filters.toMap(),
  };

  /// Returns null for anything unusable, so a corrupted entry is skipped
  /// rather than crashing the list that renders it.
  static WatchedFigure? fromMap(Map<String, dynamic> map) {
    final slug = map['slug'];
    if (slug is! String || slug.isEmpty) return null;

    return WatchedFigure(
      slug: slug,
      name: map['name'] as String? ?? slug,
      addedAt:
          DateTime.tryParse(map['addedAt'] as String? ?? '') ?? DateTime.now(),
      imageUrl: map['imageUrl'] as String?,
      lastScore: (map['lastScore'] as num?)?.toDouble(),
      wikidataId: map['wikidataId'] as String?,
      lastViewedAt: DateTime.tryParse(map['lastViewedAt'] as String? ?? ''),
      lastSeenChangeAt: DateTime.tryParse(map['lastSeenChangeAt'] as String? ?? ''),
      notificationPreferences: WatchNotificationPreferences.fromMap(
        map['notificationPreferences'] as Map?,
      ),
      filters: WatchFilters.fromMap(map['filters'] as Map?),
    );
  }

  @override
  List<Object?> get props => [
    slug,
    name,
    addedAt,
    imageUrl,
    lastScore,
    wikidataId,
    lastViewedAt,
    lastSeenChangeAt,
    notificationPreferences,
    filters,
  ];
}
