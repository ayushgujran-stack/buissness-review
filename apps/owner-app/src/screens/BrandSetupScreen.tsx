import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { Building2, LogOut, CheckCircle, Upload, Trash2 } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function BrandSetupScreen() {
  const { setBrandId } = useUser();
  const [username, setUsername] = useState('');
  const [brandName, setBrandName] = useState('');
  const [logoBase64, setLogoBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [brandNameFocused, setBrandNameFocused] = useState(false);

  const handleSelectLogo = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 500 * 1024) {
            setError('Logo size should be under 500 KB');
            return;
          }
          const reader = new FileReader();
          reader.onload = (event) => {
            setLogoBase64(event.target?.result as string);
            setError('');
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert("Logo upload is supported on Web browsers.");
    }
  };

  const handleSave = async () => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanBrandName = brandName.trim();

    if (!cleanUsername || !cleanBrandName) {
      setError('Please fill in all fields');
      return;
    }
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Use the username as the document ID to ensure uniqueness easily
      const brandRef = doc(db, 'brands', cleanUsername);
      const brandSnap = await getDoc(brandRef);

      if (brandSnap.exists()) {
        setError('This username is already taken. Please choose another.');
        setLoading(false);
        return;
      }

      // Create the brand
      await setDoc(brandRef, {
        username: cleanUsername,
        name: cleanBrandName,
        ownerUid: auth.currentUser?.uid,
        logo: logoBase64 || "",
        createdAt: new Date()
      });

      // Update user context
      await setBrandId(cleanUsername);

    } catch (err: any) {
      console.error(err);
      setError('An error occurred while creating your brand.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Building2 color="#000000" size={48} strokeWidth={1.5} />
          <Text style={styles.title}>Brand Setup</Text>
          <Text style={styles.subtitle}>Register your franchise name and unique username.</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>UNIQUE USERNAME</Text>
          <View style={[styles.inputContainer, usernameFocused && styles.inputContainerFocused]}>
            <TextInput
              style={styles.input}
              placeholder="e.g. mcdonalds"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={(text) => {
                setUsername(text.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setUsernameFocused(true)}
              onBlur={() => setUsernameFocused(false)}
            />
          </View>
          <Text style={styles.helperText}>Managers will use this to find your branches.</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>BRAND NAME</Text>
          <View style={[styles.inputContainer, brandNameFocused && styles.inputContainerFocused]}>
            <TextInput
              style={styles.input}
              placeholder="e.g. McDonald's Global"
              placeholderTextColor="#94a3b8"
              value={brandName}
              onChangeText={setBrandName}
              autoCorrect={false}
              onFocus={() => setBrandNameFocused(true)}
              onBlur={() => setBrandNameFocused(false)}
            />
          </View>
        </View>

        {/* Optional Logo Upload */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>RESTAURANT LOGO (OPTIONAL)</Text>
          {logoBase64 ? (
            <View style={styles.previewLogoCard}>
              <Image source={{ uri: logoBase64 }} style={styles.previewLogoImage} />
              <View style={styles.previewLogoInfo}>
                <Text style={styles.logoSuccessText}>Uploaded Successfully</Text>
                <TouchableOpacity onPress={() => setLogoBase64('')} style={styles.removeLogoButton}>
                  <Trash2 size={14} color="#ef4444" style={{ marginRight: 4 }} />
                  <Text style={styles.removeLogoText}>Remove Logo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity 
              style={styles.uploadCard} 
              onPress={handleSelectLogo}
            >
              <Upload size={22} color="#64748b" style={{ marginBottom: 6 }} />
              <Text style={styles.uploadCardText}>Select Brand Logo File</Text>
              <Text style={styles.uploadCardSubtext}>Supports PNG, JPG under 500KB</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleSave}
          disabled={loading || !username || !brandName}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Register Brand</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={() => signOut(auth)}
        >
          <LogOut size={16} color="#ef4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
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
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#000000',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
  logoutButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  // Upload and Logo Preview styles
  uploadCard: {
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
  },
  uploadCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  uploadCardSubtext: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '500',
  },
  previewLogoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
  },
  previewLogoImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    resizeMode: 'contain',
  },
  previewLogoInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  logoSuccessText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#10b981',
  },
  removeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  removeLogoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ef4444',
  }
});
