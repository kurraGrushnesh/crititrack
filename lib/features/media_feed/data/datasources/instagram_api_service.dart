library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/constants/api_keys.dart';
import '../../../../core/domain/models/media_item.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';

class InstagramApiService {
  InstagramApiService({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  static const String _hashtagSearchUrl =
      'https://graph.instagram.com/v18.0/ig_hashtag_search';
  static const String _topMediaUrl = 'https://graph.instagram.com/v18.0';

  /// Fetches public Instagram posts tagged with [celebrity]'s name.
  ///
  /// Two-step process:
  /// 1. Search for the hashtag ID using `ig_hashtag_search`
  /// 2. Fetch top media for that hashtag ID
  ///
  /// If the API returns a permission error or the hashtag returns no
  /// results, returns an empty list gracefully rather than crashing.
  Future<Result<List<MediaItem>>> fetchPosts(String celebrity) async {
    try {
      // Step 1: Get hashtag ID
      final hashtagQuery = celebrity.replaceAll(' ', '').toLowerCase();
      final hashtagUri = Uri.parse(_hashtagSearchUrl).replace(
        queryParameters: {
          'user_id': ApiKeys.instagramAppId,
          'q': hashtagQuery,
          'access_token': ApiKeys.instagramAccessToken,
        },
      );

      final hashtagResponse = await _client.get(hashtagUri);

      // Handle expired/invalid token gracefully
      if (hashtagResponse.statusCode == 401 ||
          hashtagResponse.statusCode == 400) {
        // Return empty list with no error — the UI will show
        // an "Instagram reconnection needed" card
        return const Success([]);
      }

      if (hashtagResponse.statusCode != 200) {
        return Error(
          ServerFailure(
            message:
                'Instagram hashtag search returned HTTP ${hashtagResponse.statusCode}',
          ),
        );
      }

      final hashtagJson =
          jsonDecode(hashtagResponse.body) as Map<String, dynamic>;
      final hashtagData = hashtagJson['data'] as List<dynamic>?;

      if (hashtagData == null || hashtagData.isEmpty) {
        return const Success([]);
      }

      final hashtagId =
          (hashtagData[0] as Map<String, dynamic>)['id'] as String;

      // Step 2: Get top media for this hashtag
      final mediaUri = Uri.parse('$_topMediaUrl/$hashtagId/top_media').replace(
        queryParameters: {
          'user_id': ApiKeys.instagramAppId,
          'fields':
              'id,media_type,media_url,thumbnail_url,permalink,timestamp,caption',
          'limit': '5',
          'access_token': ApiKeys.instagramAccessToken,
        },
      );

      final mediaResponse = await _client.get(mediaUri);

      return _handleMediaResponse(mediaResponse);
    } on http.ClientException {
      return const Error(NetworkFailure());
    } catch (e, st) {
      // Instagram API failures should never crash the app —
      // the feed simply won't show Instagram posts
      return Error(
        ParseFailure(
          message: 'Instagram API request failed: ${e.toString()}',
          stackTrace: st,
        ),
      );
    }
  }

  Result<List<MediaItem>> _handleMediaResponse(http.Response response) {
    switch (response.statusCode) {
      case 200:
        try {
          final json = jsonDecode(response.body) as Map<String, dynamic>;
          final data = json['data'] as List<dynamic>? ?? [];

          if (data.isEmpty) {
            return const Success([]);
          }

          final items =
              data.map((post) {
                final p = post as Map<String, dynamic>;
                final permalink = p['permalink'] as String? ?? '';

                return MediaItem(
                  id: p['id'] as String? ?? '',
                  type: MediaType.instagram,
                  title: _truncateCaption(
                    p['caption'] as String? ?? 'Instagram Post',
                  ),
                  url: permalink,
                  thumbnailUrl:
                      p['thumbnail_url'] as String? ??
                      p['media_url'] as String?,
                  source: 'Instagram',
                  publishedAt:
                      p['timestamp'] != null
                          ? DateTime.tryParse(p['timestamp'] as String)
                          : null,
                  mediaUrl: p['media_url'] as String?,
                  permalink: permalink,
                );
              }).toList();

          return Success(items);
        } catch (e, st) {
          return Error(
            ParseFailure(
              message: 'Failed to parse Instagram response: ${e.toString()}',
              stackTrace: st,
            ),
          );
        }
      case 401:
        // Expired token — return empty, UI shows reconnection card
        return const Success([]);
      case 429:
        return const Error(RateLimitFailure());
      default:
        return Error(
          ServerFailure(
            message: 'Instagram API returned HTTP ${response.statusCode}',
          ),
        );
    }
  }

  /// Truncates Instagram captions to a reasonable preview length.
  String _truncateCaption(String caption) {
    if (caption.length <= 100) return caption;
    return '${caption.substring(0, 97)}...';
  }

  void dispose() => _client.close();
}
