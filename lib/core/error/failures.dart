/// Sealed failure hierarchy used by the domain-layer [Result] type.
///
/// Every service and repository returns `Result<T, Failure>` instead
/// of throwing raw exceptions, giving the presentation layer exhaustive
/// pattern-matching over all possible error states.
library;

import 'package:equatable/equatable.dart';

/// Base failure class — sealed so the compiler can enforce exhaustive
/// matching in `switch` expressions.
sealed class Failure extends Equatable {
  const Failure({required this.message, this.stackTrace});

  /// Human-readable explanation suitable for showing in error UI.
  final String message;

  /// Optional stack trace captured at the point of failure.
  final StackTrace? stackTrace;

  @override
  List<Object?> get props => [message];
}

/// The device has no internet connectivity, or the request timed out.
final class NetworkFailure extends Failure {
  const NetworkFailure({
    super.message = 'No internet connection. Please check your network.',
    super.stackTrace,
  });
}

/// An API key is missing, invalid, or revoked (HTTP 401 / 403).
final class ApiKeyFailure extends Failure {
  const ApiKeyFailure({
    required this.serviceName,
    super.message = 'Invalid API key.',
    super.stackTrace,
  });

  /// Which service's key failed — shown in the `ApiKeyErrorScreen`.
  final String serviceName;

  @override
  List<Object?> get props => [message, serviceName];
}

/// The requested celebrity could not be found across any data source.
final class NotFoundFailure extends Failure {
  const NotFoundFailure({
    super.message = 'We couldn\'t find enough data for this celebrity.',
    super.stackTrace,
  });
}

/// The upstream API returned HTTP 429 — too many requests.
final class RateLimitFailure extends Failure {
  const RateLimitFailure({
    super.message = 'Too many requests. Please wait a moment and try again.',
    super.stackTrace,
  });
}

/// A JSON decoding or model-mapping error occurred.
final class ParseFailure extends Failure {
  const ParseFailure({
    super.message = 'Failed to parse the server response.',
    super.stackTrace,
  });
}

/// The requested AI model does not exist or has been deprecated (HTTP 404).
final class ModelNotFoundFailure extends Failure {
  const ModelNotFoundFailure({
    super.message =
        'The AI model configuration needs updating. '
            'Please contact the developer or check the Groq console.',
    super.stackTrace,
  });
}

/// A generic server-side error (HTTP 5xx).
final class ServerFailure extends Failure {
  const ServerFailure({
    super.message = 'Something went wrong on the server. Please try again.',
    super.stackTrace,
  });
}

/// Firebase-specific failures (auth, Firestore writes, etc.).
final class FirebaseFailure extends Failure {
  const FirebaseFailure({required super.message, super.stackTrace});
}
