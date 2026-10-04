import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/context_switchers.dart';
import '../qr/qr_management_screen.dart';
import '../forms/form_builder_screen.dart';

class BranchesScreen extends ConsumerStatefulWidget {
  const BranchesScreen({super.key});

  @override
  ConsumerState<BranchesScreen> createState() => _BranchesScreenState();
}

class _BranchesScreenState extends ConsumerState<BranchesScreen> {
  void _openAddBranchDialog() {
    final selectedBiz = ref.read(selectedBusinessProvider);
    final license = ref.read(activeLicenseProvider).value;
    final branches = ref.read(branchesStreamProvider).value ?? [];

    if (selectedBiz == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a specific business first before adding a branch.')),
      );
      return;
    }

    if (license != null && branches.length >= license.maximumBranches) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Branch Limit Reached'),
          content: Text(
            'Your current license plan allows a maximum of ${license.maximumBranches} active branches across all businesses. Please upgrade your license to add another branch.',
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Understood'),
            ),
          ],
        ),
      );
      return;
    }

    final nameCtrl = TextEditingController();
    final addressCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    String selectedColor = '#2563EB';
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
                      Text(
                        'Add Branch to ${selectedBiz.name}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Branch Name (e.g. City Center) *'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Enter branch name' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: addressCtrl,
                        decoration: const InputDecoration(labelText: 'Full Physical Address'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: phoneCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Contact Phone'),
                      ),
                      const SizedBox(height: 16),
                      const Text('Brand Accent Color', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      Row(
                        children: ['#2563EB', '#DC2626', '#059669', '#7C3AED', '#D97706'].map((hex) {
                          final color = Color(int.parse(hex.replaceFirst('#', '0xFF')));
                          final isSelected = selectedColor == hex;
                          return GestureDetector(
                            onTap: () => setModalState(() => selectedColor = hex),
                            child: Container(
                              margin: const EdgeInsets.only(right: 12),
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: color,
                                shape: BoxShape.circle,
                                border: isSelected ? Border.all(color: Colors.black, width: 3) : null,
                              ),
                              child: isSelected ? const Icon(Icons.check, color: Colors.white, size: 20) : null,
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),
                      ElevatedButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                if (!formKey.currentState!.validate()) return;
                                setModalState(() => isSaving = true);

                                final user = ref.read(currentUserProfileProvider).value;
                                if (user == null) return;

                                final now = DateTime.now().toUtc().toIso8601String();
                                final branchRef = FirebaseFirestore.instance.collection('branches').doc();
                                final qrRef = FirebaseFirestore.instance.collection('qr_codes').doc();
                                final formRef = FirebaseFirestore.instance.collection('review_forms').doc();
                                final pageRef = FirebaseFirestore.instance.collection('review_form_pages').doc();

                                final token = 'token_${branchRef.id.substring(0, 10)}';

                                final batch = FirebaseFirestore.instance.batch();

                                // 1. Create branch
                                batch.set(branchRef, {
                                  'id': branchRef.id,
                                  'owner_id': user.ownerId,
                                  'business_id': selectedBiz.id,
                                  'name': nameCtrl.text.trim(),
                                  'address': addressCtrl.text.trim(),
                                  'phone': phoneCtrl.text.trim(),
                                  'theme_color': selectedColor,
                                  'status': 'active',
                                  'created_at': now,
                                  'updated_at': now,
                                });

                                // 2. Create QR record
                                batch.set(qrRef, {
                                  'id': qrRef.id,
                                  'owner_id': user.ownerId,
                                  'business_id': selectedBiz.id,
                                  'branch_id': branchRef.id,
                                  'secure_token': token,
                                  'status': 'active',
                                  'created_at': now,
                                });

                                // 3. Create Default Published Review Form
                                batch.set(formRef, {
                                  'id': formRef.id,
                                  'owner_id': user.ownerId,
                                  'business_id': selectedBiz.id,
                                  'branch_id': branchRef.id,
                                  'name': '${nameCtrl.text.trim()} Experience Form',
                                  'status': 'published',
                                  'published_version': 1,
                                  'created_at': now,
                                  'updated_at': now,
                                  'published_at': now,
                                });

                                batch.set(pageRef, {
                                  'id': pageRef.id,
                                  'owner_id': user.ownerId,
                                  'form_id': formRef.id,
                                  'page_number': 1,
                                  'title': 'Overall Experience',
                                  'display_order': 1,
                                });

                                // Default Questions
                                final q1Ref = FirebaseFirestore.instance.collection('review_questions').doc();
                                batch.set(q1Ref, {
                                  'id': q1Ref.id,
                                  'owner_id': user.ownerId,
                                  'form_id': formRef.id,
                                  'page_id': pageRef.id,
                                  'text': 'Rate your overall experience',
                                  'type': 'star',
                                  'required': true,
                                  'display_order': 1,
                                  'active': true,
                                  'created_at': now,
                                  'updated_at': now,
                                });

                                final nav = Navigator.of(ctx);
                                await batch.commit();

                                if (mounted) {
                                  nav.pop();
                                  ref.invalidate(branchesStreamProvider);
                                }
                              },
                        child: isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Add Branch'),
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

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(branchesStreamProvider);
    final selectedBiz = ref.watch(selectedBusinessProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Branches', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          const Padding(padding: EdgeInsets.only(right: 8), child: BusinessSwitcherButton()),
          IconButton(
            icon: const Icon(Icons.add_location_alt_rounded, color: AppColors.brandPrimary),
            tooltip: 'Add Branch',
            onPressed: _openAddBranchDialog,
          ),
        ],
      ),
      body: branchesAsync.when(
        data: (branches) {
          if (branches.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.location_off_outlined, size: 64, color: AppColors.textMutedLight),
                  const SizedBox(height: 16),
                  Text(
                    selectedBiz == null ? 'No branches found' : 'No branches for ${selectedBiz.name}',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  const Text('Add a branch to start collecting customer feedback.', style: TextStyle(color: AppColors.textSecondaryLight)),
                  const SizedBox(height: 20),
                  ElevatedButton.icon(
                    onPressed: _openAddBranchDialog,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Branch'),
                  ),
                ],
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: branches.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (ctx, i) {
              final br = branches[i];
              final color = Color(int.tryParse(br.themeColor.replaceFirst('#', '0xFF')) ?? 0xFF2563EB);

              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(br.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          ),
                          IconButton(
                            icon: const Icon(Icons.qr_code_2_rounded, color: AppColors.brandPrimary),
                            tooltip: 'QR Code & Marketing',
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => QrManagementScreen(branch: br)),
                              );
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.edit_note_rounded, color: AppColors.textSecondaryLight),
                            tooltip: 'Form Builder',
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => FormBuilderScreen(branch: br)),
                              );
                            },
                          ),
                        ],
                      ),
                      if (br.address?.isNotEmpty == true) ...[
                        const SizedBox(height: 4),
                        Text(br.address!, style: const TextStyle(fontSize: 13, color: AppColors.textSecondaryLight)),
                      ],
                      if (br.phone?.isNotEmpty == true) ...[
                        const SizedBox(height: 2),
                        Text('Phone: ${br.phone!}', style: const TextStyle(fontSize: 12, color: AppColors.textMutedLight)),
                      ],
                    ],
                  ),
                ),
              );
            },
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error loading branches: $e')),
      ),
    );
  }
}
