enum Environment { dev, staging, prod }

class EnvConfig {
  static Environment currentEnvironment = Environment.dev;

  // Set to true to connect Flutter client to local Firebase Emulators
  static bool useFirebaseEmulator = true;

  // Emulator host configuration (10.0.2.2 for Android emulator, localhost for iOS/Web/macOS)
  static String get emulatorHost {
    return 'localhost';
  }

  static const int authEmulatorPort = 9099;
  static const int firestoreEmulatorPort = 8080;
  static const int storageEmulatorPort = 9199;
  static const int functionsEmulatorPort = 5001;

  // Razorpay Test Keys
  static const String razorpayKeyId = 'rzp_test_reviewflow_mock';

  // Live Firebase Configuration fallback (populated from Firebase Console or local demo mode)
  static const String firebaseApiKey = 'AIzaSyReviewFlowTestingKeyMock123456789';
  static const String firebaseAppId = '1:123456789012:web:abcdef1234567890abcdef';
  static const String firebaseMessagingSenderId = '123456789012';
  static const String firebaseProjectId = 'demo-reviewflow';
  static const String firebaseStorageBucket = 'demo-reviewflow.appspot.com';
  static const String firebaseAuthDomain = 'demo-reviewflow.firebaseapp.com';

  // Deterministic Scoring Thresholds
  static const double poorMaxScore = 1.74;
  static const double okayMaxScore = 2.49;
  static const double goodMinScore = 2.50;
}
