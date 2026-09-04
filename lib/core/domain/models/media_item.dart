/// Domain model for a single item in the media feed.
///
/// Unified representation covering news articles (NewsAPI),
/// YouTube videos (YouTube Data API v3), and Instagram posts
/// (Instagram Graph API). The [type] field discriminates which
/// source produced this item.
library;

import 'package:equatable/equatable.dart';

/// Discriminator for the three media sources.
enum MediaType { news, youtube, instagram }

class MediaItem extends Equatable {
  const MediaItem({
    required this.id,
    required this.type,
    required this.title,
    required this.url,
    this.thumbnailUrl,
    this.source,
    this.publishedAt,
    this.description,
    this.sentimentTag,
    this.sentimentScore,
    this.videoId,
    this.channelTitle,
    this.mediaUrl,
    this.permalink,
    this.duplicateCount,
    this.independentSourceCount,
  });

  /// Unique identifier (article URL hash, videoId, or Instagram post id).
  final String id;

  /// Which API produced this item.
  final MediaType type;

  /// Headline (news), video title (YouTube), or caption (Instagram).
  final String title;

  /// Canonical URL to open in the WebView.
  final String url;

  /// Preview image URL.
  final String? thumbnailUrl;

  /// Source outlet name (e.g. "BBC News", "YouTube", "Instagram").
  final String? source;

  /// When the content was published.
  final DateTime? publishedAt;

  /// Short description or snippet.
  final String? description;

  /// AI-assigned sentiment: "positive", "negative", or "neutral".
  final String? sentimentTag;

  /// This item's own blended sentiment, 0-100.
  ///
  /// Distinct from the figure's overall score: it is what the
  /// ensemble made of this one headline, and it is what the tag
  /// above is derived from. Null for anything the ensemble did not
  /// score, which renders without a chip rather than as neutral --
  /// neutral is a measurement, and absence is not.
  final int? sentimentScore;

  // ── YouTube-specific ──────────────────────────────────────────────
  final String? videoId;
  final String? channelTitle;

  // ── Instagram-specific ────────────────────────────────────────────
  /// Direct media URL for images/videos.
  final String? mediaUrl;

  /// Instagram permalink.
  final String? permalink;

  /// How many retrieved items collapsed into this one before dedup — 1
  /// (or null, treated the same) when nothing else covered the same
  /// story.
  final int? duplicateCount;

  /// Distinct publishers among those, from `source` or the URL host —
  /// "10 articles from 4 independent publishers", never "10
  /// confirmations".
  final int? independentSourceCount;

  @override
  List<Object?> get props => [id, type, url];

  /// Serializes to a Firestore sub-collection document.
  Map<String, dynamic> toFirestore() => {
    'type': type.name,
    'title': title,
    'url': url,
    'thumbnailUrl': thumbnailUrl,
    'source': source,
    'publishedAt': publishedAt?.toIso8601String(),
    'description': description,
    'sentimentTag': sentimentTag,
    'sentimentScore': sentimentScore,
    'videoId': videoId,
    'channelTitle': channelTitle,
    'mediaUrl': mediaUrl,
    'permalink': permalink,
    'duplicateCount': duplicateCount,
    'independentSourceCount': independentSourceCount,
  };

  factory MediaItem.fromFirestore(String id, Map<String, dynamic> data) {
    return MediaItem(
      id: id,
      type: MediaType.values.firstWhere(
        (e) => e.name == data['type'],
        orElse: () => MediaType.news,
      ),
      title: data['title'] as String? ?? '',
      url: data['url'] as String? ?? '',
      thumbnailUrl: data['thumbnailUrl'] as String?,
      source: data['source'] as String?,
      publishedAt:
          data['publishedAt'] != null
              ? DateTime.tryParse(data['publishedAt'] as String)
              : null,
      description: data['description'] as String?,
      sentimentTag: data['sentimentTag'] as String?,
      sentimentScore: (data['sentimentScore'] as num?)?.toInt(),
      videoId: data['videoId'] as String?,
      channelTitle: data['channelTitle'] as String?,
      mediaUrl: data['mediaUrl'] as String?,
      permalink: data['permalink'] as String?,
      duplicateCount: (data['duplicateCount'] as num?)?.toInt(),
      independentSourceCount: (data['independentSourceCount'] as num?)?.toInt(),
    );
  }
}
