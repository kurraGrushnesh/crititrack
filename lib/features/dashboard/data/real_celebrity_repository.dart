/// Real-mode celebrity repository that uses Firebase/Firestore.
///
/// This file imports `cloud_firestore` and should only be loaded
/// when `useMockData == false`. The providers file conditionally
/// selects between [CelebrityRepository] and this class.
library;

import 'package:cloud_firestore/cloud_firestore.dart';

import 'package:celeb_sentiment_tracker/features/dashboard/data/celebrity_repository.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/data/repositories/cache_repository.dart';
import 'package:celeb_sentiment_tracker/features/dashboard/data/datasources/openai_service.dart';
import 'package:celeb_sentiment_tracker/features/media_feed/data/datasources/news_api_service.dart';
import 'package:celeb_sentiment_tracker/features/media_feed/data/datasources/youtube_api_service.dart';
import 'package:celeb_sentiment_tracker/features/media_feed/data/datasources/instagram_api_service.dart';
import 'package:celeb_sentiment_tracker/core/domain/models/celebrity.dart';
import 'package:celeb_sentiment_tracker/core/error/result.dart';
import 'package:celeb_sentiment_tracker/core/error/failures.dart';

/// Extends [CelebrityRepository] with real Firebase-backed data.
class RealCelebrityRepository extends CelebrityRepository {
  RealCelebrityRepository()
    : _cacheRepository = CacheRepository(
        firestore: FirebaseFirestore.instance,
        openAiService: OpenAiService(),
        newsApiService: NewsApiService(),
        youTubeApiService: YouTubeApiService(),
        instagramApiService: InstagramApiService(),
      );

  final CacheRepository _cacheRepository;

  @override
  Future<Result<Celebrity>> getCelebrity(String name) async {
    try {
      return await _cacheRepository.getCelebrity(name);
    } catch (e) {
      return Error(ServerFailure(message: 'Firebase error: $e'));
    }
  }

  @override
  Future<Result<Celebrity>> forceRefresh(String name) async {
    try {
      return await _cacheRepository.forceRefresh(name);
    } catch (e) {
      return Error(ServerFailure(message: 'Firebase error: $e'));
    }
  }
}
