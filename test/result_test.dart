// Unit tests for the Result type and Failure hierarchy.
import 'package:flutter_test/flutter_test.dart';

import 'package:celeb_sentiment_tracker/core/error/failures.dart';
import 'package:celeb_sentiment_tracker/core/error/result.dart';

void main() {
  group('Result', () {
    test('Success isSuccess returns true', () {
      const result = Success(42);
      expect(result.isSuccess, true);
      expect(result.isError, false);
    });

    test('Error isError returns true', () {
      const result = Error<int>(NetworkFailure());
      expect(result.isError, true);
      expect(result.isSuccess, false);
    });

    test('getOrElse returns value on Success', () {
      const result = Success(42);
      expect(result.getOrElse(() => 0), 42);
    });

    test('getOrElse returns fallback on Error', () {
      const Result<int> result = Error(NetworkFailure());
      expect(result.getOrElse(() => 0), 0);
    });

    test('map transforms Success value', () {
      const result = Success(10);
      final mapped = result.map((v) => v * 2);
      expect((mapped as Success<int>).value, 20);
    });

    test('map passes through Error', () {
      const Result<int> result = Error(NetworkFailure());
      final mapped = result.map((v) => v * 2);
      expect(mapped.isError, true);
    });

    test('switch expression works with pattern matching', () {
      const Result<String> success = Success('hello');
      const Result<String> error = Error(NotFoundFailure());

      final successMessage = switch (success) {
        Success(:final value) => value,
        Error(:final failure) => failure.message,
      };

      final errorMessage = switch (error) {
        Success(:final value) => value,
        Error(:final failure) => failure.message,
      };

      expect(successMessage, 'hello');
      expect(errorMessage, contains('couldn\'t find'));
    });
  });

  group('Failure subtypes', () {
    test('NetworkFailure has default message', () {
      const f = NetworkFailure();
      expect(f.message, contains('internet'));
    });

    test('ApiKeyFailure includes service name', () {
      const f = ApiKeyFailure(serviceName: 'OpenAI');
      expect(f.serviceName, 'OpenAI');
    });

    test('RateLimitFailure has user-friendly message', () {
      const f = RateLimitFailure();
      expect(f.message, contains('wait'));
    });

    test('Failures are equatable by message', () {
      const f1 = NetworkFailure();
      const f2 = NetworkFailure();
      expect(f1, equals(f2));
    });

    test('exhaustive switch on sealed Failure', () {
      const Failure failure = ParseFailure();
      final label = switch (failure) {
        NetworkFailure() => 'network',
        ApiKeyFailure() => 'api_key',
        NotFoundFailure() => 'not_found',
        RateLimitFailure() => 'rate_limit',
        ParseFailure() => 'parse',
        ModelNotFoundFailure() => 'model_not_found',
        ServerFailure() => 'server',
        FirebaseFailure() => 'firebase',
      };
      expect(label, 'parse');
    });
  });
}
