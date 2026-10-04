enum Environment { dev, staging, prod }

class EnvConfig {
  static Environment currentEnvironment = Environment.dev;

  // Set to true to connect Flutter client to local Firebase Emulators
  static bool useFirebaseEmulator = true;

  // Emulator host configuration (10.0.2.2 for Android emulator, localhost for iOS/Web/macOS)
  static String get emulatorHost {
    // If running in web or desktop/macOS
    return '127.0.0.1';
  }

  static const int authEmulatorPort = 9099;
  static const int firestoreEmulatorPort = 8080;
  static const int storageEmulatorPort = 9199;
  static const int functionsEmulatorPort = 5001;

  // Razorpay Test Keys
  static const String razorpayKeyId = 'rzp_test_reviewflow_mock';

  // Live Firebase Configuration fallback (populated from Firebase Console)
  static const String firebaseApiKey = 'AIzaSyMockKeyForReviewFlowTesting12345';
  static const String firebaseAppId = '1:1234567890:android:abcdef1234567890';
  static const String firebaseMessagingSenderId = '1234567890';
  static const String firebaseProjectId = 'reviewflow-production';
  static const String firebaseStorageBucket = 'reviewflow-production.appspot.com';

  // Deterministic Scoring Thresholds
  static const double poorMaxScore = 1.74;
  static const double okayMaxScore = 2.49;
  static const double goodMinScore = 2.50;
}
