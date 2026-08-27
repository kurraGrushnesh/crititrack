library;

import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/constants/api_keys.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/domain/models/media_item.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/error/result.dart';

class NewsApiService {
  NewsApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  static const String _baseUrl = 'https://newsapi.org/v2/everything';

  /// Fetches the latest news articles about [celebrity].
  ///
  /// Returns an empty list with no error when `totalResults == 0`
  /// rather than throwing a [NotFoundFailure], because having zero
  /// news coverage is a valid (and common) state for lesser-known
  /// celebrities.
  Future<Result<List<MediaItem>>> fetchNews(String celebrity) async {
    try {
      final uri = Uri.parse(_baseUrl).replace(
        queryParameters: {
          'q': celebrity,
          'language': 'en',
          'sortBy': 'publishedAt',
          'pageSize': AppConstants.newsPageSize.toString(),
          'apiKey': ApiKeys.newsApiKey,
        },
      );

      final response = await _client.get(uri);

      return _handleResponse(response);
    } on http.ClientException {
      return const Error(NetworkFailure());
    } catch (e, st) {
      return Error(
        ParseFailure(
          message: 'NewsAPI request failed: ${e.toString()}',
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
          final articles = json['articles'] as List<dynamic>? ?? [];

          if (articles.isEmpty) {
            return const Success([]);
          }

          final items =
              articles.map((article) {
                final a = article as Map<String, dynamic>;
                final source = a['source'] as Map<String, dynamic>?;
                final url = a['url'] as String? ?? '';

                return MediaItem(
                  id: url.hashCode.toString(),
                  type: MediaType.news,
                  title: a['title'] as String? ?? 'Untitled',
                  url: url,
                  thumbnailUrl: a['urlToImage'] as String?,
                  source: source?['name'] as String? ?? 'Unknown',
                  publishedAt:
                      a['publishedAt'] != null
                          ? DateTime.tryParse(a['publishedAt'] as String)
                          : null,
                  description: a['description'] as String?,
                );
              }).toList();

          return Success(items);
        } catch (e, st) {
          return Error(
            ParseFailure(
              message: 'Failed to parse NewsAPI response: ${e.toString()}',
              stackTrace: st,
            ),
          );
        }
      case 401:
        return const Error(
          ApiKeyFailure(
            serviceName: 'NewsAPI',
            message: 'Invalid NewsAPI key. Check your api_keys.dart.',
          ),
        );
      case 429:
        return const Error(RateLimitFailure());
      default:
        return Error(
          ServerFailure(
            message: 'NewsAPI returned HTTP ${response.statusCode}',
          ),
        );
    }
  }

  void dispose() => _client.close();
}
