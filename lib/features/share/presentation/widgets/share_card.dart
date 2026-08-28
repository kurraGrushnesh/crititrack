/// The image a user shares.
///
/// This is the one artefact that travels without the app around it, so it
/// has to carry its own context: who the figure is, what the numbers mean,
/// when they were measured, and that they are algorithmically assessed.
/// A bare score screenshotted out of context is exactly what the editorial
/// policy exists to prevent.
///
/// Laid out at a fixed logical size rather than the screen's, so the
/// exported PNG is identical on every device. The renderer scales it up;
/// nothing here depends on the viewport.
///
/// Colours are literal rather than theme-derived: an exported image must
/// look the same regardless of the viewer's appearance setting at the
/// moment they tapped share.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import 'package:crititrack/core/domain/models/celebrity.dart';
import 'package:crititrack/core/utils/controversy_index.dart';
import 'package:crititrack/core/utils/helpers.dart';

/// Logical size of the card. 4:5 — the tallest common ratio that is not
/// cropped where these get posted.
const Size shareCardSize = Size(360, 450);

const _bg = Color(0xFF0E1119);
const _surface = Color(0xFF181C29);
const _border = Color(0xFF2A3145);
const _textPrimary = Color(0xFFF2F4FA);
const _textSecondary = Color(0xFFA6AEC4);
const _textMuted = Color(0xFF7C859B);
const _brand = Color(0xFF8B7CFF);

class ShareCard extends StatelessWidget {
  const ShareCard({super.key, required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    final s = celebrity.sentimentData;
    final index = computeControversyIndex(celebrity.biography.controversies);

    return SizedBox(
      width: shareCardSize.width,
      height: shareCardSize.height,
      child: DecoratedBox(
        decoration: const BoxDecoration(color: _bg),
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Header(celebrity: celebrity),
              const SizedBox(height: 18),

              // The two headline numbers, side by side, each labelled with
              // what it actually measures rather than a bare figure.
              // IntrinsicHeight so the two metric cards match heights.
              // `stretch` alone fails here: a Row is unbounded vertically
              // inside a Column, and stretching to an unbounded height
              // produces invalid constraints.
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: _Metric(
                        label: 'Sentiment',
                        value: s.overallScore.toStringAsFixed(0),
                        caption:
                            s.hasConfidence
                                ? 'likely ${s.scoreLow!.toStringAsFixed(0)}'
                                    '–${s.scoreHigh!.toStringAsFixed(0)}'
                                : sentimentLabel(s.overallScore),
                        color: sentimentColor(s.overallScore),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _Metric(
                        label: 'Controversy index',
                        value: '${index.rounded}',
                        caption: index.label,
                        color: _indexColor(index.score),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              Expanded(child: _Breakdown(celebrity: celebrity, index: index)),

              const SizedBox(height: 12),
              _Footer(fetchedAt: celebrity.fetchedAt),
            ],
          ),
        ),
      ),
    );
  }

  static Color _indexColor(double score) {
    if (score < 35) return const Color(0xFF3FD5A0);
    if (score < 55) return const Color(0xFFE3BE5C);
    if (score < 75) return const Color(0xFFF0975A);
    return const Color(0xFFFF7A66);
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.celebrity});

  final Celebrity celebrity;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _Portrait(imageUrl: celebrity.imageUrl, name: celebrity.name),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                celebrity.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                celebrity.biography.profession,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: _textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Portrait extends StatelessWidget {
  const _Portrait({required this.name, this.imageUrl});

  final String name;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: 54,
      height: 54,
      alignment: Alignment.center,
      decoration: const BoxDecoration(
        color: Color(0xFF232A3C),
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isNotEmpty ? name.characters.first.toUpperCase() : '?',
        style: const TextStyle(
          color: _brand,
          fontSize: 22,
          fontWeight: FontWeight.w800,
        ),
      ),
    );

    if (imageUrl == null || imageUrl!.isEmpty) return fallback;

    return Container(
      width: 54,
      height: 54,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: _border, width: 2),
      ),
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          fit: BoxFit.cover,
          placeholder: (_, __) => fallback,
          errorWidget: (_, __, ___) => fallback,
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({
    required this.label,
    required this.value,
    required this.caption,
    required this.color,
  });

  final String label;
  final String value;
  final String caption;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: _textMuted,
              fontSize: 8,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 34,
              fontWeight: FontWeight.w800,
              height: 1,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            caption,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: _textSecondary, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

/// The supporting detail: what the controversy record actually contains.
///
/// Without this the card is two numbers and a name, which is precisely the
/// decontextualised artefact the policy warns about.
class _Breakdown extends StatelessWidget {
  const _Breakdown({required this.celebrity, required this.index});

  final Celebrity celebrity;
  final ControversyIndex index;

  @override
  Widget build(BuildContext context) {
    final controversies = celebrity.biography.controversies;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            controversies.isEmpty
                ? 'NO DOCUMENTED CONTROVERSIES'
                : '${index.total} EPISODE${index.total == 1 ? '' : 'S'} TRACKED',
            style: const TextStyle(
              color: _textMuted,
              fontSize: 8,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.9,
            ),
          ),
          const SizedBox(height: 8),
          if (controversies.isEmpty)
            const Text(
              'No significant, well-documented episodes were found in '
              'public reporting.',
              style: TextStyle(
                color: _textSecondary,
                fontSize: 11,
                height: 1.45,
              ),
            )
          else
            // Only the top few — the card is a pointer to the full record,
            // not a replacement for it.
            ...(<Widget>[
              for (final c in _topThree(controversies))
                Padding(
                  padding: const EdgeInsets.only(bottom: 7),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 18,
                        height: 18,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: _severityColor(
                            c.severity,
                          ).withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(5),
                        ),
                        child: Text(
                          '${c.severity}',
                          style: TextStyle(
                            color: _severityColor(c.severity),
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          c.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: _textPrimary,
                            fontSize: 11,
                            height: 1.3,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      if (c.year != null) ...[
                        const SizedBox(width: 6),
                        Text(
                          '${c.year}',
                          style: const TextStyle(
                            color: _textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              if (controversies.length > 3)
                Text(
                  '+${controversies.length - 3} more in the app',
                  style: const TextStyle(color: _textMuted, fontSize: 10),
                ),
            ]),
        ],
      ),
    );
  }

  static List<dynamic> _topThree(List<dynamic> all) {
    final sorted = [...all]
      ..sort((a, b) => (b.severity as int).compareTo(a.severity as int));
    return sorted.take(3).toList();
  }

  static Color _severityColor(int severity) {
    if (severity <= 1) return const Color(0xFFE3BE5C);
    if (severity == 2) return const Color(0xFFEFB05B);
    if (severity == 3) return const Color(0xFFF0975A);
    if (severity == 4) return const Color(0xFFF07E63);
    return const Color(0xFFFF7A66);
  }
}

/// Provenance. Non-negotiable: the card is the artefact most likely to be
/// seen by someone who never opens the app, so the disclaimer travels with
/// it rather than living behind a tap.
class _Footer extends StatelessWidget {
  const _Footer({required this.fetchedAt});

  final DateTime fetchedAt;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'CritiTrack',
                style: TextStyle(
                  color: _brand,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'Algorithmically assessed from public reporting · '
                '${_date(fetchedAt)}',
                maxLines: 2,
                style: const TextStyle(
                  color: _textMuted,
                  fontSize: 8.5,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static String _date(DateTime d) {
    final u = d.toUtc();
    final m = u.month.toString().padLeft(2, '0');
    final day = u.day.toString().padLeft(2, '0');
    return '${u.year}-$m-$day';
  }
}
