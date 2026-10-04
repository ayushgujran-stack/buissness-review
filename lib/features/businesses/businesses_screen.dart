import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';

class BusinessesScreen extends ConsumerStatefulWidget {
  const BusinessesScreen({super.key});

  @override
  ConsumerState<BusinessesScreen> createState() => _BusinessesScreenState();
}

class _BusinessesScreenState extends ConsumerState<BusinessesScreen> {
  void _openAddBusinessDialog() {
    final nameCtrl = TextEditingController();
    final catCtrl = TextEditingController(text: 'Restaurant & Hospitality');
    final descCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    final stateCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceLight,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                top: 20,
                left: 20,
                right: 20,
              ),
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Create Business',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const Text(
                        'You can create unlimited businesses under your account.',
                        style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Business Name *'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Enter business name' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: catCtrl,
                        decoration: const InputDecoration(labelText: 'Category *'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Enter category' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: descCtrl,
                        decoration: const InputDecoration(labelText: 'Description'),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: cityCtrl,
                              decoration: const InputDecoration(labelText: 'City'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: stateCtrl,
                              decoration: const InputDecoration(labelText: 'State'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                if (!formKey.currentState!.validate()) return;
                                setModalState(() => isSaving = true);

                                final user = ref.read(currentUserProfileProvider).value;
                                if (user == null) return;

                                final now = DateTime.now().toUtc().toIso8601String();
                                final docRef = FirebaseFirestore.instance.collection('businesses').doc();

                                final newBiz = BusinessModel(
                                  id: docRef.id,
                                  ownerId: user.ownerId,
                                  name: nameCtrl.text.trim(),
                                  category: catCtrl.text.trim(),
                                  description: descCtrl.text.trim(),
                                  city: cityCtrl.text.trim(),
                                  state: stateCtrl.text.trim(),
                                  status: 'active',
                                );

                                final nav = Navigator.of(ctx);
                                await docRef.set(newBiz.toMap()..['created_at'] = now..['updated_at'] = now);

                                if (mounted) {
                                  nav.pop();
                                  ref.invalidate(businessesStreamProvider);
                                }
                              },
                        child: isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Save Business'),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _archiveBusiness(BusinessModel biz) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Archive Business'),
        content: Text('Are you sure you want to archive "${biz.name}"? Customer reviews will be preserved.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.poor),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Archive'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final now = DateTime.now().toUtc().toIso8601String();
      await FirebaseFirestore.instance.collection('businesses').doc(biz.id).update({
        'status': 'archived',
        'archived_at': now,
        'updated_at': now,
      });
      ref.invalidate(businessesStreamProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final businessesAsync = ref.watch(businessesStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Businesses', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_business_rounded, color: AppColors.brandPrimary),
            tooltip: 'Add Business',
            onPressed: _openAddBusinessDialog,
          ),
        ],
      ),
      body: businessesAsync.when(
        data: (businesses) {
          if (businesses.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.store_mall_directory_outlined, size: 64, color: AppColors.textMutedLight),
                  const SizedBox(height: 16),
                  const Text('No businesses yet', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  const Text('Create your first business to get started.', style: TextStyle(color: AppColors.textSecondaryLight)),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _openAddBusinessDialog,
                    icon: const Icon(Icons.add),
                    label: const Text('Create Business'),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: businesses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (ctx, i) {
              final b = businesses[i];
              return Card(
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: CircleAvatar(
                    backgroundColor: AppColors.brandLight,
                    child: Text(
                      b.name.isNotEmpty ? b.name[0].toUpperCase() : 'B',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brandPrimary),
                    ),
                  ),
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(b.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      ),
                      if (b.isDemo)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('DEMO', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                        ),
                    ],
                  ),
                  subtitle: Text(
                    '${b.category} • ${b.city ?? "India"}',
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondaryLight),
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (val) {
                      if (val == 'select') {
                        ref.read(selectedBusinessProvider.notifier).state = b;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Switched context to ${b.name}')),
                        );
                      } else if (val == 'archive') {
                        _archiveBusiness(b);
                      }
                    },
                    itemBuilder: (ctx) => [
                      const PopupMenuItem(value: 'select', child: Text('Select as Active Context')),
                      const PopupMenuItem(value: 'archive', child: Text('Archive Business', style: TextStyle(color: AppColors.poor))),
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error loading businesses: $e')),
      ),
    );
  }
}
