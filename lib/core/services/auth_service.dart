import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/models.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  /// Retrieves user profile from Firestore with role, owner_id, and status
  Future<UserModel?> getCurrentUserProfile() async {
    final user = _auth.currentUser;
    if (user == null) return null;

    final doc = await _firestore.collection('users').doc(user.uid).get();
    if (!doc.exists) return null;

    return UserModel.fromMap(doc.data()!, doc.id);
  }

  /// Sign In with Email & Password
  Future<UserModel> signIn({required String email, required String password}) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    final uid = credential.user!.uid;
    final userDoc = await _firestore.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw Exception('User profile not found in database.');
    }

    final userModel = UserModel.fromMap(userDoc.data()!, userDoc.id);

    if (userModel.status == 'deactivated' || userModel.status == 'suspended') {
      await _auth.signOut();
      throw Exception('Your account is ${userModel.status}. Please contact support.');
    }

    return userModel;
  }

  /// Owner Registration Flow
  /// Creates Auth account + Firestore user record + Configurable Trial License
  Future<UserModel> registerOwner({
    required String name,
    required String email,
    required String mobile,
    required String password,
  }) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    final uid = credential.user!.uid;
    final now = DateTime.now().toUtc().toIso8601String();

    // 1. Create User Document
    final userModel = UserModel(
      id: uid,
      authUid: uid,
      role: UserRole.owner,
      ownerId: uid, // Owner is tenant root
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      status: 'active',
      forcePasswordChange: false,
    );

    final batch = _firestore.batch();
    batch.set(_firestore.collection('users').doc(uid), userModel.toMap());

    // 2. Create Trial License (15 days, 3 branches capacity)
    final licenseRef = _firestore.collection('licenses').doc();
    final expiryDate = DateTime.now().add(const Duration(days: 15)).toUtc().toIso8601String();

    batch.set(licenseRef, {
      'id': licenseRef.id,
      'owner_id': uid,
      'plan_id': 'plan_trial',
      'status': 'trial',
      'start_date': now,
      'expiry_date': expiryDate,
      'maximum_branches': 3,
      'created_at': now,
      'updated_at': now,
    });

    // 3. Create Audit Log
    final auditRef = _firestore.collection('audit_logs').doc();
    batch.set(auditRef, {
      'id': auditRef.id,
      'owner_id': uid,
      'actor_user_id': uid,
      'action': 'OWNER_REGISTERED_TRIAL_STARTED',
      'entity_type': 'USER',
      'entity_id': uid,
      'metadata': {
        'name': name,
        'email': email,
        'trial_days': 15,
        'branch_limit': 3,
      },
      'created_at': now,
    });

    await batch.commit();
    return userModel;
  }

  /// Change Password (Mandatory for Super Admin first login)
  Future<void> changePassword(String newPassword) async {
    final user = _auth.currentUser;
    if (user == null) throw Exception('Not authenticated.');

    await user.updatePassword(newPassword);
    await _firestore.collection('users').doc(user.uid).update({
      'force_password_change': false,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  /// Password Reset
  Future<void> sendPasswordResetEmail(String email) async {
    await _auth.sendPasswordResetEmail(email: email.trim());
  }

  /// Sign Out
  Future<void> signOut() async {
    await _auth.signOut();
  }
}
