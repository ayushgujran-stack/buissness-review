import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../config/env_config.dart';

class FirebaseService {
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;

    try {
      if (kIsWeb) {
        await Firebase.initializeApp(
          options: const FirebaseOptions(
            apiKey: EnvConfig.firebaseApiKey,
            appId: EnvConfig.firebaseAppId,
            messagingSenderId: EnvConfig.firebaseMessagingSenderId,
            projectId: EnvConfig.firebaseProjectId,
            storageBucket: EnvConfig.firebaseStorageBucket,
            authDomain: EnvConfig.firebaseAuthDomain,
          ),
        );
      } else {
        // Native platforms (Android, iOS)
        await Firebase.initializeApp();
      }

      // Configure Local Emulators in Dev Mode if enabled
      if (EnvConfig.useFirebaseEmulator) {
        final host = EnvConfig.emulatorHost;

        try {
          await FirebaseAuth.instance.useAuthEmulator(host, EnvConfig.authEmulatorPort);
          FirebaseFirestore.instance.useFirestoreEmulator(host, EnvConfig.firestoreEmulatorPort);
          await FirebaseStorage.instance.useStorageEmulator(host, EnvConfig.storageEmulatorPort);
          debugPrint('Connected to Firebase Local Emulators on $host');
        } catch (e) {
          debugPrint('Emulator setup notice: $e');
        }
      }

      _initialized = true;
    } catch (e) {
      debugPrint('Firebase initialization notice: $e');
    }
  }
}
