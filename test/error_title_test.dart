// What the dashboard says when the fetch fails.
//
// `ApiConfig.isDemo` is a compile-time constant, so a single run cannot
// exercise both states. This file asserts the correct wording for
// whichever build it is compiled into, and is run both ways:
//
//   flutter test test/error_title_test.dart
//   flutter test test/error_title_test.dart --dart-define=DEMO_MODE=true
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/constants/api_config.dart';
import 'package:crititrack/core/error/failures.dart';
import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/dashboard/presentation/screens/dashboard_screen.dart';

Future<void> pumpFailed(WidgetTester tester, Failure failure) async {
  tester.view.physicalSize = const Size(900, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dashboardProvider.overrideWith((ref, slug) => Future.error(failure)),
      ],
      child: MaterialApp(
        theme: AppTheme.darkTheme,
        home: const DashboardScreen(slug: 'jane-doe'),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));
}

void main() {
  testWidgets('a non-network failure keeps its own wording either way', (
    tester,
  ) async {
    // The demo only changes what a *network* failure is called; the rest
    // of the sealed hierarchy is unaffected.
    await pumpFailed(tester, const RateLimitFailure(message: 'Slow down.'));

    expect(find.text('Too many requests'), findsOneWidget);
    expect(find.textContaining('demo'), findsNothing);
  });

  if (ApiConfig.isDemo) {
    testWidgets('a network failure names the demo, not the network', (
      tester,
    ) async {
      // There is no server to fail to reach here, so "Cannot reach the
      // server" and a wifi-off icon would point at a problem the reader
      // does not have — and contradict the body text underneath.
      await pumpFailed(
        tester,
        const NetworkFailure(message: 'No backend is deployed.'),
      );

      expect(find.text('This demo has no backend'), findsOneWidget);
      expect(find.text('Cannot reach the server'), findsNothing);
      expect(find.byIcon(Icons.wifi_off_rounded), findsNothing);
      expect(find.byIcon(Icons.science_outlined), findsOneWidget);
    });
  } else {
    testWidgets('a network failure reports the network', (tester) async {
      await pumpFailed(
        tester,
        const NetworkFailure(message: 'Could not reach the backend.'),
      );

      expect(find.text('Cannot reach the server'), findsOneWidget);
      expect(find.text('This demo has no backend'), findsNothing);
      expect(find.byIcon(Icons.wifi_off_rounded), findsOneWidget);
    });
  }

  testWidgets('the failure keeps its own message rather than generic advice', (
    tester,
  ) async {
    // The earlier version discarded the message and substituted "check
    // your internet connection", which sent people to look in the wrong
    // place.
    await pumpFailed(
      tester,
      const NetworkFailure(message: 'A very specific explanation.'),
    );

    expect(find.text('A very specific explanation.'), findsOneWidget);
  });
}
