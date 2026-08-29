/// Home screen — single clean search input.
///
/// The user types any celebrity name and taps Search. No auto-
/// complete, no pre-filled values, no cycling placeholder names.
/// After previous searches, a "Recent searches" section appears
/// below with the user's own Hive-cached queries as chips.
library;

import 'package:cached_network_image/cached_network_image.dart';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:crititrack/features/search/domain/search_suggestions.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/theme/theme_toggle.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/search/presentation/providers/search_providers.dart';
import 'package:crititrack/features/account/presentation/widgets/account_tile.dart';
import 'package:crititrack/features/privacy/presentation/widgets/delete_data_tile.dart';
import 'package:crititrack/features/watchlist/domain/watched_figure.dart';
import 'package:crititrack/features/watchlist/presentation/providers/watchlist_providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  /// Long enough that typing a name does not recompute on every
  /// keystroke, short enough that the list feels attached to the field.
  static const _debounceWindow = Duration(milliseconds: 220);

  Timer? _debounce;
  List<SearchSuggestion> _suggestions = const [];

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(_debounceWindow, () {
      if (!mounted) return;
      setState(() {
        _suggestions = suggestionsFor(
          query: value,
          watched: ref.read(watchlistProvider).map((f) => f.name),
          recent: ref.read(recentSearchesProvider),
        );
      });
    });
  }

  void _acceptSuggestion(String name) {
    _debounce?.cancel();
    setState(() => _suggestions = const []);
    _controller.text = name;
    _focusNode.unfocus();
    _search();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// Dispatches the exact user-entered string to the dashboard.
  void _search() {
    final query = _controller.text.trim();
    if (query.isEmpty) return;

    // Save to recent searches (Hive only)
    ref.read(searchRepositoryProvider).addSearch(query);

    // Navigate to dashboard with the user's slug
    final slug = toSlug(query);
    context.go('/dashboard/$slug');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final recents = ref.watch(recentSearchesProvider);

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            // Soft brand wash behind the hero, so the page reads as a
            // designed surface rather than a flat background.
            Positioned(
              top: -140,
              left: -80,
              right: -80,
              height: 380,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      AppTheme.primary.withValues(alpha: 0.20),
                      AppTheme.primary.withValues(alpha: 0.0),
                    ],
                  ),
                ),
              ),
            ),
            Align(
              alignment: Alignment.topRight,
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    _AlertsButton(),
                    SizedBox(width: 2),
                    ThemeToggle(),
                  ],
                ),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 48,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // ── Logo ──────────────────────────────────────────
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        gradient: AppTheme.primaryGradient,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: palette.glowShadow,
                      ),
                      child: const Icon(
                        Icons.insights_rounded,
                        color: Colors.white,
                        size: 40,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ── Title ─────────────────────────────────────────
                    Text(
                      'Celeb Sentiment Tracker',
                      style: theme.textTheme.headlineLarge,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'AI-powered celebrity intelligence',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: palette.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 40),

                    // ── Search Field ──────────────────────────────────
                    Container(
                      constraints: const BoxConstraints(maxWidth: 500),
                      decoration: BoxDecoration(
                        color: palette.card,
                        borderRadius: AppTheme.radiusLg,
                        border: Border.all(color: palette.border),
                        boxShadow: palette.softShadow,
                      ),
                      child: TextField(
                        controller: _controller,
                        focusNode: _focusNode,
                        onChanged: _onQueryChanged,
                        onSubmitted: (_) => _search(),
                        textInputAction: TextInputAction.search,
                        style: theme.textTheme.bodyLarge,
                        decoration: InputDecoration(
                          hintText: 'Enter a celebrity name...',
                          hintStyle: theme.textTheme.bodyLarge?.copyWith(
                            color: palette.textMuted,
                          ),
                          filled: false,
                          prefixIcon: Icon(
                            Icons.search_rounded,
                            color: palette.textMuted,
                          ),
                          suffixIcon: AnimatedBuilder(
                            animation: _controller,
                            builder: (_, __) {
                              if (_controller.text.isEmpty) {
                                return const SizedBox.shrink();
                              }
                              return IconButton(
                                icon: Icon(
                                  Icons.clear_rounded,
                                  color: palette.textMuted,
                                ),
                                tooltip: 'Clear search',
                                onPressed: () {
                                  _controller.clear();
                                  _focusNode.requestFocus();
                                },
                              );
                            },
                          ),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 16,
                          ),
                        ),
                      ),
                    ),
                    if (_suggestions.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      _Suggestions(
                        suggestions: _suggestions,
                        onSelected: _acceptSuggestion,
                      ),
                    ],
                    const SizedBox(height: 16),

                    // ── Search Button ─────────────────────────────────
                    Container(
                      constraints: const BoxConstraints(maxWidth: 500),
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _search,
                        icon: const Icon(Icons.insights_rounded, size: 20),
                        label: const Text('Analyze'),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    // ── Privacy ──────────────────────────────────────
                    // Placed at the foot of the screen: reachable without
                    // hunting, but not competing with the primary action.
                    const _PrivacySection(),

                    // ── Watchlist ─────────────────────────────────────
                    // Above recents: someone who has followed a figure
                    // came back for them, not for their search history.
                    const _WatchlistSection(),

                    // ── Recent Searches ───────────────────────────────
                    if (recents.isNotEmpty) ...[
                      Container(
                        constraints: const BoxConstraints(maxWidth: 500),
                        alignment: Alignment.centerLeft,
                        child: Row(
                          children: [
                            Icon(
                              Icons.history_rounded,
                              size: 16,
                              color: palette.textMuted,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Recent searches',
                              style: theme.textTheme.labelLarge,
                            ),
                            const Spacer(),
                            TextButton(
                              onPressed: () {
                                ref
                                    .read(searchRepositoryProvider)
                                    .clearSearches();
                                ref.invalidate(recentSearchesProvider);
                              },
                              child: const Text('Clear'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        constraints: const BoxConstraints(maxWidth: 500),
                        alignment: Alignment.centerLeft,
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children:
                              recents.map((query) {
                                return ActionChip(
                                  label: Text(query),
                                  avatar: const Icon(
                                    Icons.person_search_rounded,
                                    size: 16,
                                  ),
                                  onPressed: () {
                                    _controller.text = query;
                                    _search();
                                  },
                                );
                              }).toList(),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Workaround: AnimatedBuilder is just a ListenableBuilder that
/// triggers rebuilds when the TextEditingController changes.
class AnimatedBuilder extends StatelessWidget {
  const AnimatedBuilder({
    super.key,
    required this.animation,
    required this.builder,
  });

  final Listenable animation;
  final Widget Function(BuildContext, Widget?) builder;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(listenable: animation, builder: builder);
  }
}

/// The figures the user follows, shown on the home screen.
///
/// Renders nothing at all when empty rather than an empty-state box —
/// a first-time user has not failed at anything, and the search field is
/// already the obvious next action.
class _WatchlistSection extends ConsumerWidget {
  const _WatchlistSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final figures = ref.watch(watchlistProvider);

    if (figures.isEmpty) return const SizedBox.shrink();

    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      margin: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bookmark_rounded, size: 16, color: palette.brandText),
              const SizedBox(width: 8),
              Text('Watchlist', style: theme.textTheme.labelLarge),
              const Spacer(),
              Text('${figures.length}', style: theme.textTheme.labelSmall),
            ],
          ),
          const SizedBox(height: 10),
          ...figures.map((f) => _WatchRow(figure: f)),
        ],
      ),
    );
  }
}

