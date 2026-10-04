import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/context_switchers.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userProfile = ref.watch(currentUserProfileProvider).value;
    final license = ref.watch(activeLicenseProvider).value;
    final reviewsAsync = ref.watch(reviewsStreamProvider);
    final branchesAsync = ref.watch(branchesStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              userProfile?.name.isNotEmpty == true ? 'Hello, ${userProfile!.name}' : 'Dashboard',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Performance & Live Feedback',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
            ),
          ],
        ),
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 12),
            child: BusinessSwitcherButton(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(reviewsStreamProvider);
          ref.invalidate(branchesStreamProvider);
          ref.invalidate(activeLicenseProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Branch Switcher Bar
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Location Filter:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  BranchSwitcherButton(),
                ],
              ),
              const SizedBox(height: 16),

              // License / Trial Status Card
              if (license != null) ...[
                _buildLicenseCard(context, license, branchesAsync.value?.length ?? 0),
                const SizedBox(height: 16),
              ],

              // Metric Summary Cards
              reviewsAsync.when(
                data: (reviews) {
                  final poorReviews = reviews.where((r) => r.classification == 'POOR').toList();
                  final branches = branchesAsync.value ?? [];

                  // Calculate Top Performing Branch
                  BranchModel? topBranch;
                  double topBranchScore = 0;
                  for (final br in branches) {
                    final brReviews = reviews.where((r) => r.branchId == br.id).toList();
                    if (brReviews.isNotEmpty) {
                      final avg = brReviews.map((r) => r.averageScore).reduce((a, b) => a + b) / brReviews.length;
                      if (avg > topBranchScore) {
                        topBranchScore = avg;
                        topBranch = br;
                      }
                    }
                  }

                  return Column(
                    children: [
                      // Immediate Answer 4: Poor Reviews Alert Banner
                      if (poorReviews.isNotEmpty) ...[
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.poorLight,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.poor.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: AppColors.poor, size: 22),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Attention: ${poorReviews.length} poor review${poorReviews.length > 1 ? "s" : ""} require operational review.',
                                  style: const TextStyle(color: AppColors.poor, fontWeight: FontWeight.bold, fontSize: 13),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],

                      _buildMetricsGrid(reviews),

                      // Immediate Answer 3: Top Performing Branch
                      if (topBranch != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.goodLight,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Icon(Icons.emoji_events_outlined, color: AppColors.good, size: 20),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Top Branch: ${topBranch.name}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.good),
                                  ),
                                ],
                              ),
                              Text(
                                '${topBranchScore.toStringAsFixed(1)} / 3.0',
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.good),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  );
                },
                loading: () => const Center(child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                )),
                error: (e, _) => Center(child: Text('Error loading reviews: $e')),
              ),
              const SizedBox(height: 24),

              // Recent Reviews Section
              const Text(
                'Recent Feedback',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              reviewsAsync.when(
                data: (reviews) {
                  if (reviews.isEmpty) {
                    return Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(32),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceLight,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.borderLight),
                      ),
                      child: const Column(
                        children: [
                          Icon(Icons.inbox_outlined, size: 40, color: AppColors.textMutedLight),
                          SizedBox(height: 8),
                          Text(
                            'No reviews yet',
                            style: TextStyle(fontWeight: FontWeight.w600, color: AppColors.textPrimaryLight),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Customer feedback will automatically appear here once QR codes are scanned.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                          ),
                        ],
                      ),
                    );
                  }

                  final recentReviews = reviews.take(5).toList();
                  return Column(
                    children: recentReviews.map((r) => _buildReviewTile(context, r)).toList(),
                  );
                },
                loading: () => const SizedBox.shrink(),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLicenseCard(BuildContext context, LicenseModel license, int activeBranches) {
    final isTrial = license.status == 'trial';
    final days = license.daysRemaining;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isTrial ? AppColors.brandLight : AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isTrial ? AppColors.brandPrimary.withValues(alpha: 0.3) : AppColors.borderLight,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: isTrial ? AppColors.brandPrimary : AppColors.good,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.verified_outlined, color: Colors.white, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      isTrial ? 'Trial License' : 'Active Subscription',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: days <= 3 ? AppColors.poorLight : AppColors.brandLight,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$days days left',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: days <= 3 ? AppColors.poor : AppColors.brandPrimary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Branches in use: $activeBranches of ${license.maximumBranches} max capacity across all businesses',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricsGrid(List<ReviewModel> reviews) {
    final total = reviews.length;
    final good = reviews.where((r) => r.classification == 'GOOD').length;
    final okay = reviews.where((r) => r.classification == 'OKAY').length;
    final poor = reviews.where((r) => r.classification == 'POOR').length;

    return Row(
      children: [
        Expanded(child: _buildMetricTile('Total', total.toString(), AppColors.brandPrimary, Icons.reviews_outlined)),
        const SizedBox(width: 8),
        Expanded(child: _buildMetricTile('Good', good.toString(), AppColors.good, Icons.sentiment_very_satisfied_outlined)),
        const SizedBox(width: 8),
        Expanded(child: _buildMetricTile('Okay', okay.toString(), AppColors.okay, Icons.sentiment_neutral_outlined)),
        const SizedBox(width: 8),
        Expanded(child: _buildMetricTile('Poor', poor.toString(), AppColors.poor, Icons.sentiment_very_dissatisfied_outlined)),
      ],
    );
  }

  Widget _buildMetricTile(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondaryLight)),
        ],
      ),
    );
  }

  Widget _buildReviewTile(BuildContext context, ReviewModel r) {
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
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            r.classification,
            style: TextStyle(color: badgeColor, fontWeight: FontWeight.bold, fontSize: 12),
          ),
        ),
        title: Text(
          'Score: ${r.averageScore.toStringAsFixed(1)} / 3.0',
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
        subtitle: Text(
          r.submittedAt.split('T').first,
          style: const TextStyle(fontSize: 12, color: AppColors.textSecondaryLight),
        ),
        trailing: const Icon(Icons.chevron_right_rounded, size: 20, color: AppColors.textMutedLight),
      ),
    );
  }
}
