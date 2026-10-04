import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/providers.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/context_switchers.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reviewsAsync = ref.watch(reviewsStreamProvider);
    final branchesAsync = ref.watch(branchesStreamProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Analytics', style: TextStyle(fontWeight: FontWeight.bold)),
        actions: const [
          Padding(padding: EdgeInsets.only(right: 12), child: BusinessSwitcherButton()),
        ],
      ),
      body: reviewsAsync.when(
        data: (reviews) {
          if (reviews.isEmpty) {
            return const Center(
              child: Text('No review data available to generate analytics.'),
            );
          }

          final total = reviews.length;
          final goodCount = reviews.where((r) => r.classification == 'GOOD').length;
          final okayCount = reviews.where((r) => r.classification == 'OKAY').length;
          final poorCount = reviews.where((r) => r.classification == 'POOR').length;

          final goodPct = total > 0 ? (goodCount / total * 100).toStringAsFixed(1) : '0';
          final okayPct = total > 0 ? (okayCount / total * 100).toStringAsFixed(1) : '0';
          final poorPct = total > 0 ? (poorCount / total * 100).toStringAsFixed(1) : '0';

          final avgScore = total > 0
              ? (reviews.map((r) => r.averageScore).reduce((a, b) => a + b) / total).toStringAsFixed(2)
              : '0.00';

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top KPI Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: AppColors.brandPrimary,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      const Text('Average Overall Score', style: TextStyle(color: Colors.white70, fontSize: 13)),
                      const SizedBox(height: 6),
                      Text('$avgScore / 3.0', style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 6),
                      Text('Based on $total real customer responses', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Sentiment Breakdown
                const Text('Sentiment Distribution', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                _buildSentimentBar('Good Experience (3.0)', goodCount, '$goodPct%', AppColors.good),
                const SizedBox(height: 8),
                _buildSentimentBar('Okay Experience (2.0)', okayCount, '$okayPct%', AppColors.okay),
                const SizedBox(height: 8),
                _buildSentimentBar('Poor Experience (1.0)', poorCount, '$poorPct%', AppColors.poor),
                const SizedBox(height: 24),

                // Branch Comparison
                const Text('Branch Comparison', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                branchesAsync.when(
                  data: (branches) {
                    if (branches.isEmpty) return const Text('No branches available.');
                    return Column(
                      children: branches.map((br) {
                        final branchReviews = reviews.where((r) => r.branchId == br.id).toList();
                        final count = branchReviews.length;
                        final score = count > 0
                            ? (branchReviews.map((r) => r.averageScore).reduce((a, b) => a + b) / count).toStringAsFixed(1)
                            : 'N/A';

                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const Icon(Icons.place_outlined, color: AppColors.brandPrimary),
                            title: Text(br.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            subtitle: Text('$count reviews received', style: const TextStyle(fontSize: 12)),
                            trailing: Text(
                              'Avg: $score',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.brandPrimary),
                            ),
                          ),
                        );
                      }).toList(),
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Error: $e'),
                ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
      ),
    );
  }

  Widget _buildSentimentBar(String label, int count, String percentage, Color color) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderLight),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
              const SizedBox(width: 10),
              Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
            ],
          ),
          Text('$count ($percentage)', style: TextStyle(fontWeight: FontWeight.bold, color: color, fontSize: 13)),
        ],
      ),
    );
  }
}
