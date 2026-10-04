import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/theme/app_theme.dart';

class SuperAdminScreen extends ConsumerStatefulWidget {
  const SuperAdminScreen({super.key});

  @override
  ConsumerState<SuperAdminScreen> createState() => _SuperAdminScreenState();
}

class _SuperAdminScreenState extends ConsumerState<SuperAdminScreen> {
  bool _isSeeding = false;

  Future<void> _seedRajDemoEnvironment() async {
    setState(() => _isSeeding = true);
    try {
      final now = DateTime.now().toUtc().toIso8601String();

      // 1. Seed Raj Owner Profile
      const rajUid = 'demo_owner_raj';
      await FirebaseFirestore.instance.collection('users').doc(rajUid).set({
        'id': rajUid,
        'auth_uid': rajUid,
        'role': 'OWNER',
        'owner_id': rajUid,
        'name': 'Raj',
        'email': 'raj@reviewflow.demo',
        'mobile': '9876543210',
        'status': 'active',
        'created_at': now,
        'updated_at': now,
      });

      // 2. Seed Raj License (10 branches)
      await FirebaseFirestore.instance.collection('licenses').doc('license_raj').set({
        'id': 'license_raj',
        'owner_id': rajUid,
        'plan_id': 'plan_growth',
        'status': 'active',
        'start_date': now,
        'expiry_date': DateTime.now().add(const Duration(days: 365)).toUtc().toIso8601String(),
        'maximum_branches': 10,
        'created_at': now,
        'updated_at': now,
      });

      // 3. Seed Businesses
      final businesses = [
        {
          'id': 'biz_rs',
          'name': 'Royal Spice Restaurant',
          'cat': 'Restaurant & Dining',
          'branches': [
            {'id': 'br_rs_1', 'name': 'Royal Spice — Main Branch'},
            {'id': 'br_rs_2', 'name': 'Royal Spice — City Center'},
            {'id': 'br_rs_3', 'name': 'Royal Spice — Mall Branch'},
          ]
        },
        {
          'id': 'biz_gh',
          'name': 'Grand Horizon Hotel',
          'cat': 'Hospitality & Luxury',
          'branches': [
            {'id': 'br_gh_1', 'name': 'Grand Horizon — Main Hotel'},
            {'id': 'br_gh_2', 'name': 'Grand Horizon — Airport'},
          ]
        },
        {
          'id': 'biz_uc',
          'name': 'Urban Cuts Salon',
          'cat': 'Beauty & Grooming',
          'branches': [
            {'id': 'br_uc_1', 'name': 'Urban Cuts — Main Branch'},
          ]
        }
      ];

      final batch = FirebaseFirestore.instance.batch();

      for (final b in businesses) {
        final bRef = FirebaseFirestore.instance.collection('businesses').doc(b['id'] as String);
        batch.set(bRef, {
          'id': b['id'],
          'owner_id': rajUid,
          'name': b['name'],
          'category': b['cat'],
          'status': 'active',
          'is_demo': true,
          'created_at': now,
          'updated_at': now,
        });

        for (final br in (b['branches'] as List<Map<String, String>>)) {
          final brRef = FirebaseFirestore.instance.collection('branches').doc(br['id']!);
          final qrRef = FirebaseFirestore.instance.collection('qr_codes').doc('qr_${br["id"]}');
          final formRef = FirebaseFirestore.instance.collection('review_forms').doc('form_${br["id"]}');

          batch.set(brRef, {
            'id': br['id'],
            'owner_id': rajUid,
            'business_id': b['id'],
            'name': br['name'],
            'status': 'active',
            'is_demo': true,
            'created_at': now,
            'updated_at': now,
          });

          batch.set(qrRef, {
            'id': 'qr_${br["id"]}',
            'owner_id': rajUid,
            'business_id': b['id'],
            'branch_id': br['id'],
            'secure_token': 'token_${br["id"]}',
            'status': 'active',
            'is_demo': true,
            'created_at': now,
          });

          batch.set(formRef, {
            'id': 'form_${br["id"]}',
            'owner_id': rajUid,
            'business_id': b['id'],
            'branch_id': br['id'],
            'name': '${br["name"]} Survey',
            'status': 'published',
            'published_version': 1,
            'is_demo': true,
            'created_at': now,
            'updated_at': now,
            'published_at': now,
          });
        }
      }

      await batch.commit();

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Raj demo environment seeded successfully with 3 businesses and branches!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Seeding error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isSeeding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Super Admin Portal', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Platform Diagnostics & Seeding', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    const Text(
                      'Populate the official demo environment (Owner Raj, Royal Spice, Grand Horizon, Urban Cuts) cleanly isolated with is_demo: true.',
                      style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: _isSeeding ? null : _seedRajDemoEnvironment,
                      icon: const Icon(Icons.cloud_sync_rounded),
                      label: _isSeeding
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Seed Raj Demo Environment'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text('Platform Audit Logs', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            StreamBuilder<QuerySnapshot>(
              stream: FirebaseFirestore.instance.collection('audit_logs').orderBy('created_at', descending: true).limit(10).snapshots(),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()));
                }

                final logs = snapshot.data?.docs ?? [];
                if (logs.isEmpty) {
                  return const Padding(padding: EdgeInsets.all(16), child: Text('No audit log entries recorded.'));
                }

                return Column(
                  children: logs.map((d) {
                    final data = d.data() as Map<String, dynamic>;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: const Icon(Icons.history_rounded, color: AppColors.brandPrimary),
                        title: Text(data['action'] ?? 'AUDIT_ACTION', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        subtitle: Text(data['created_at']?.toString().split('T').first ?? '', style: const TextStyle(fontSize: 11)),
                      ),
                    );
                  }).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
