/// Path-based URLs on the web.
library;

import 'package:flutter_web_plugins/url_strategy.dart';

/// Switches the web app from hash URLs to real paths.
///
/// Flutter web defaults to the hash strategy, so the router only ever
/// looks at the fragment: `/app/#/dashboard/taylor-swift`. A visitor
/// arriving at `/app/dashboard/taylor-swift` — from a shared link, a
/// bookmark, or the `/c/<slug>` short URL the share cards use — was
/// silently dropped on the home screen, because as far as the router was
/// concerned there was no route in the URL at all.
///
/// Hosting already rewrites `/app/**` to the app's index, so the server
/// side of this was in place and only the client was not reading it.
void configureUrlStrategy() => usePathUrlStrategy();
