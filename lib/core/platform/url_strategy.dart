/// Configures how routes appear in the address bar.
///
/// Resolved per platform at compile time: the web implementation switches
/// to path URLs, and everything else gets a no-op. A conditional import
/// rather than a direct one because `flutter_web_plugins` is a web-only
/// library, and this project cannot currently compile for Android to
/// prove that a direct import would be harmless there.
library;

export 'url_strategy_stub.dart'
    if (dart.library.js_interop) 'url_strategy_web.dart';
