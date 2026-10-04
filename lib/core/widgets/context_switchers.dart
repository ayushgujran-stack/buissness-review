import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/providers.dart';
import '../theme/app_theme.dart';

class BusinessSwitcherButton extends ConsumerWidget {
  const BusinessSwitcherButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedBiz = ref.watch(selectedBusinessProvider);
    final businessesAsync = ref.watch(businessesStreamProvider);

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        businessesAsync.whenData((businesses) {
          showModalBottomSheet(
            context: context,
            backgroundColor: AppColors.surfaceLight,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (ctx) {
              return SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        child: Text(
                          'Switch Business Context',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const Divider(),
                      ListTile(
                        leading: const Icon(Icons.apps_rounded, color: AppColors.brandPrimary),
                        title: const Text('All Businesses', style: TextStyle(fontWeight: FontWeight.w600)),
                        trailing: selectedBiz == null ? const Icon(Icons.check, color: AppColors.brandPrimary) : null,
                        onTap: () {
                          ref.read(selectedBusinessProvider.notifier).state = null;
                          ref.read(selectedBranchProvider.notifier).state = null;
                          Navigator.pop(ctx);
                        },
                      ),
                      ...businesses.map((b) {
                        final isSelected = selectedBiz?.id == b.id;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.brandLight,
                            child: Text(
                              b.name.isNotEmpty ? b.name[0].toUpperCase() : 'B',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.brandPrimary),
                            ),
                          ),
                          title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.w500)),
                          subtitle: Text(b.category, style: const TextStyle(fontSize: 12)),
                          trailing: isSelected ? const Icon(Icons.check, color: AppColors.brandPrimary) : null,
                          onTap: () {
                            ref.read(selectedBusinessProvider.notifier).state = b;
                            ref.read(selectedBranchProvider.notifier).state = null;
                            Navigator.pop(ctx);
                          },
                        );
                      }),
                    ],
                  ),
                ),
              );
            },
          );
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.brandLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.brandPrimary.withValues(alpha: 0.2)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.storefront_outlined, size: 18, color: AppColors.brandPrimary),
            const SizedBox(width: 6),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 140),
              child: Text(
                selectedBiz?.name ?? 'All Businesses',
                style: const TextStyle(
                  color: AppColors.brandPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 18, color: AppColors.brandPrimary),
          ],
        ),
      ),
    );
  }
}

class BranchSwitcherButton extends ConsumerWidget {
  const BranchSwitcherButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedBranch = ref.watch(selectedBranchProvider);
    final branchesAsync = ref.watch(branchesStreamProvider);

    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () {
        branchesAsync.whenData((branches) {
          showModalBottomSheet(
            context: context,
            backgroundColor: AppColors.surfaceLight,
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (ctx) {
              return SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                        child: Text(
                          'Switch Branch Location',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const Divider(),
                      ListTile(
                        leading: const Icon(Icons.place_outlined, color: AppColors.brandPrimary),
                        title: const Text('All Branches', style: TextStyle(fontWeight: FontWeight.w600)),
                        trailing: selectedBranch == null ? const Icon(Icons.check, color: AppColors.brandPrimary) : null,
                        onTap: () {
                          ref.read(selectedBranchProvider.notifier).state = null;
                          Navigator.pop(ctx);
                        },
                      ),
                      ...branches.map((br) {
                        final isSelected = selectedBranch?.id == br.id;
                        return ListTile(
                          leading: const Icon(Icons.location_on_outlined, color: AppColors.textSecondaryLight),
                          title: Text(br.name, style: const TextStyle(fontWeight: FontWeight.w500)),
                          trailing: isSelected ? const Icon(Icons.check, color: AppColors.brandPrimary) : null,
                          onTap: () {
                            ref.read(selectedBranchProvider.notifier).state = br;
                            Navigator.pop(ctx);
                          },
                        );
                      }),
                    ],
                  ),
                ),
              );
            },
          );
        });
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.borderLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondaryLight),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: Text(
                selectedBranch?.name ?? 'All Branches',
                style: const TextStyle(
                  color: AppColors.textPrimaryLight,
                  fontWeight: FontWeight.w500,
                  fontSize: 12,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 2),
            const Icon(Icons.keyboard_arrow_down_rounded, size: 16, color: AppColors.textSecondaryLight),
          ],
        ),
      ),
    );
  }
}
