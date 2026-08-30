// Parsing an incoming alert into something the app can route from.
//
// This is the last link in F07's acceptance criterion — "a real spike
// produces a push notification that deep-links to the dashboard section
// explaining it". Everything upstream can be correct and the feature
// still lands on the home screen if this returns the wrong thing, and the
// failure is invisible in a build.
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/features/alerts/data/push_service.dart';

RemoteMessage spike({Map<String, String>? data, String? title, String? body}) =>
    RemoteMessage(
      data:
          data ??
          const {
            'kind': 'spike',
            'slug': 'taylor-swift',
            'score': '41',
            'change': '-14',
            'direction': 'down',
            'zScore': '2.41',
          },
      notification:
          title == null && body == null
              ? null
              : RemoteNotification(title: title, body: body),
    );

void main() {
  group('AlertMessage.from', () {
    test('reads the slug the server put in the data block', () {
      // Built from `data`, not `notification`: data survives every
      // delivery path identically, while a notification block is consumed
      // by the system tray when the app is backgrounded.
      final alert = AlertMessage.from(
        spike(title: 'Taylor Swift: sentiment down sharply', body: '14 points'),
      );

      expect(alert, isNotNull);
      expect(alert!.slug, 'taylor-swift');
      expect(alert.title, 'Taylor Swift: sentiment down sharply');
      expect(alert.body, '14 points');
    });

    test('still routes when the notification block is missing', () {
      final alert = AlertMessage.from(spike());

      expect(alert, isNotNull);
      expect(alert!.slug, 'taylor-swift');
      // A generic title is better than dropping a message we can route.
      expect(alert.title, isNotEmpty);
      expect(alert.body, isEmpty);
    });

    test('ignores a message that is not a spike alert', () {
      // Navigating somewhere on an unrecognised message would be worse
      // than doing nothing.
      expect(
        AlertMessage.from(spike(data: const {'kind': 'promo', 'slug': 'x'})),
        isNull,
      );
      expect(AlertMessage.from(spike(data: const {'slug': 'x'})), isNull);
    });

    test('ignores a spike with no usable slug', () {
      expect(AlertMessage.from(spike(data: const {'kind': 'spike'})), isNull);
      expect(
        AlertMessage.from(spike(data: const {'kind': 'spike', 'slug': ''})),
        isNull,
      );
    });

    test('ignores nothing at all', () {
      // getInitialMessage returns null on a normal cold start.
      expect(AlertMessage.from(null), isNull);
    });
  });
}
