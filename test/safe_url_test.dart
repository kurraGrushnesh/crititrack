// SEC-06: links arrive from third-party APIs and the language model and
// are handed to an in-app WebView, so the scheme policy is enforced here.
import 'package:flutter_test/flutter_test.dart';

import 'package:crititrack/core/security/safe_url.dart';

void main() {
  group('SafeUrl.parse accepts', () {
    test('ordinary https article links', () {
      for (final url in [
        'https://example.com',
        'https://www.bbc.co.uk/news/article-123',
        'https://youtube.com/watch?v=abc123',
        'https://example.com:8443/path?q=1#frag',
      ]) {
        expect(SafeUrl.parse(url), isNotNull, reason: url);
      }
    });

    test('a link with surrounding whitespace', () {
      expect(SafeUrl.parse('  https://example.com  '), isNotNull);
    });
  });

  group('SafeUrl.parse rejects', () {
    test('script and data schemes', () {
      for (final url in [
        'javascript:alert(1)',
        'JavaScript:alert(1)',
        'data:text/html;base64,PHNjcmlwdD4=',
        'blob:https://example.com/uuid',
        'vbscript:msgbox(1)',
      ]) {
        expect(SafeUrl.parse(url), isNull, reason: url);
      }
    });

    test('local and app schemes', () {
      for (final url in [
        'file:///etc/passwd',
        'content://media/external/images/1',
        'intent://scan#Intent;scheme=zxing;end',
        'about:blank',
      ]) {
        expect(SafeUrl.parse(url), isNull, reason: url);
      }
    });

    test('plain http, which is downgrade-prone', () {
      expect(SafeUrl.parse('http://example.com'), isNull);
    });

    test('embedded credentials, a phishing signal', () {
      // Renders as the trusted host in a truncated URL bar but resolves
      // to the attacker's.
      expect(SafeUrl.parse('https://apple.com@evil.example'), isNull);
      expect(SafeUrl.parse('https://user:pw@example.com'), isNull);
    });

    test('URLs with no real host', () {
      for (final url in ['https://', 'https:///path', 'https', '']) {
        expect(SafeUrl.parse(url), isNull, reason: url);
      }
    });

    test('null and blank input', () {
      expect(SafeUrl.parse(null), isNull);
      expect(SafeUrl.parse('   '), isNull);
    });

    test('malformed input, without throwing', () {
      // Uri.parse raises on some of these; a bad link must not be able to
      // crash the screen that displays it.
      for (final url in ['https://exa mple.com', '://///', 'ht!tp://x']) {
        expect(() => SafeUrl.parse(url), returnsNormally, reason: url);
      }
    });
  });

  group('SafeUrl.displayHost', () {
    test('shows the host and drops a leading www.', () {
      expect(SafeUrl.displayHost('https://www.bbc.co.uk/news'), 'bbc.co.uk');
      expect(SafeUrl.displayHost('https://variety.com/x'), 'variety.com');
    });

    test('is empty for anything we would not open', () {
      expect(SafeUrl.displayHost('javascript:alert(1)'), '');
      expect(SafeUrl.displayHost('http://example.com'), '');
      expect(SafeUrl.displayHost(null), '');
    });
  });

  group('SafeUrl.isSafe', () {
    test('agrees with parse, so redirects are held to the same policy', () {
      expect(SafeUrl.isSafe(Uri.parse('https://example.com')), isTrue);
      expect(SafeUrl.isSafe(Uri.parse('http://example.com')), isFalse);
      expect(SafeUrl.isSafe(Uri.parse('javascript:alert(1)')), isFalse);
    });
  });
}
