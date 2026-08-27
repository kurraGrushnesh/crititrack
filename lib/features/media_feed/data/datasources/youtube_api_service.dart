/// Service for the YouTube Data API v3.
///
/// Searches for the 5 most relevant videos matching a celebrity name.
/// Builds full thumbnail URLs as `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
/// and canonical watch URLs as `https://www.youtube.com/watch?v={videoId}`.
///
/// Endpoint: `https://www.googleapis.com/youtube/v3/search`
/// Auth: `key` query parameter from [ApiKeys.youtubeApiKey].
///
/// Cache/invalidation: Stateless — caching handled by [CacheRepository].
library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/constants/api_keys.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/domain/models/media_item.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';

class YouTubeApiService {
  YouTubeApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const String _baseUrl = 'https://www.googleapis.com/youtube/v3/search';

  /// Fetches the top YouTube videos about [celebrity].
  ///
  /// Parses `items[]` extracting videoId, title, thumbnail, and
  /// channel title. Each item's URL opens the video in a WebView.
  Future<Result<List<MediaItem>>> fetchVideos(String celebrity) async {
    try {
      final uri = Uri.parse(_baseUrl).replace(
        queryParameters: {
          'part': 'snippet',
          'q': celebrity,
          'type': 'video',
          'maxResults': AppConstants.youtubeMaxResults.toString(),
          'key': ApiKeys.youtubeApiKey,
        },
      );

      final response = await _client.get(uri);

      return _handleResponse(response);
    } on http.ClientException {
      return const Error(NetworkFailure());
    } catch (e, st) {
      return Error(
        ParseFailure(
          message: 'YouTube API request failed: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  Result<List<MediaItem>> _handleResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final items = json['items'] as List<dynamic>? ?? [];

          if (items.isEmpty) {
            return const Success([]);
          }

          final mediaItems =
              items.map((item) {
                final i = item as Map<String, dynamic>;
                final id = i['id'] as Map<String, dynamic>?;
                final snippet = i['snippet'] as Map<String, dynamic>?;
                final videoId = id?['videoId'] as String? ?? '';

                return MediaItem(
                  id: videoId,
                  type: MediaType.youtube,
                  title: snippet?['title'] as String? ?? 'Untitled Video',
                  url: 'https://www.youtube.com/watch?v=$videoId',
                  thumbnailUrl:
                      'https://img.youtube.com/vi/$videoId/hqdefault.jpg',
                  source: 'YouTube',
                  publishedAt:
                      snippet?['publishedAt'] != null
                          ? DateTime.tryParse(snippet!['publishedAt'] as String)
                          : null,
                  description: snippet?['description'] as String?,
                  videoId: videoId,
                  channelTitle: snippet?['channelTitle'] as String?,
                );
              }).toList();

          return Success(mediaItems);
        } catch (e, st) {
          return Error(
            ParseFailure(
              message: 'Failed to parse YouTube response: ${e.toString()}',
              stackTrace: st,
            ),
          );
        }
      case 401:
      case 403:
        return const Error(
          ApiKeyFailure(
            serviceName: 'YouTube',
            message:
                'Invalid YouTube API key. Ensure the YouTube Data API v3 is enabled in Google Cloud Console.',
          ),
        );
      case 429:
        return const Error(RateLimitFailure());
      default:
        return Error(
          ServerFailure(
            message: 'YouTube API returned HTTP ${response.statusCode}',
          ),
        );
    }
  }

  void dispose() => _client.close();
}
