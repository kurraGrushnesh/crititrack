/// URL safety checks for links that did not originate with us (SEC-06).
///
/// Media links arrive from NewsAPI, YouTube and the language model, and
/// are then handed to an in-app WebView or an external browser. Loading
/// an unvalidated URL inside the app's own browsing context is how a
/// hostile or malformed link turns into script execution against the app.
///
/// The policy is deliberately narrow, because every legitimate link we
/// handle is an ordinary web page:
///
///   * `https` only — `http` is downgrade-prone, and `javascript:`,
///     `data:`, `file:`, `blob:`, `intent:` and friends have no business
///     being opened by a news reader.
///   * No embedded credentials, which are almost always a phishing
///     signal (`https://apple.com@evil.example`).
///   * A real host, so `https:///foo` and similar oddities are rejected.
library;

abstract final class SafeUrl {
  /// The only scheme we will ever open.
  static const String _scheme = 'https';

  /// Parses [raw] and returns it only if it is safe to open.
  ///
  /// Returns null for anything malformed or disallowed, so callers can
  /// render a blocked state instead of guessing. Never throws:
  /// `Uri.parse` raises on some malformed input, and a bad link must not
  /// be able to crash the screen that displays it.
  static Uri? parse(String? raw) {
    if (raw == null) return null;
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;

    final uri = Uri.tryParse(trimmed);
    if (uri == null) return null;

    return isSafe(uri) ? uri : null;
  }

  /// Whether [uri] may be opened.
  ///
  /// Used both before the first load and by the WebView's navigation
  /// delegate, so a redirect chain cannot escape the policy that the
  /// initial URL was held to.
  static bool isSafe(Uri uri) {
    if (uri.scheme.toLowerCase() != _scheme) return false;
    if (!uri.hasAuthority) return false;
    if (uri.host.isEmpty) return false;
    // "https://trusted.example@attacker.example" renders as the trusted
    // host in a truncated URL bar but resolves to the attacker's.
    if (uri.userInfo.isNotEmpty) return false;
    return true;
  }

  /// Host shown to the user, with a leading `www.` dropped. Empty when
  /// the URL is not one we would open.
  static String displayHost(String? raw) {
    final uri = parse(raw);
    if (uri == null) return '';
    final host = uri.host;
    return host.startsWith('www.') ? host.substring(4) : host;
  }
}
