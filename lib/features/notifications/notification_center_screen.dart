import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';

class NotificationCenterScreen extends ConsumerStatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  ConsumerState<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends ConsumerState<NotificationCenterScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _updateStatus(String recipientDocId, String newStatus) async {
    final now = DateTime.now().toUtc().toIso8601String();
    await FirebaseFirestore.instance.collection('notification_recipients').doc(recipientDocId).update({
      'status': newStatus,
      'updated_at': now,
    });
  }

  @override
  Widget build(BuildContext context) {
    final userProfile = ref.watch(currentUserProfileProvider).value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications', style: TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.brandPrimary,
          indicatorColor: AppColors.brandPrimary,
          tabs: const [
            Tab(text: 'Unread'),
            Tab(text: 'Read'),
            Tab(text: 'Resolved'),
          ],
        ),
      ),
      body: userProfile == null
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildNotificationList(userProfile.id, 'UNREAD'),
                _buildNotificationList(userProfile.id, 'READ'),
                _buildNotificationList(userProfile.id, 'RESOLVED'),
              ],
            ),
    );
  }

  Widget _buildNotificationList(String userId, String status) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('notification_recipients')
          .where('user_id', isEqualTo: userId)
          .where('status', isEqualTo: status)
          .snapshots(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }

        final recipientDocs = snapshot.data?.docs ?? [];
        if (recipientDocs.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.notifications_none_outlined, size: 56, color: AppColors.textMutedLight),
                const SizedBox(height: 12),
                Text(
                  status == 'UNREAD' ? "You're all caught up!" : 'No $status notifications',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                ),
              ],
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: recipientDocs.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (ctx, i) {
            final recDoc = recipientDocs[i];
            final notifId = recDoc['notification_id'];

            return FutureBuilder<DocumentSnapshot>(
              future: FirebaseFirestore.instance.collection('notifications').doc(notifId).get(),
              builder: (context, notifSnap) {
                final notifData = notifSnap.data?.data() as Map<String, dynamic>?;
                final title = notifData?['title'] ?? 'Poor Review Alert';
                final message = notifData?['message'] ?? 'A customer submitted feedback.';
                final time = notifData?['created_at']?.toString().split('T').first ?? '';

                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.poorLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.warning_amber_rounded, color: AppColors.poor, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                  const SizedBox(height: 2),
                                  Text(time, style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(message, style: const TextStyle(fontSize: 13, color: AppColors.textPrimaryLight)),
                        const SizedBox(height: 12),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (status == 'UNREAD')
                              TextButton(
                                onPressed: () => _updateStatus(recDoc.id, 'READ'),
                                child: const Text('Mark Read'),
                              ),
                            if (status != 'RESOLVED')
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.good,
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                ),
                                onPressed: () => _updateStatus(recDoc.id, 'RESOLVED'),
                                child: const Text('Resolve', style: TextStyle(fontSize: 12)),
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
        );
      },
    );
  }
}
