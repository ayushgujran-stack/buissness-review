import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/models.dart';
import '../services/auth_service.dart';

// Services
final authServiceProvider = Provider<AuthService>((ref) => AuthService());

// Auth State Provider
final authStateProvider = StreamProvider<dynamic>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

// Current User Profile Provider
final currentUserProfileProvider = FutureProvider<UserModel?>((ref) async {
  final authUser = ref.watch(authStateProvider).value;
  if (authUser == null) return null;
  return ref.watch(authServiceProvider).getCurrentUserProfile();
});

// Global Context State: Selected Business (null = All Businesses)
final selectedBusinessProvider = StateProvider<BusinessModel?>((ref) => null);

// Global Context State: Selected Branch (null = All Branches)
final selectedBranchProvider = StateProvider<BranchModel?>((ref) => null);

// Businesses Stream Provider for active tenant
final businessesStreamProvider = StreamProvider<List<BusinessModel>>((ref) {
  final userProfile = ref.watch(currentUserProfileProvider).value;
  if (userProfile == null) return Stream.value([]);

  final firestore = FirebaseFirestore.instance;

  // If super admin, can view all active businesses
  Query query = firestore.collection('businesses').where('status', isEqualTo: 'active');
  if (userProfile.role != UserRole.superAdmin) {
    query = query.where('owner_id', isEqualTo: userProfile.ownerId);
  }

  return query.snapshots().map((snapshot) {
    return snapshot.docs
        .map((doc) => BusinessModel.fromMap(doc.data() as Map<String, dynamic>, doc.id))
        .toList();
  });
});

// Branches Stream Provider for selected business / tenant
final branchesStreamProvider = StreamProvider<List<BranchModel>>((ref) {
  final userProfile = ref.watch(currentUserProfileProvider).value;
  final selectedBiz = ref.watch(selectedBusinessProvider);
  if (userProfile == null) return Stream.value([]);

  final firestore = FirebaseFirestore.instance;
  Query query = firestore.collection('branches').where('status', isEqualTo: 'active');

  if (userProfile.role != UserRole.superAdmin) {
    query = query.where('owner_id', isEqualTo: userProfile.ownerId);
  }

  if (selectedBiz != null) {
    query = query.where('business_id', isEqualTo: selectedBiz.id);
  }

  return query.snapshots().map((snapshot) {
    return snapshot.docs
        .map((doc) => BranchModel.fromMap(doc.data() as Map<String, dynamic>, doc.id))
        .toList();
  });
});

// Active License Provider
final activeLicenseProvider = StreamProvider<LicenseModel?>((ref) {
  final userProfile = ref.watch(currentUserProfileProvider).value;
  if (userProfile == null) return Stream.value(null);

  final firestore = FirebaseFirestore.instance;
  return firestore
      .collection('licenses')
      .where('owner_id', isEqualTo: userProfile.ownerId)
      .limit(1)
      .snapshots()
      .map((snap) {
    if (snap.docs.isEmpty) return null;
    return LicenseModel.fromMap(snap.docs.first.data(), snap.docs.first.id);
  });
});

// Reviews Stream Provider filtered by context
final reviewsStreamProvider = StreamProvider<List<ReviewModel>>((ref) {
  final userProfile = ref.watch(currentUserProfileProvider).value;
  final selectedBiz = ref.watch(selectedBusinessProvider);
  final selectedBr = ref.watch(selectedBranchProvider);
  if (userProfile == null) return Stream.value([]);

  final firestore = FirebaseFirestore.instance;
  Query query = firestore.collection('reviews');

  if (userProfile.role != UserRole.superAdmin) {
    query = query.where('owner_id', isEqualTo: userProfile.ownerId);
  }

  if (selectedBiz != null) {
    query = query.where('business_id', isEqualTo: selectedBiz.id);
  }

  if (selectedBr != null) {
    query = query.where('branch_id', isEqualTo: selectedBr.id);
  }

  return query.orderBy('submitted_at', descending: true).snapshots().map((snap) {
    return snap.docs
        .map((d) => ReviewModel.fromMap(d.data() as Map<String, dynamic>, d.id))
        .toList();
  });
});
