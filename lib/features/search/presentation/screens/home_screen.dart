/// Home screen — single clean search input.
///
/// The user types any celebrity name and taps Search. No auto-
/// complete, no pre-filled values, no cycling placeholder names.
/// After previous searches, a "Recent searches" section appears
/// below with the user's own Hive-cached queries as chips.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/theme/app_theme.dart';
import 'package:crititrack/core/theme/theme_toggle.dart';
import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/search/presentation/providers/search_providers.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _controller = TextEditingController();
  final _focusNode = FocusNode();

  @override
  void dispose() {
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
                child: const ThemeToggle(),
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
