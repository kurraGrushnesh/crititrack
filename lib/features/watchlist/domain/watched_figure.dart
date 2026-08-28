/// A public figure the user follows.
///
/// Deliberately small. It stores only what the watchlist needs to render
/// a row and route to a dashboard — the full profile is fetched or served
/// from cache like any other. Keeping a copy of the whole profile here
/// would mean two sources of truth that drift apart.
library;

import 'package:equatable/equatable.dart';

class WatchedFigure extends Equatable {
  const WatchedFigure({
    required this.slug,
    required this.name,
    required this.addedAt,
    this.imageUrl,
    this.lastScore,
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

  WatchedFigure copyWith({
    String? slug,
    String? name,
    DateTime? addedAt,
    String? imageUrl,
    double? lastScore,
  }) {
    return WatchedFigure(
      slug: slug ?? this.slug,
      name: name ?? this.name,
      addedAt: addedAt ?? this.addedAt,
      imageUrl: imageUrl ?? this.imageUrl,
      lastScore: lastScore ?? this.lastScore,
    );
  }

  Map<String, dynamic> toMap() => {
    'slug': slug,
    'name': name,
    'addedAt': addedAt.toIso8601String(),
    if (imageUrl != null) 'imageUrl': imageUrl,
    if (lastScore != null) 'lastScore': lastScore,
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
    );
  }

  @override
  List<Object?> get props => [slug, name, addedAt, imageUrl, lastScore];
}
