import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import { auth, db } from '../../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendEmailVerification, signOut } from 'firebase/auth';
import { Lock, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen({ onBack }: { onBack?: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: false,
      })
    ]).start();
  }, []);

  const handleAuth = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      if (isLogin) {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        if (!userCred.user.emailVerified) {
          // Resend verification email
          await sendEmailVerification(userCred.user);
          await signOut(auth);
          setError('Your email is not verified. A new verification link has been sent to your inbox.');
          setLoading(false);
          return;
        }
      } else {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), { role: 'owner' }, { merge: true });
        
        // Send email verification
        await sendEmailVerification(userCred.user);
        
        // Sign out unverified user immediately
        await signOut(auth);
        
        setError('Verification email sent! Please check your inbox and verify your email before logging in.');
        setIsLogin(true); // Switch to sign-in so they can sign in after verifying
      }
    } catch (err: any) {
      // Clean up Firebase error messages
      const errorMsg = err.message || 'Authentication failed';
      if (errorMsg.includes('auth/invalid-credential')) {
        setError('Invalid email or password');
      } else if (errorMsg.includes('auth/email-already-in-use')) {
        setError('This email is already registered');
      } else if (errorMsg.includes('auth/weak-password')) {
        setError('Password must be at least 6 characters');
      } else {
        setError('Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    if (Platform.OS !== 'web') {
      setError('Google Sign-In requires native setup on iOS/Android. Please use Web for now.');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const userCred = await signInWithPopup(auth, provider);
      
      // If it's a new user, they won't have a role yet. Check if doc exists.
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      if (!userDoc.exists() || !userDoc.data().role) {
        await setDoc(doc(db, 'users', userCred.user.uid), { role: 'owner' }, { merge: true });
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft color="#000000" size={24} />
          </TouchableOpacity>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>ReVu</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Welcome back, Owner' : 'Create an Owner Account'}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>EMAIL ADDRESS</Text>
          <View style={[styles.inputContainer, emailFocused && styles.inputContainerFocused]}>
            <Mail color={emailFocused ? "#000000" : "#94a3b8"} size={20} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="owner@restaurant.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>PASSWORD</Text>
          <View style={[styles.inputContainer, passwordFocused && styles.inputContainerFocused]}>
            <Lock color={passwordFocused ? "#000000" : "#94a3b8"} size={20} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secureTextEntry}
              autoCapitalize="none"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
            <TouchableOpacity onPress={() => setSecureTextEntry(!secureTextEntry)} style={styles.eyeIcon}>
              {secureTextEntry ? <EyeOff color={passwordFocused ? "#000000" : "#94a3b8"} size={20} /> : <Eye color={passwordFocused ? "#000000" : "#94a3b8"} size={20} />}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.googleButton]} 
          onPress={handleGoogleAuth}
          disabled={loading}
        >
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          <Text style={styles.switchText}>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <Text style={styles.switchTextBold}>
              {isLogin ? 'Register here' : 'Sign in'}
            </Text>
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 10,
  },
  backButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 8,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
    letterSpacing: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: '#000000',
    borderWidth: 2,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      }
    })
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  googleButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    marginTop: 16,
    shadowOpacity: 0.03,
  },
  googleButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  switchButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  switchTextBold: {
    color: '#000000',
    fontWeight: '700',
  }
});
