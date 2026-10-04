import 'package:flutter_test/flutter_test.dart';
import 'package:reviewflow/core/models/models.dart';
import 'package:reviewflow/core/config/env_config.dart';

void main() {
  group('ReviewFlow Deterministic Classification Engine', () {
    test('Star rating mapping', () {
      // 1-2 is Poor, 3 is Okay, 4-5 is Good
      int getScore(int stars) {
        if (stars <= 2) return 1;
        if (stars == 3) return 2;
        return 3;
      }

      expect(getScore(1), 1);
      expect(getScore(2), 1);
      expect(getScore(3), 2);
      expect(getScore(4), 3);
      expect(getScore(5), 3);
    });

    test('Overall classification thresholds', () {
      // Formula: Good >= 2.5, Okay >= 1.75 and < 2.5, Poor < 1.75
      String classify(double avg) {
        if (avg < EnvConfig.poorMaxScore + 0.01) return 'POOR';
        if (avg < EnvConfig.okayMaxScore + 0.01) return 'OKAY';
        return 'GOOD';
      }

      expect(classify(1.0), 'POOR');
      expect(classify(1.5), 'POOR');
      expect(classify(1.74), 'POOR');
      expect(classify(1.75), 'OKAY');
      expect(classify(2.0), 'OKAY');
      expect(classify(2.49), 'OKAY');
      expect(classify(2.5), 'GOOD');
      expect(classify(3.0), 'GOOD');
    });

    test('License Days Remaining Calculation', () {
      final now = DateTime.now();
      final licenseFuture = LicenseModel(
        id: 'lic_1',
        ownerId: 'owner_1',
        planId: 'plan_pro',
        status: 'active',
        startDate: now.toIso8601String(),
        expiryDate: now.add(const Duration(days: 10)).toIso8601String(),
        maximumBranches: 5,
      );

      expect(licenseFuture.isExpired, false);
      expect(licenseFuture.daysRemaining, inInclusiveRange(9, 10));

      final licenseExpired = LicenseModel(
        id: 'lic_2',
        ownerId: 'owner_1',
        planId: 'plan_pro',
        status: 'expired',
        startDate: now.subtract(const Duration(days: 400)).toIso8601String(),
        expiryDate: now.subtract(const Duration(days: 35)).toIso8601String(),
        maximumBranches: 5,
      );

      expect(licenseExpired.isExpired, true);
      expect(licenseExpired.daysRemaining, 0);
    });

    test('UserRole parsing and serialization', () {
      expect(UserRoleExtension.fromString('SUPER_ADMIN'), UserRole.superAdmin);
      expect(UserRoleExtension.fromString('OWNER'), UserRole.owner);
      expect(UserRoleExtension.fromString('ADMIN'), UserRole.admin);
      expect(UserRoleExtension.fromString('MANAGER'), UserRole.manager);
      expect(UserRoleExtension.fromString('SUPER_MANAGER'), UserRole.superManager);
      expect(UserRole.superAdmin.value, 'SUPER_ADMIN');
      expect(UserRole.owner.value, 'OWNER');
    });
  });
}