class _WatchRow extends ConsumerWidget {
  const _WatchRow({required this.figure});

  final WatchedFigure figure;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final score = figure.lastScore;

    return Semantics(
      button: true,
      label: 'Open ${figure.name}',
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: palette.elevated,
          borderRadius: AppTheme.radiusMd,
          border: Border.all(color: palette.border),
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: AppTheme.radiusMd,
            onTap: () => context.go('/dashboard/${figure.slug}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  _Avatar(imageUrl: figure.imageUrl, name: figure.name),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      figure.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.titleSmall?.copyWith(
                        color: palette.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (score != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: sentimentColor(score).withValues(alpha: 0.15),
                        borderRadius: AppTheme.radiusSm,
                      ),
                      child: Text(
                        score.toStringAsFixed(0),
                        style: TextStyle(
                          color: sentimentColor(score),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: 4),
                  ],
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 16),
                    tooltip: 'Remove ${figure.name} from watchlist',
                    visualDensity: VisualDensity.compact,
                    onPressed:
                        () => ref
                            .read(watchlistProvider.notifier)
                            .remove(figure.slug),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, this.imageUrl});

  final String name;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;

    final fallback = Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppTheme.primary.withValues(alpha: 0.15),
        shape: BoxShape.circle,
      ),
      child: Text(
        name.isNotEmpty ? name.characters.first.toUpperCase() : '?',
        style: TextStyle(
          color: palette.brandText,
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
    );

    if (imageUrl == null || imageUrl!.isEmpty) return fallback;

    return ClipOval(
      child: SizedBox(
        width: 32,
        height: 32,
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

/// Entry point to alert settings.
///
/// In the header rather than inside the collapsed privacy section,
/// because a control the user is expected to find has to be visible
/// without opening anything.
class _AlertsButton extends StatelessWidget {
  const _AlertsButton();

  @override
  Widget build(BuildContext context) {
    // 48dp explicitly: the icon alone is 40dp, which fails the tap-target
    // guard in the accessibility tests.
    return SizedBox(
      width: 48,
      height: 48,
      child: IconButton(
        icon: Icon(
          Icons.notifications_none_rounded,
          color: context.palette.textSecondary,
        ),
        tooltip: 'Alert settings',
        onPressed: () => context.push('/alerts'),
      ),
    );
  }
}

/// Data controls, kept deliberately plain.
///
/// The delete action is what makes the privacy policy's promise real, so
/// it lives in the app rather than only in a document nobody reads.
class _PrivacySection extends StatelessWidget {
  const _PrivacySection();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      margin: const EdgeInsets.only(bottom: 28),
      child: Theme(
        // A plain ExpansionTile divider fights the card borders used
        // everywhere else on this screen.
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: EdgeInsets.zero,
          leading: Icon(
            Icons.privacy_tip_outlined,
            size: 18,
            color: palette.textSecondary,
          ),
          title: Text('Your data', style: theme.textTheme.labelLarge),
          subtitle: Text(
            'No account, no tracking',
            style: theme.textTheme.bodySmall?.copyWith(
              color: palette.textMuted,
            ),
          ),
          children: [
            Container(
              decoration: BoxDecoration(
                color: palette.elevated,
                borderRadius: AppTheme.radiusMd,
                border: Border.all(color: palette.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                    child: Text(
                      'CritiTrack asks for no name, email or phone number, '
                      'runs no advertising and uses no tracking SDK. Your '
                      'searches stay on this device; your watchlist syncs '
                      'under an anonymous identifier.',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: palette.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ),
                  // Above the delete control, because it is the
                  // additive choice and the destructive one should not be
                  // the first thing offered.
                  const AccountTile(),
                  Divider(height: 1, color: palette.border),
                  const DeleteDataTile(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}


/// Names the device already knows, offered as you type.
///
/// Drawn from the watchlist and this device's own search history — both
/// local, so the list costs nothing and works offline. There is no
/// "trending" row: producing one honestly needs a backend ranking what
/// people are actually looking up, and a hard-coded list of famous names
/// dressed as trending would be a claim about other users that nothing
/// measured.
class _Suggestions extends StatelessWidget {
  const _Suggestions({required this.suggestions, required this.onSelected});

  final List<SearchSuggestion> suggestions;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;

    return Container(
      constraints: const BoxConstraints(maxWidth: 500),
      decoration: BoxDecoration(
        color: palette.card,
        borderRadius: AppTheme.radiusMd,
        border: Border.all(color: palette.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final suggestion in suggestions)
            Semantics(
              button: true,
              label: suggestion.kind == SuggestionKind.watched
                  ? 'Search ${suggestion.name}, on your watchlist'
                  : 'Search ${suggestion.name}, a recent search',
              excludeSemantics: true,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => onSelected(suggestion.name),
                  child: Container(
                    // 48dp minimum tap target, matching the guards in
                    // accessibility_test.dart.
                    constraints: const BoxConstraints(minHeight: 48),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Row(
                      children: [
                        Icon(
                          suggestion.kind == SuggestionKind.watched
                              ? Icons.star_rounded
                              : Icons.history_rounded,
                          size: 16,
                          color: suggestion.kind == SuggestionKind.watched
                              ? AppTheme.warning
                              : palette.textMuted,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            suggestion.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: palette.textPrimary,
                            ),
                          ),
                        ),
                        Icon(
                          Icons.north_west_rounded,
                          size: 14,
                          color: palette.textMuted,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
