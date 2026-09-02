import 'package:flutter/material.dart';

import 'package:crititrack/features/browse/presentation/screens/categories_screen.dart';

/// The Browse tab: an app bar over the category list. Category detail
/// opens as a pushed route so the back button returns here.
class BrowseScreen extends StatelessWidget {
  const BrowseScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Browse')),
      body: const SafeArea(child: CategoriesScreen()),
    );
  }
}
