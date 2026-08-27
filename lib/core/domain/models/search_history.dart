/// Domain model for user search history and favorites.
///
/// Stored in `search_history/{userId}` in Firestore and
/// mirrored locally in Hive for offline access.
library;

import 'package:equatable/equatable.dart';

class SearchHistory extends Equatable {
  const SearchHistory({
    required this.userId,
    this.queries = const [],
    this.favorited = const [],
    this.lastSearched,
  });

  final String userId;

  /// Ordered list of recent search queries (most recent first).
  final List<String> queries;

  /// Celebrity slugs the user has favorited.
  final List<String> favorited;

  /// Timestamp of the most recent search.
  final DateTime? lastSearched;

  @override
  List<Object?> get props => [userId, queries, favorited];

  Map<String, dynamic> toFirestore() => {
    'queries': queries,
    'favorited': favorited,
    'lastSearched': lastSearched?.toIso8601String(),
  };

  factory SearchHistory.fromFirestore(
    String userId,
    Map<String, dynamic> data,
  ) {
    return SearchHistory(
      userId: userId,
      queries: List<String>.from(data['queries'] ?? []),
      favorited: List<String>.from(data['favorited'] ?? []),
      lastSearched:
          data['lastSearched'] != null
              ? DateTime.tryParse(data['lastSearched'] as String)
              : null,
    );
  }

  SearchHistory copyWith({
    List<String>? queries,
    List<String>? favorited,
    DateTime? lastSearched,
  }) {
    return SearchHistory(
      userId: userId,
      queries: queries ?? this.queries,
      favorited: favorited ?? this.favorited,
      lastSearched: lastSearched ?? this.lastSearched,
    );
  }
}
