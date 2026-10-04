import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  void _openAddMemberDialog() {
    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    UserRole selectedRole = UserRole.manager;
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
                      const Text('Add Team Member', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Full Name *'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Enter name' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email Address *'),
                        validator: (v) => v == null || !v.contains('@') ? 'Enter valid email' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: mobileCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Mobile Phone'),
                      ),
                      const SizedBox(height: 16),
                      const Text('Assigned Role', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<UserRole>(
                        initialValue: selectedRole,
                        decoration: const InputDecoration(),
                        items: const [
                          DropdownMenuItem(value: UserRole.admin, child: Text('Admin (Tenant operations)')),
                          DropdownMenuItem(value: UserRole.superManager, child: Text('Super Manager (Multi-branch)')),
                          DropdownMenuItem(value: UserRole.manager, child: Text('Manager (Operational user)')),
                        ],
                        onChanged: (val) => setModalState(() => selectedRole = val ?? UserRole.manager),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: isSaving
                            ? null
                            : () async {
                                if (!formKey.currentState!.validate()) return;
                                setModalState(() => isSaving = true);

                                final currentUser = ref.read(currentUserProfileProvider).value;
                                if (currentUser == null) return;

                                final now = DateTime.now().toUtc().toIso8601String();
                                final memberRef = FirebaseFirestore.instance.collection('users').doc();

                                final member = UserModel(
                                  id: memberRef.id,
                                  authUid: memberRef.id,
                                  role: selectedRole,
                                  ownerId: currentUser.ownerId,
                                  name: nameCtrl.text.trim(),
                                  email: emailCtrl.text.trim(),
                                  mobile: mobileCtrl.text.trim(),
                                  status: 'active',
                                );

                                final nav = Navigator.of(ctx);
                                await memberRef.set(member.toMap()..['created_at'] = now..['updated_at'] = now);

                                if (mounted) {
                                  nav.pop();
                                  setState(() {});
                                }
                              },
                        child: isSaving
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Add Member'),
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

  Future<void> _toggleDeactivate(UserModel member) async {
    final newStatus = member.status == 'active' ? 'deactivated' : 'active';
    await FirebaseFirestore.instance.collection('users').doc(member.id).update({
      'status': newStatus,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final userProfile = ref.watch(currentUserProfileProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Team Management', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.brandPrimary),
            tooltip: 'Add Member',
            onPressed: _openAddMemberDialog,
          ),
        ],
      ),
      body: userProfile == null
          ? const Center(child: CircularProgressIndicator())
          : StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance
                  .collection('users')
                  .where('owner_id', isEqualTo: userProfile.ownerId)
                  .snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                final members = snapshot.data?.docs
                        .map((d) => UserModel.fromMap(d.data() as Map<String, dynamic>, d.id))
                        .where((u) => u.id != userProfile.id)
                        .toList() ??
                    [];

                if (members.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.group_outlined, size: 60, color: AppColors.textMutedLight),
                        const SizedBox(height: 12),
                        const Text('No team members yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 6),
                        const Text('Add managers and admins to delegate operational oversight.', style: TextStyle(color: AppColors.textSecondaryLight)),
                        const SizedBox(height: 16),
                        ElevatedButton.icon(
                          onPressed: _openAddMemberDialog,
                          icon: const Icon(Icons.person_add),
                          label: const Text('Add Member'),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: members.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (ctx, i) {
                    final m = members[i];
                    final isActive = m.status == 'active';

                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: isActive ? AppColors.brandLight : Colors.grey.shade200,
                          child: Text(
                            m.name.isNotEmpty ? m.name[0].toUpperCase() : 'U',
                            style: TextStyle(
                              color: isActive ? AppColors.brandPrimary : Colors.grey,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        title: Text(m.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        subtitle: Text(
                          '${m.role.value} • ${m.email} • ${m.status.toUpperCase()}',
                          style: TextStyle(
                            fontSize: 12,
                            color: isActive ? AppColors.textSecondaryLight : AppColors.poor,
                          ),
                        ),
                        trailing: IconButton(
                          icon: Icon(isActive ? Icons.block_rounded : Icons.check_circle_outline, color: isActive ? AppColors.poor : AppColors.good),
                          tooltip: isActive ? 'Deactivate Member' : 'Activate Member',
                          onPressed: () => _toggleDeactivate(m),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}
