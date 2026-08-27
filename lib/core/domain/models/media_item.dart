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
    this.videoId,
    this.channelTitle,
    this.mediaUrl,
    this.permalink,
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

  // ── YouTube-specific ──────────────────────────────────────────────
  final String? videoId;
  final String? channelTitle;

  // ── Instagram-specific ────────────────────────────────────────────
  /// Direct media URL for images/videos.
  final String? mediaUrl;

  /// Instagram permalink.
  final String? permalink;

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
    'videoId': videoId,
    'channelTitle': channelTitle,
    'mediaUrl': mediaUrl,
    'permalink': permalink,
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
      videoId: data['videoId'] as String?,
      channelTitle: data['channelTitle'] as String?,
      mediaUrl: data['mediaUrl'] as String?,
      permalink: data['permalink'] as String?,
    );
  }
}
