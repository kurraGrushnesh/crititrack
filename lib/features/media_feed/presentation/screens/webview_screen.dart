/// In-app WebView screen for opening media URLs.
///
/// Uses [webview_flutter] on mobile platforms and falls back to a
/// URL display + external launch prompt on web (where WebView is
/// not supported).
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'package:celeb_sentiment_tracker/core/theme/app_theme.dart';

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key, required this.url, required this.title});

  final String url;
  final String title;

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController? _controller;
  bool _isLoading = true;
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    if (!kIsWeb && widget.url.isNotEmpty) {
      _controller =
          WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setNavigationDelegate(
              NavigationDelegate(
                onProgress: (progress) {
                  setState(() => _progress = progress / 100.0);
                },
                onPageStarted: (_) {
                  setState(() => _isLoading = true);
                },
                onPageFinished: (_) {
                  setState(() => _isLoading = false);
                },
              ),
            )
            ..loadRequest(Uri.parse(widget.url));
    } else {
      _controller = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        leading: IconButton(
          icon: const Icon(Icons.close_rounded),
          onPressed: () => GoRouter.of(context).pop(),
        ),
        bottom:
            _isLoading
                ? PreferredSize(
                  preferredSize: const Size.fromHeight(2),
                  child: LinearProgressIndicator(
                    value: _progress,
                    backgroundColor: AppTheme.surfaceElevated,
                    valueColor: const AlwaysStoppedAnimation(AppTheme.primary),
                  ),
                )
                : null,
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    final ctrl = _controller;
    if (kIsWeb || ctrl == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.open_in_browser_rounded,
                size: 48,
                color: AppTheme.primary,
              ),
              const SizedBox(height: 16),
              Text('Open in Browser', style: theme.textTheme.titleLarge),
              const SizedBox(height: 8),
              SelectableText(
                widget.url,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: AppTheme.primary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Text(
                'WebView is not available on web platform.\nCopy the URL above to open externally.',
                style: theme.textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }
    return WebViewWidget(controller: ctrl);
  }
}
