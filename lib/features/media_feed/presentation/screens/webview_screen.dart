/// In-app WebView for opening a media link.
///
/// Links arrive from third-party APIs and the language model, so the URL
/// is validated before it is loaded and every navigation away from it is
/// re-checked against the same policy (SEC-06). Anything that fails is
/// shown as a blocked state rather than opened.
///
/// On web, where `webview_flutter` has no implementation, the URL is
/// displayed for the user to open themselves.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:crititrack/core/security/safe_url.dart';
import 'package:crititrack/core/theme/app_theme.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  WebViewController? _controller;
  bool _isLoading = true;
  double _progress = 0;

  /// The validated URL, or null when the link was rejected.
  Uri? _target;

  /// Set when a navigation was refused, so the user is told rather than
  /// left looking at a page that silently stopped loading.
  bool _wasRedirectBlocked = false;

  @override
  void initState() {
    super.initState();
    _target = SafeUrl.parse(widget.url);

    final target = _target;
    if (kIsWeb || target == null) return;

    _controller =
        WebViewController()
          // Third-party pages we did not author run in this context, so
          // scripting stays off unless a page demonstrably needs it.
          ..setJavaScriptMode(JavaScriptMode.disabled)
          ..setNavigationDelegate(
            NavigationDelegate(
              onNavigationRequest: (request) {
                if (SafeUrl.parse(request.url) != null) {
                  return NavigationDecision.navigate;
                }
                // A redirect chain must not be able to escape the policy
                // the first URL was held to.
                if (mounted) {
                  setState(() {
                    _wasRedirectBlocked = true;
                    _isLoading = false;
                  });
                }
                return NavigationDecision.prevent;
              },
              onProgress: (progress) {
                if (mounted) setState(() => _progress = progress / 100.0);
              },
              onPageStarted: (_) {
                if (mounted) setState(() => _isLoading = true);
              },
              onPageFinished: (_) {
                if (mounted) setState(() => _isLoading = false);
              },
              onWebResourceError: (_) {
                if (mounted) setState(() => _isLoading = false);
              },
            ),
          )
          ..loadRequest(target);
  }

  Future<void> _openExternally() async {
    final target = _target;
    if (target == null) return;
    if (await canLaunchUrl(target)) {
      await launchUrl(target, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final palette = context.palette;
    final host = SafeUrl.displayHost(widget.url);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.titleMedium,
            ),
            if (host.isNotEmpty)
              Text(
                host,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.labelSmall,
              ),
          ],
        ),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          tooltip: 'Close',
          onPressed: () => GoRouter.of(context).pop(),
        ),
        actions: [
          if (_target != null)
            IconButton(
              icon: const Icon(Icons.open_in_new_rounded),
              tooltip: 'Open in browser',
              onPressed: _openExternally,
            ),
        ],
        bottom:
            _isLoading && _target != null && !_wasRedirectBlocked
                ? PreferredSize(
                  preferredSize: const Size.fromHeight(2),
                  child: LinearProgressIndicator(
                    value: _progress,
                    backgroundColor: palette.elevated,
                    valueColor: AlwaysStoppedAnimation(
                      theme.colorScheme.primary,
                    ),
                  ),
                )
                : null,
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_target == null) return _blocked(theme);
    if (_wasRedirectBlocked) return _blocked(theme, redirected: true);

    final ctrl = _controller;
    if (kIsWeb || ctrl == null) return _openExternallyPrompt(theme);
    return WebViewWidget(controller: ctrl);
  }

  /// Shown when the link was rejected outright, or when a redirect tried
  /// to leave the allowed policy.
  Widget _blocked(ThemeData theme, {bool redirected = false}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.gpp_maybe_rounded,
              size: 48,
              color: theme.colorScheme.error,
            ),
            const SizedBox(height: 16),
            Text('This link was not opened', style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(
              redirected
                  ? 'The page tried to send you somewhere CritiTrack does '
                      'not open. Only secure https pages are allowed.'
                  : 'CritiTrack only opens secure https links, and this one '
                      'is not.',
              style: theme.textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            OutlinedButton.icon(
              onPressed: () => GoRouter.of(context).pop(),
              icon: const Icon(Icons.arrow_back_rounded, size: 18),
              label: const Text('Go back'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _openExternallyPrompt(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.open_in_browser_rounded,
              size: 48,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            Text('Open in your browser', style: theme.textTheme.titleLarge),
            const SizedBox(height: 8),
            SelectableText(
              _target.toString(),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: _openExternally,
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: const Text('Open'),
            ),
          ],
        ),
      ),
    );
  }
}
