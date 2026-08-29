/// Points from a cited fragment to the article it came from.
///
/// The sentiment panel and the media feed are separate widgets in one
/// scroll view, and neither knows about the other. This is the thing in
/// between: the feed registers an anchor for every row it builds, and the
/// panel asks for one to be brought into view.
///
/// Kept as shared state rather than a callback threaded through the
/// dashboard because the two sections sit in different columns on a wide
/// layout and in different slivers on a narrow one, so there is no common
/// parent close enough for a callback to be the simpler option.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The media item currently being pointed at, or null.
final mediaFocusProvider = NotifierProvider<MediaFocusController, String?>(
  MediaFocusController.new,
);

/// How long a highlighted row stays highlighted.
///
/// The highlight is a pointer, not a selection: it says "this one" and
/// then gets out of the way. Leaving it on would read as state the user
/// has to dismiss.
const Duration highlightDuration = Duration(seconds: 3);

class MediaFocusController extends Notifier<String?> {
  final Map<String, GlobalKey> _anchors = {};
  Timer? _clear;

  @override
  String? build() {
    ref.onDispose(() => _clear?.cancel());
    return null;
  }

  /// A stable key for the row rendering [id].
  ///
  /// Created on demand and kept, so the key survives the rebuilds caused
  /// by filtering — a fresh GlobalKey each build would detach and
  /// reattach the element and lose the scroll target mid-animation.
  GlobalKey anchorFor(String id) =>
      _anchors.putIfAbsent(id, () => GlobalKey(debugLabel: 'media-$id'));

  /// Scrolls the row for [id] into view and highlights it.
  Future<void> focus(String id) async {
    if (id.isEmpty) return;

    state = id;

    // Wait a frame before looking for the anchor. The feed clears its
    // own type filter in response to this state change, and the row may
    // not exist yet at the moment focus is requested — the anchor would
    // then have no context and the scroll would silently do nothing.
    await WidgetsBinding.instance.endOfFrame;

    final context = _anchors[id]?.currentContext;
    // `mounted` because a frame has passed since focus was requested: the
    // row can have been disposed in between, and scrolling to a dead
    // element throws.
    if (context != null && context.mounted) {
      await Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
        // Just below the top, so the row is not tucked under the pinned
        // app bar.
        alignment: 0.15,
      );
    }

    _clear?.cancel();
    _clear = Timer(highlightDuration, () {
      if (state == id) state = null;
    });
  }
}
