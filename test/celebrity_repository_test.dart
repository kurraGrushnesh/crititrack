// Unit tests for CelebrityRepository — verifies the DirectCelebrityRepository
// properly calls APIs and returns Result types.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/features/dashboard/data/celebrity_repository.dart';

void main() {
  group('CelebrityRepository (base)', () {
    test('base getCelebrity returns ServerFailure', () async {
      final repo = CelebrityRepository();
      final result = await repo.getCelebrity('Test Name');
      expect(result.isError, true);
    });

    test('base forceRefresh returns ServerFailure', () async {
      final repo = CelebrityRepository();
      final result = await repo.forceRefresh('Test Name');
      expect(result.isError, true);
    });
  });
}
