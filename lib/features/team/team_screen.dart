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
  void _openAddMemberDialog() async {
    final currentUser = ref.read(currentUserProfileProvider).value;
    if (currentUser == null) return;

    // Fetch owner's businesses and branches for assignment
    final businessesSnapshot = await FirebaseFirestore.instance
        .collection('businesses')
        .where('owner_id', isEqualTo: currentUser.ownerId)
        .get();

    final branchesSnapshot = await FirebaseFirestore.instance
        .collection('branches')
        .where('owner_id', isEqualTo: currentUser.ownerId)
        .get();

    final businesses = businessesSnapshot.docs
        .map((d) => BusinessModel.fromMap(d.data(), d.id))
        .toList();

    final branches = branchesSnapshot.docs
        .map((d) => BranchModel.fromMap(d.data(), d.id))
        .toList();

    if (!mounted) return;

    final nameCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final mobileCtrl = TextEditingController();
    UserRole selectedRole = UserRole.manager;
    final Set<String> selectedBusinesses = {};
    final Set<String> selectedBranches = {};
    final Set<String> selectedPermissions = Set.from(AppPermissions.defaultManagerPermissions);

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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Add Team Member', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.pop(ctx),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: nameCtrl,
                        decoration: const InputDecoration(labelText: 'Full Name *', prefixIcon: Icon(Icons.person_outline)),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Enter full name' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(labelText: 'Email Address *', prefixIcon: Icon(Icons.email_outlined)),
                        validator: (v) => v == null || !v.contains('@') ? 'Enter valid email' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: mobileCtrl,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Mobile Phone *', prefixIcon: Icon(Icons.phone_outlined)),
                        validator: (v) => v == null || v.trim().length < 10 ? 'Enter 10-digit mobile' : null,
                      ),
                      const SizedBox(height: 16),
                      const Text('Role Assignment', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      DropdownButtonFormField<UserRole>(
                        initialValue: selectedRole,
                        decoration: const InputDecoration(),
                        items: const [
                          DropdownMenuItem(
                            value: UserRole.admin,
                            child: Text('Admin (Owner-delegated administration)'),
                          ),
                          DropdownMenuItem(
                            value: UserRole.superManager,
                            child: Text('Super Manager (Multi-business / Multi-branch)'),
                          ),
                          DropdownMenuItem(
                            value: UserRole.manager,
                            child: Text('Manager (Operational branch oversight)'),
                          ),
                        ],
                        onChanged: (val) {
                          if (val == null) return;
                          setModalState(() {
                            selectedRole = val;
                            if (selectedRole == UserRole.admin) {
                              selectedPermissions.addAll(AppPermissions.allOperationalPermissions);
                            } else {
                              selectedPermissions.clear();
                              selectedPermissions.addAll(AppPermissions.defaultManagerPermissions);
                            }
                          });
                        },
                      ),
                      const SizedBox(height: 16),

                      // Business Scope
                      if (businesses.isNotEmpty) ...[
                        const Text('Assigned Businesses', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                        const Text('Select which businesses this user can access', style: TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: businesses.map((b) {
                            final isSel = selectedBusinesses.contains(b.id);
                            return FilterChip(
                              label: Text(b.name),
                              selected: isSel,
                              onSelected: (checked) {
                                setModalState(() {
                                  if (checked) {
                                    selectedBusinesses.add(b.id);
                                  } else {
                                    selectedBusinesses.remove(b.id);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Branch Scope
                      if (branches.isNotEmpty) ...[
                        const Text('Assigned Branches', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                        const Text('Select specific branches this user can view/manage', style: TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          children: branches.map((br) {
                            final isSel = selectedBranches.contains(br.id);
                            return FilterChip(
                              label: Text(br.name),
                              selected: isSel,
                              onSelected: (checked) {
                                setModalState(() {
                                  if (checked) {
                                    selectedBranches.add(br.id);
                                  } else {
                                    selectedBranches.remove(br.id);
                                  }
                                });
                              },
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Granular Permissions
                      const Text('Permissions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                      const Text('Fine-grained operational capability grants', style: TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        children: AppPermissions.allOperationalPermissions.map((perm) {
                          final isGranted = selectedPermissions.contains(perm);
                          return FilterChip(
                            label: Text(perm.replaceAll('_', ' ')),
                            selected: isGranted,
                            selectedColor: AppColors.brandLight,
                            onSelected: (checked) {
                              setModalState(() {
                                if (checked) {
                                  selectedPermissions.add(perm);
                                } else {
                                  selectedPermissions.remove(perm);
                                }
                              });
                            },
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
                                  allowedBusinessIds: selectedBusinesses.toList(),
                                  allowedBranchIds: selectedBranches.toList(),
                                  permissions: selectedPermissions.toList(),
                                );

                                final batch = FirebaseFirestore.instance.batch();
                                batch.set(memberRef, member.toMap()..['created_at'] = now..['updated_at'] = now);

                                // Audit Log for team member addition
                                final auditRef = FirebaseFirestore.instance.collection('audit_logs').doc();
                                batch.set(auditRef, {
                                  'id': auditRef.id,
                                  'owner_id': currentUser.ownerId,
                                  'actor_user_id': currentUser.id,
                                  'action': 'TEAM_MEMBER_CREATED',
                                  'entity_type': 'USER',
                                  'entity_id': memberRef.id,
                                  'metadata': {
                                    'name': member.name,
                                    'email': member.email,
                                    'role': member.role.value,
                                    'permissions': member.permissions,
                                    'assigned_businesses': member.allowedBusinessIds,
                                    'assigned_branches': member.allowedBranchIds,
                                  },
                                  'created_at': now,
                                });

                                final nav = Navigator.of(ctx);
                                await batch.commit();

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
                            : const Text('Add Team Member'),
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
    final currentUser = ref.read(currentUserProfileProvider).value;
    if (currentUser == null) return;

    final newStatus = member.status == 'active' ? 'deactivated' : 'active';
    final now = DateTime.now().toUtc().toIso8601String();

    final batch = FirebaseFirestore.instance.batch();
    batch.update(FirebaseFirestore.instance.collection('users').doc(member.id), {
      'status': newStatus,
      'updated_at': now,
    });

    // Audit log for compliance
    final auditRef = FirebaseFirestore.instance.collection('audit_logs').doc();
    batch.set(auditRef, {
      'id': auditRef.id,
      'owner_id': currentUser.ownerId,
      'actor_user_id': currentUser.id,
      'action': newStatus == 'deactivated' ? 'USER_DEACTIVATED' : 'USER_REACTIVATED',
      'entity_type': 'USER',
      'entity_id': member.id,
      'metadata': {
        'target_email': member.email,
        'target_role': member.role.value,
      },
      'created_at': now,
    });

    await batch.commit();
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
                        const Text('Add managers and admins with custom branch & business access.', style: TextStyle(color: AppColors.textSecondaryLight)),
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
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ListTile(
                              contentPadding: EdgeInsets.zero,
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
                              title: Row(
                                children: [
                                  Expanded(
                                    child: Text(m.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: isActive ? AppColors.goodLight : AppColors.poorLight,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      m.status.toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: isActive ? AppColors.good : AppColors.poor,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              subtitle: Text(
                                '${m.role.value} • ${m.email} • ${m.mobile}',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                              ),
                              trailing: IconButton(
                                icon: Icon(
                                  isActive ? Icons.block_rounded : Icons.check_circle_outline,
                                  color: isActive ? AppColors.poor : AppColors.good,
                                ),
                                tooltip: isActive ? 'Deactivate Member' : 'Activate Member',
                                onPressed: () => _toggleDeactivate(m),
                              ),
                            ),
                            const Divider(height: 12),
                            Row(
                              children: [
                                const Icon(Icons.business_outlined, size: 14, color: AppColors.textMutedLight),
                                const SizedBox(width: 4),
                                Text(
                                  m.allowedBusinessIds.isEmpty
                                      ? 'Businesses: All'
                                      : 'Businesses: ${m.allowedBusinessIds.length} assigned',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight),
                                ),
                                const SizedBox(width: 16),
                                const Icon(Icons.location_on_outlined, size: 14, color: AppColors.textMutedLight),
                                const SizedBox(width: 4),
                                Text(
                                  m.allowedBranchIds.isEmpty
                                      ? 'Branches: All'
                                      : 'Branches: ${m.allowedBranchIds.length} assigned',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight),
                                ),
                                const SizedBox(width: 16),
                                const Icon(Icons.security_outlined, size: 14, color: AppColors.textMutedLight),
                                const SizedBox(width: 4),
                                Text(
                                  'Permissions: ${m.permissions.length}',
                                  style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight),
                                ),
                              ],
                            ),
                          ],
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
