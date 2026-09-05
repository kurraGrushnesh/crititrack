/// Advanced Compare — entry point. Resolves two names using the exact
/// same `dashboardProvider(slug)` every other screen uses (Firestore-
/// first, proxy-backed), so an already-viewed entity is served from
/// cache rather than refetched.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:crititrack/core/utils/helpers.dart';
import 'package:crititrack/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:crititrack/features/research/presentation/providers/compare_providers.dart';

class CompareCreateScreen extends ConsumerStatefulWidget {
  const CompareCreateScreen({super.key});

  @override
  ConsumerState<CompareCreateScreen> createState() => _CompareCreateScreenState();
}

class _CompareCreateScreenState extends ConsumerState<CompareCreateScreen> {
  final _controllerA = TextEditingController();
  final _controllerB = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _controllerA.dispose();
    _controllerB.dispose();
    super.dispose();
  }

  Future<void> _compare() async {
    final nameA = _controllerA.text.trim();
    final nameB = _controllerB.text.trim();
    if (nameA.isEmpty || nameB.isEmpty) return;

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final slugA = toSlug(nameA);
      final slugB = toSlug(nameB);
      final celebrityA = await ref.read(dashboardProvider(slugA).future);
      final celebrityB = await ref.read(dashboardProvider(slugB).future);

      if (celebrityA.candidates.isNotEmpty || celebrityB.candidates.isNotEmpty) {
        setState(() {
          _error = 'One of these names matches more than one real person. Open each profile on its own '
              'first to pick the right one, then compare using their exact names.';
        });
        return;
      }

      final idA = celebrityA.wikidataId ?? celebrityA.slug;
      final idB = celebrityB.wikidataId ?? celebrityB.slug;
      final comparison = await ref
          .read(savedComparisonsProvider.notifier)
          .create(entityIds: [idA, idB], entityNames: [celebrityA.name, celebrityB.name]);
      if (mounted) context.push('/advanced-compare/${comparison.comparisonId}');
    } catch (_) {
      setState(() {
        _error = 'Could not resolve one of these names. Check the spelling and try again.';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Compare')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Puts two resolved entities side by side using CritiScore, sentiment, career, '
            'controversies, claims, and data coverage. Describes real differences — never ranks '
            'who is "better".',
          ),
          const SizedBox(height: 20),
          TextField(controller: _controllerA, decoration: const InputDecoration(labelText: 'Entity A')),
          const SizedBox(height: 12),
          TextField(controller: _controllerB, decoration: const InputDecoration(labelText: 'Entity B')),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _compare,
            child: _busy ? const CircularProgressIndicator() : const Text('Compare'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 16),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
        ],
      ),
    );
  }
}
