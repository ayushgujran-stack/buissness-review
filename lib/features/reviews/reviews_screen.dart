import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/context_switchers.dart';

class ReviewsScreen extends ConsumerStatefulWidget {
  const ReviewsScreen({super.key});

  @override
  ConsumerState<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends ConsumerState<ReviewsScreen> {
  String _filterClassification = 'ALL'; // ALL, GOOD, OKAY, POOR
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _showReviewDetails(ReviewModel review) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surfaceLight,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return FutureBuilder<QuerySnapshot>(
          future: FirebaseFirestore.instance
              .collection('review_answers')
              .where('review_id', isEqualTo: review.id)
              .get(),
          builder: (context, snapshot) {
            final answers = snapshot.data?.docs.map((d) => ReviewAnswerModel.fromMap(d.data() as Map<String, dynamic>, d.id)).toList() ?? [];

            return FutureBuilder<DocumentSnapshot>(
              future: FirebaseFirestore.instance.collection('customers').doc(review.customerId).get(),
              builder: (context, custSnap) {
                final custData = custSnap.data?.data() as Map<String, dynamic>?;
                final custName = custData?['name'] ?? 'Anonymous Guest';
                final custMobile = custData?['mobile'] ?? 'N/A';

                return Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
                    top: 20,
                    left: 20,
                    right: 20,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(custName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                              Text('Mobile: $custMobile', style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                            ],
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: review.classification == 'POOR'
                                  ? AppColors.poorLight
                                  : review.classification == 'OKAY'
                                      ? AppColors.okayLight
                                      : AppColors.goodLight,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              review.classification,
                              style: TextStyle(
                                color: review.classification == 'POOR'
                                    ? AppColors.poor
                                    : review.classification == 'OKAY'
                                        ? AppColors.okay
                                        : AppColors.good,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Submitted: ${review.submittedAt.replaceAll("T", " ").split(".").first} UTC',
                        style: const TextStyle(fontSize: 11, color: AppColors.textMutedLight),
                      ),
                      const Divider(height: 24),
                      const Text('Questions & Answers', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      if (snapshot.connectionState == ConnectionState.waiting)
                        const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
                      else if (answers.isEmpty)
                        const Text('No detailed answers recorded.', style: TextStyle(fontSize: 13, color: AppColors.textSecondaryLight))
                      else
                        ...answers.map((ans) {
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(ans.questionTextSnapshot, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 2),
                                Text(
                                  'Answer: ${ans.answerValue}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: ans.classification == 'POOR' ? AppColors.poor : AppColors.brandPrimary,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                    ],
                  ),
                );
              },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final reviewsAsync = ref.watch(reviewsStreamProvider);
    final user = ref.watch(currentUserProfileProvider).value;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Reviews & Customers', style: TextStyle(fontWeight: FontWeight.bold)),
          actions: const [
            Padding(padding: EdgeInsets.only(right: 12), child: BusinessSwitcherButton()),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.rate_review_outlined), text: 'Reviews'),
              Tab(icon: Icon(Icons.people_outline), text: 'Customer Directory'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // TAB 1: REVIEWS
            Column(
              children: [
                // Search Field
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: 'Search reviews by score or date...',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear),
                              onPressed: () {
                                _searchController.clear();
                                setState(() => _searchQuery = '');
                              },
                            )
                          : null,
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    ),
                    onChanged: (val) => setState(() => _searchQuery = val.trim().toLowerCase()),
                  ),
                ),

                // Filter Chips Bar
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: ['ALL', 'GOOD', 'OKAY', 'POOR'].map((cls) {
                        final isSelected = _filterClassification == cls;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: FilterChip(
                            selected: isSelected,
                            label: Text(cls),
                            labelStyle: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isSelected ? Colors.white : AppColors.textPrimaryLight,
                            ),
                            selectedColor: cls == 'POOR'
                                ? AppColors.poor
                                : cls == 'OKAY'
                                    ? AppColors.okay
                                    : cls == 'GOOD'
                                        ? AppColors.good
                                        : AppColors.brandPrimary,
                            onSelected: (val) => setState(() => _filterClassification = cls),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
                Expanded(
                  child: reviewsAsync.when(
                    data: (reviews) {
                      var filtered = _filterClassification == 'ALL'
                          ? reviews
                          : reviews.where((r) => r.classification == _filterClassification).toList();

                      if (_searchQuery.isNotEmpty) {
                        filtered = filtered.where((r) {
                          return r.averageScore.toString().contains(_searchQuery) ||
                              r.classification.toLowerCase().contains(_searchQuery) ||
                              r.submittedAt.contains(_searchQuery);
                        }).toList();
                      }

                      if (filtered.isEmpty) {
                        return Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.rate_review_outlined, size: 56, color: AppColors.textMutedLight),
                              const SizedBox(height: 12),
                              Text(
                                _filterClassification == 'ALL'
                                    ? 'No reviews available yet'
                                    : 'No $_filterClassification reviews found',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ],
                          ),
                        );
                      }

                      return ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (ctx, i) {
                          final r = filtered[i];
                          Color badgeColor;
                          Color bgColor;
                          if (r.classification == 'POOR') {
                            badgeColor = AppColors.poor;
                            bgColor = AppColors.poorLight;
                          } else if (r.classification == 'OKAY') {
                            badgeColor = AppColors.okay;
                            bgColor = AppColors.okayLight;
                          } else {
                            badgeColor = AppColors.good;
                            bgColor = AppColors.goodLight;
                          }

                          return Card(
                            child: ListTile(
                              onTap: () => _showReviewDetails(r),
                              leading: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(6)),
                                child: Text(
                                  r.classification,
                                  style: TextStyle(color: badgeColor, fontWeight: FontWeight.bold, fontSize: 11),
                                ),
                              ),
                              title: Text('Rating: ${r.averageScore.toStringAsFixed(1)} / 3.0', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              subtitle: Text(
                                r.submittedAt.split('T').first,
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                              ),
                              trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMutedLight),
                            ),
                          );
                        },
                      );
                    },
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (e, _) => Center(child: Text('Error loading reviews: $e')),
                  ),
                ),
              ],
            ),

            // TAB 2: CUSTOMER DIRECTORY
            if (user == null)
              const Center(child: CircularProgressIndicator())
            else
              StreamBuilder<QuerySnapshot>(
                stream: FirebaseFirestore.instance
                    .collection('customers')
                    .where('owner_id', isEqualTo: user.ownerId)
                    .orderBy('created_at', descending: true)
                    .snapshots(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final customerDocs = snapshot.data?.docs ?? [];
                  if (customerDocs.isEmpty) {
                    return const Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.people_outline, size: 56, color: AppColors.textMutedLight),
                          SizedBox(height: 12),
                          Text('No customers registered yet', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          SizedBox(height: 6),
                          Text('Customer records are generated automatically when reviews are submitted.', style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                        ],
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: customerDocs.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final cData = customerDocs[i].data() as Map<String, dynamic>;
                      final name = cData['name'] ?? 'Guest Customer';
                      final mobile = cData['mobile'] ?? 'N/A';
                      final date = (cData['created_at'] ?? '').toString().split('T').first;

                      return Card(
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.brandLight,
                            child: Text(
                              name.isNotEmpty ? name[0].toUpperCase() : 'C',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brandPrimary),
                            ),
                          ),
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          subtitle: Text('Mobile: $mobile • First seen: $date', style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight)),
                          trailing: const Icon(Icons.phone_outlined, size: 18, color: AppColors.brandPrimary),
                        ),
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
}
