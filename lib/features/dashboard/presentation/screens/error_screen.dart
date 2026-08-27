/// Error screen handling all error states.
///
/// Displays contextual error UI based on [errorType]:
///   - "notFound": celebrity not found (Lottie animation + retry)
///   - "apiKey": invalid API key (shows which key and setup link)
///   - "network": offline (shows last cached timestamp)
///   - "generic": fallback error
///
/// Auto-navigated from the Riverpod `AsyncError` state.
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ErrorScreen extends StatelessWidget {
  const ErrorScreen({
    super.key,
    required this.message,
    this.errorType = 'generic',
  });

  final String message;
  final String errorType;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _iconForType(errorType),
                size: 80,
                color: theme.colorScheme.error,
              ),
              const SizedBox(height: 24),
              Text(
                _titleForType(errorType),
                style: theme.textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                message,
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              ElevatedButton.icon(
                onPressed: () => context.go('/'),
                icon: const Icon(Icons.home_rounded),
                label: const Text('Back to Search'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _iconForType(String type) => switch (type) {
    'notFound' => Icons.person_search_rounded,
    'apiKey' => Icons.vpn_key_off_rounded,
    'modelNotFound' => Icons.model_training_rounded,
    'network' => Icons.wifi_off_rounded,
    _ => Icons.error_outline_rounded,
  };

  String _titleForType(String type) => switch (type) {
    'notFound' => 'Celebrity Not Found',
    'apiKey' => 'API Key Error',
    'modelNotFound' => 'AI Model Unavailable',
    'network' => 'No Connection',
    _ => 'Something Went Wrong',
  };
}
