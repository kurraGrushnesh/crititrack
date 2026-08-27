// Tests for ProxyCelebrityRepository — verifies it parses the backend
// payload into domain models and maps HTTP failures to typed Failures.
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';

import 'package:crititrack/core/domain/models/controversy.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/features/dashboard/data/proxy_celebrity_repository.dart';

class _MockClient extends Mock implements http.Client {}

class _FakeUri extends Fake implements Uri {}

void main() {
  setUpAll(() => registerFallbackValue(_FakeUri()));

  late _MockClient client;
  late ProxyCelebrityRepository repo;

  setUp(() {
    client = _MockClient();
    repo = ProxyCelebrityRepository(client: client);
  });

  const payload = {
    'name': 'Jane Doe',
    'slug': 'jane-doe',
    'fetchedAt': '2026-08-28T00:00:00.000Z',
    'biography': {
      'profession': 'Actor',
      'summary': 'A performer.',
      'background': 'Long career.',
      'notableWorks': ['Film A'],
      'controversies': [
        {
          'title': 'Contract dispute',
          'summary': 'A disagreement with a studio, later settled.',
          'category': 'Legal',
          'severity': 3,
          'status': 'resolved',
          'year': 2021,
          'sources': ['Variety'],
        },
      ],
    },
    'sentiment': {
      'overallScore': 71,
      'positiveRatio': 0.5,
      'negativeRatio': 0.2,
      'neutralRatio': 0.3,
      'trendDirection': 'up',
      'dominantEmotion': 'admiration',
      'explanation': 'Coverage skews positive.',
      'trendData': [
        {'day': 'Mon', 'score': 60},
        {'day': 'Tue', 'score': 65},
        {'day': 'Wed', 'score': 70},
      ],
      'evidence': [
        {'fragment': 'praised for the role', 'source': 'news'},
      ],
      'scoreNews': 72.0,
      'scoreYoutube': 68.0,
      'scoreInstagram': null,
    },
    'media': [
      {
        'id': 'abc',
        'type': 'news',
        'title': 'Jane Doe shines',
        'url': 'https://example.com/a',
        'thumbnailUrl': null,
        'source': 'Example',
        'publishedAt': '2026-08-27T12:00:00.000Z',
        'description': 'A review.',
      },
    ],
  };

  test('parses a 200 payload into a Celebrity', () async {
    when(
      () => client.get(any()),
    ).thenAnswer((_) async => http.Response(jsonEncode(payload), 200));

    final result = await repo.getCelebrity('Jane Doe');

    expect(result, isA<Success>());
    final celeb = (result as Success).value;
    expect(celeb.name, 'Jane Doe');
    expect(celeb.slug, 'jane-doe');
    expect(celeb.biography.controversies, hasLength(1));
    expect(
      celeb.biography.controversies.first.category,
      ControversyCategory.legal,
    );
    expect(celeb.sentimentData.overallScore, 71);
    expect(celeb.sentimentData.trendData, hasLength(3));
    expect(celeb.sentimentData.evidence.first.fragment, 'praised for the role');
    expect(celeb.mediaItems, hasLength(1));
    expect(celeb.mediaItems.first.title, 'Jane Doe shines');
  });

  test('maps HTTP 429 to RateLimitFailure', () async {
    when(
      () => client.get(any()),
    ).thenAnswer((_) async => http.Response('{"error":"rate"}', 429));

    final result = await repo.getCelebrity('X');
    expect(result, isA<Error>());
    expect((result as Error).failure, isA<RateLimitFailure>());
  });

  test('maps HTTP 500 to ServerFailure with the backend message', () async {
    when(
      () => client.get(any()),
    ).thenAnswer((_) async => http.Response('{"message":"groq down"}', 500));

    final result = await repo.getCelebrity('X');
    final failure = (result as Error).failure;
    expect(failure, isA<ServerFailure>());
    expect(failure.message, contains('groq down'));
  });

  test('maps malformed JSON to ParseFailure', () async {
    when(
      () => client.get(any()),
    ).thenAnswer((_) async => http.Response('not json', 200));

    final result = await repo.getCelebrity('X');
    expect((result as Error).failure, isA<ParseFailure>());
  });
}
