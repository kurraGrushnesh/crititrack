// Unit tests for domain models — serialization, equality, and edge cases.
import 'package:flutter_test/flutter_test.dart';

import 'package:celeb_sentiment_tracker/core/domain/models/celebrity.dart';
import 'package:celeb_sentiment_tracker/core/domain/models/media_item.dart';
import 'package:celeb_sentiment_tracker/core/domain/models/sentiment_data.dart';
import 'package:celeb_sentiment_tracker/core/domain/models/search_history.dart';

void main() {
  group('Biography', () {
    test('fromMap creates Biography with all fields', () {
      final map = {
        'profession': 'Actor',
        'summary': 'Famous actor.',
        'background': 'Started young.',
        'notableWorks': ['Film A', 'Film B'],
        'controversies': ['Dispute X'],
      };

      final bio = Biography.fromMap(map);

      expect(bio.profession, 'Actor');
      expect(bio.summary, 'Famous actor.');
      expect(bio.notableWorks, ['Film A', 'Film B']);
      expect(bio.controversies, ['Dispute X']);
    });

    test('fromMap handles missing fields gracefully', () {
      final bio = Biography.fromMap({});
      expect(bio.profession, '');
      expect(bio.notableWorks, isEmpty);
      expect(bio.controversies, isEmpty);
    });

    test('toMap roundtrips correctly', () {
      const bio = Biography(
        profession: 'Singer',
        summary: 'Pop star.',
        background: 'Background info.',
        notableWorks: ['Album 1'],
        controversies: [],
      );

      final restored = Biography.fromMap(bio.toMap());
      expect(restored.profession, bio.profession);
      expect(restored.summary, bio.summary);
      expect(restored.notableWorks, bio.notableWorks);
    });
  });

  group('MediaItem', () {
    test('fromFirestore creates correct MediaItem', () {
      final item = MediaItem.fromFirestore('test-id', {
        'type': 'youtube',
        'title': 'Test Video',
        'url': 'https://youtube.com/watch?v=test',
        'thumbnailUrl': 'https://img.youtube.com/vi/test/hqdefault.jpg',
        'source': 'YouTube',
        'videoId': 'test',
        'channelTitle': 'Test Channel',
      });

      expect(item.id, 'test-id');
      expect(item.type, MediaType.youtube);
      expect(item.videoId, 'test');
    });

    test('toFirestore preserves all fields', () {
      const item = MediaItem(
        id: 'n1',
        type: MediaType.news,
        title: 'Breaking News',
        url: 'https://example.com',
        source: 'BBC',
      );

      final map = item.toFirestore();
      expect(map['type'], 'news');
      expect(map['title'], 'Breaking News');
      expect(map['source'], 'BBC');
    });

    test('unknown type defaults to news', () {
      final item = MediaItem.fromFirestore('x', {
        'type': 'unknown',
        'title': 'Test',
        'url': 'https://example.com',
      });
      expect(item.type, MediaType.news);
    });
  });

  group('SentimentData', () {
    test('fromMap creates valid SentimentData', () {
      final data = SentimentData.fromMap({
        'overallScore': 75.0,
        'positiveRatio': 0.6,
        'negativeRatio': 0.15,
        'neutralRatio': 0.25,
        'trendDirection': 'up',
        'explanation': 'Things are looking good.',
        'dominantEmotion': 'joy',
        'trendData': [
          {
            'date': 'Mon',
            'score': 70.0,
            'positiveCount': 10,
            'negativeCount': 3,
            'neutralCount': 5,
            'totalMentions': 18,
            'dominantEmotion': 'joy',
          },
        ],
      });

      expect(data.overallScore, 75.0);
      expect(data.trendDirection, 'up');
      expect(data.trendData.length, 1);
    });

    test('fromMap handles empty map', () {
      final data = SentimentData.fromMap({});
      expect(data.overallScore, 50.0);
      expect(data.trendDirection, 'stable');
    });
  });

  group('SentimentSnapshot', () {
    test('fromFirestore creates snapshot correctly', () {
      final snap = SentimentSnapshot.fromFirestore({
        'date': 'Tue',
        'positiveCount': 20,
        'negativeCount': 5,
        'neutralCount': 10,
        'totalMentions': 35,
        'dominantEmotion': 'excitement',
        'score': 72.5,
      });

      expect(snap.date, 'Tue');
      expect(snap.totalMentions, 35);
      expect(snap.score, 72.5);
    });
  });

  group('SearchHistory', () {
    test('fromFirestore creates history', () {
      final history = SearchHistory.fromFirestore('user1', {
        'queries': ['Taylor Swift', 'BTS'],
        'favorited': ['taylor-swift'],
        'lastSearched': '2024-03-15T10:00:00Z',
      });

      expect(history.userId, 'user1');
      expect(history.queries.length, 2);
      expect(history.favorited, ['taylor-swift']);
    });

    test('copyWith works correctly', () {
      const history = SearchHistory(
        userId: 'user1',
        queries: ['test'],
        favorited: [],
      );

      final updated = history.copyWith(queries: ['new search', 'test']);

      expect(updated.queries.length, 2);
      expect(updated.queries.first, 'new search');
      expect(updated.userId, 'user1');
    });
  });

  group('Celebrity', () {
    test('isFresh returns true for recent data', () {
      final celeb = Celebrity(
        slug: 'test',
        name: 'Test',
        biography: const Biography(
          profession: 'Actor',
          summary: 'Test',
          background: 'Test',
          notableWorks: [],
          controversies: [],
        ),
        sentimentData: SentimentData(
          overallScore: 50,
          positiveRatio: 0.33,
          negativeRatio: 0.33,
          neutralRatio: 0.34,
          trendDirection: 'stable',
          explanation: '',
          trendData: const [],
          dominantEmotion: 'neutral',
        ),
        mediaItems: const [],
        fetchedAt: DateTime.now(),
      );

      expect(celeb.isFresh, true);
    });

    test('isFresh returns false for stale data', () {
      final celeb = Celebrity(
        slug: 'test',
        name: 'Test',
        biography: const Biography(
          profession: 'Actor',
          summary: 'Test',
          background: 'Test',
          notableWorks: [],
          controversies: [],
        ),
        sentimentData: SentimentData(
          overallScore: 50,
          positiveRatio: 0.33,
          negativeRatio: 0.33,
          neutralRatio: 0.34,
          trendDirection: 'stable',
          explanation: '',
          trendData: const [],
          dominantEmotion: 'neutral',
        ),
        mediaItems: const [],
        fetchedAt: DateTime.now().subtract(const Duration(hours: 25)),
      );

      expect(celeb.isFresh, false);
    });
  });
}
