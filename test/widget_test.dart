// Smoke test for the CritiTrack app.
// Full widget tests with Firebase mocking are in Phase 5 test files.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/core/error/result.dart';
import 'package:crititrack/core/error/failures.dart';

void main() {
  test('App compiles and core utilities work', () {
    // Verify core utilities are functional
    expect(toSlug('Taylor Swift'), 'taylor-swift');
    expect(fromSlug('taylor-swift'), 'Taylor Swift');

    // Verify Result type works
    const Result<int> success = Success(42);
    const Result<int> error = Error(NetworkFailure());
    expect(success.isSuccess, true);
    expect(error.isError, true);
  });
}
