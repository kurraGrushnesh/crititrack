/// Renders a [ShareCard] to PNG bytes and hands it to the platform.
///
/// The card is mounted off-screen in an overlay rather than shown to the
/// user: `Offstage` and `Visibility` skip painting entirely, so a boundary
/// inside one has nothing to capture. Positioning it far outside the
/// viewport keeps it in the paint pipeline while staying invisible.
///
/// The portrait is pre-cached before capture. Without that the boundary is
/// painted while the image is still in flight and the exported card ships
/// with a placeholder where the face should be — a bug that only appears
/// on a cold cache, which is exactly when a first-time user shares.
library;

import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:share_plus/share_plus.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/export/celebrity_export.dart';
import 'package:crititrack/features/share/presentation/widgets/share_card.dart';

abstract final class ShareCardRenderer {
  /// Scale applied to [shareCardSize]. 3 gives 1080x1350 — enough for a
  /// phone screen at full width without producing a needlessly large file.
  static const double pixelRatio = 3.0;

  /// Renders the card for [celebrity] and opens the platform share sheet.
  ///
  /// Returns false when the card could not be produced, so the caller can
  /// tell the user rather than appearing to succeed silently.
  static Future<bool> share(BuildContext context, Celebrity celebrity) async {
    final bytes = await render(context, celebrity);
    if (bytes == null) return false;

    final file = XFile.fromData(
      bytes,
      mimeType: 'image/png',
      name: '${CelebrityExport.fileStem(celebrity)}.png',
    );

    await SharePlus.instance.share(
      ShareParams(
        files: [file],
        text:
            '${celebrity.name} on CritiTrack — sentiment '
            '${celebrity.sentimentData.overallScore.toStringAsFixed(0)}/100. '
            'Scores are algorithmically assessed from public reporting.',
      ),
    );
    return true;
  }

  /// Renders the card to PNG bytes, or null if anything went wrong.
  static Future<Uint8List?> render(
    BuildContext context,
    Celebrity celebrity,
  ) async {
    final overlay = Overlay.maybeOf(context);
    if (overlay == null) return null;

    await _precachePortrait(context, celebrity.imageUrl);
    if (!context.mounted) return null;

    final key = GlobalKey();
    final entry = OverlayEntry(
      builder:
          (_) => Positioned(
            // Far outside any plausible viewport, but still painted.
            left: -20000,
            top: -20000,
            child: RepaintBoundary(
              key: key,
              child: MediaQuery(
                // The card is a fixed-size artefact: a viewer who has scaled
                // their system text up must not get a different image.
                data: const MediaQueryData(textScaler: TextScaler.noScaling),
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: ShareCard(celebrity: celebrity),
                ),
              ),
            ),
          ),
    );

    overlay.insert(entry);
    try {
      // Two frames: one to lay the card out, one to be sure it painted.
      await _nextFrame();
      await _nextFrame();

      final object = key.currentContext?.findRenderObject();
      if (object is! RenderRepaintBoundary) return null;
      // Awaited, not returned: the finally below removes the overlay, and
      // an unawaited capture would race it — the boundary would be gone
      // before the encode read it.
      return await capture(object);
    } catch (e, st) {
      debugPrint('Share card render failed: $e\n$st');
      return null;
    } finally {
      entry.remove();
    }
  }

  /// Encodes an already-laid-out boundary to PNG bytes.
  ///
  /// Separated from [render] so the image production can be tested
  /// directly. [render]'s job is mounting a boundary off-screen and
  /// waiting for frames, which a widget test cannot drive while awaiting
  /// it; this half is where anything can actually go wrong.
  static Future<Uint8List?> capture(RenderRepaintBoundary boundary) async {
    final image = await boundary.toImage(pixelRatio: pixelRatio);
    try {
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      return data?.buffer.asUint8List();
    } finally {
      image.dispose();
    }
  }

  /// Best effort: a missing portrait falls back to the initial glyph, so a
  /// failure here must not stop the card being produced.
  static Future<void> _precachePortrait(
    BuildContext context,
    String? imageUrl,
  ) async {
    if (imageUrl == null || imageUrl.isEmpty) return;
    try {
      await precacheImage(
        CachedNetworkImageProvider(imageUrl),
        context,
      ).timeout(const Duration(seconds: 6));
    } catch (e) {
      debugPrint('Portrait pre-cache skipped: $e');
    }
  }

  static Future<void> _nextFrame() {
    final completer = Completer<void>();
    WidgetsBinding.instance.addPostFrameCallback((_) => completer.complete());
    // A frame is only guaranteed if one is actually scheduled.
    WidgetsBinding.instance.scheduleFrame();
    return completer.future;
  }
}
