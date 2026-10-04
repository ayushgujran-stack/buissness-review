import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';

class LicenseScreen extends ConsumerStatefulWidget {
  const LicenseScreen({super.key});

  @override
  ConsumerState<LicenseScreen> createState() => _LicenseScreenState();
}

class _LicenseScreenState extends ConsumerState<LicenseScreen> {
  bool _isProcessing = false;

  Future<void> _upgradePlan(String planId, int maxBranches, int price) async {
    setState(() => _isProcessing = true);
    final user = ref.read(currentUserProfileProvider).value;
    if (user == null) return;

    try {
      final now = DateTime.now();
      final newExpiry = now.add(const Duration(days: 365)).toUtc().toIso8601String();
      final paymentId = 'pay_${DateTime.now().millisecondsSinceEpoch}';
      final invoiceNum = 'INV-${now.year}${now.month.toString().padLeft(2, "0")}-${DateTime.now().millisecond}';

      final batch = FirebaseFirestore.instance.batch();

      // 1. Update License
      final licenseQuery = await FirebaseFirestore.instance
          .collection('licenses')
          .where('owner_id', isEqualTo: user.ownerId)
          .limit(1)
          .get();

      if (licenseQuery.docs.isNotEmpty) {
        batch.update(licenseQuery.docs.first.reference, {
          'plan_id': planId,
          'status': 'active',
          'maximum_branches': maxBranches,
          'expiry_date': newExpiry,
          'updated_at': now.toUtc().toIso8601String(),
        });
      }

      // 2. Record Payment & Invoice
      final payRef = FirebaseFirestore.instance.collection('payments').doc();
      batch.set(payRef, {
        'id': payRef.id,
        'owner_id': user.ownerId,
        'plan_id': planId,
        'gateway': 'razorpay',
        'payment_id': paymentId,
        'amount': price,
        'currency': 'INR',
        'status': 'verified',
        'invoice_number': invoiceNum,
        'created_at': now.toUtc().toIso8601String(),
      });

      // 3. Audit Log
      final auditRef = FirebaseFirestore.instance.collection('audit_logs').doc();
      batch.set(auditRef, {
        'id': auditRef.id,
        'owner_id': user.ownerId,
        'actor_user_id': user.id,
        'action': 'PAYMENT_VERIFIED_LICENSE_UPGRADED',
        'entity_type': 'PAYMENT',
        'entity_id': payRef.id,
        'metadata': {
          'invoice_number': invoiceNum,
          'amount': price,
          'maximum_branches': maxBranches,
        },
        'created_at': now.toUtc().toIso8601String(),
      });

      await batch.commit();

      ref.invalidate(activeLicenseProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Payment verified! Upgraded to $maxBranches branches. Invoice: $invoiceNum')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upgrade error: $e')));
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final license = ref.watch(activeLicenseProvider).value;
    final branches = ref.watch(branchesStreamProvider).value ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('License & Billing', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Current License Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          license?.status.toUpperCase() ?? 'TRIAL',
                          style: const TextStyle(color: AppColors.brandPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.brandLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${license?.daysRemaining ?? 0} Days Remaining',
                            style: const TextStyle(color: AppColors.brandPrimary, fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('Total Branch Capacity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    Text(
                      '${branches.length} of ${license?.maximumBranches ?? 3} active branches utilized across all businesses.',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondaryLight),
                    ),
                    const SizedBox(height: 12),
                    LinearProgressIndicator(
                      value: license != null && license.maximumBranches > 0 ? (branches.length / license.maximumBranches).clamp(0.0, 1.0) : 0.0,
                      backgroundColor: AppColors.borderLight,
                      color: AppColors.brandPrimary,
                      minHeight: 8,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            const Text('Available Plans', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            _buildPlanCard(
              title: 'Starter Growth Plan',
              price: '₹2,499 / yr',
              branches: 5,
              onTap: () => _upgradePlan('plan_starter_5', 5, 2499),
            ),
            const SizedBox(height: 12),
            _buildPlanCard(
              title: 'Professional Multi-Branch Plan',
              price: '₹4,999 / yr',
              branches: 15,
              isPopular: true,
              onTap: () => _upgradePlan('plan_pro_15', 15, 4999),
            ),
            const SizedBox(height: 12),
            _buildPlanCard(
              title: 'Enterprise Tier',
              price: '₹9,999 / yr',
              branches: 50,
              onTap: () => _upgradePlan('plan_enterprise_50', 50, 9999),
            ),
            const SizedBox(height: 28),

            const Text('Payment History & Invoices', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),

            Consumer(
              builder: (context, ref, _) {
                final user = ref.watch(currentUserProfileProvider).value;
                if (user == null) return const SizedBox.shrink();

                return StreamBuilder<QuerySnapshot>(
                  stream: FirebaseFirestore.instance
                      .collection('payments')
                      .where('owner_id', isEqualTo: user.ownerId)
                      .orderBy('created_at', descending: true)
                      .snapshots(),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
                    }

                    final payments = snapshot.data?.docs ?? [];
                    if (payments.isEmpty) {
                      return const Card(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: Text('No payment history recorded yet. Trial active.', style: TextStyle(color: AppColors.textSecondaryLight)),
                        ),
                      );
                    }

                    return Column(
                      children: payments.map((p) {
                        final data = p.data() as Map<String, dynamic>;
                        final amount = data['amount'] ?? 0;
                        final inv = data['invoice_number'] ?? 'INV-N/A';
                        final date = (data['created_at'] ?? '').toString().split('T').first;
                        final status = (data['status'] ?? 'verified').toString().toUpperCase();

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: AppColors.brandLight,
                              child: Icon(Icons.receipt_long_outlined, color: AppColors.brandPrimary, size: 20),
                            ),
                            title: Text('Invoice: $inv', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            subtitle: Text('Date: $date • Gateway: Razorpay • $status', style: const TextStyle(fontSize: 12)),
                            trailing: Text('₹$amount', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: AppColors.good)),
                          ),
                        );
                      }).toList(),
                    );
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlanCard({
    required String title,
    required String price,
    required int branches,
    bool isPopular = false,
    required VoidCallback onTap,
  }) {
    return Card(
      child: Container(
        decoration: isPopular
            ? BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.brandPrimary, width: 2),
              )
            : null,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: AppColors.brandPrimary, borderRadius: BorderRadius.circular(6)),
                    child: const Text('POPULAR', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(price, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppColors.brandPrimary)),
            const SizedBox(height: 8),
            Text('• Up to $branches active branch locations', style: const TextStyle(fontSize: 13, color: AppColors.textSecondaryLight)),
            const Text('• Unlimited businesses and review forms', style: TextStyle(fontSize: 13, color: AppColors.textSecondaryLight)),
            const Text('• Instant poor review alert notifications', style: TextStyle(fontSize: 13, color: AppColors.textSecondaryLight)),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: _isProcessing ? null : onTap,
              child: _isProcessing
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Upgrade with Razorpay Sandbox'),
            ),
          ],
        ),
      ),
    );
  }
}
