import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList } from 'react-native';
import { Store, ChevronRight, Search, Lock, ArrowLeft } from 'lucide-react-native';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, setDoc } from 'firebase/firestore';

export default function BranchSetupScreen({ onBack }: { onBack?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1
  const [brandUsername, setBrandUsername] = useState('');
  
  // Step 2
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  
  // Step 3
  const [pin, setPin] = useState('');
  const [brandFocused, setBrandFocused] = useState(false);
  const [pinFocused, setPinFocused] = useState(false);

  const handleSearchBrand = async () => {
    const cleanUsername = brandUsername.trim().toLowerCase();
    if (!cleanUsername) return;

    setLoading(true);
    setError('');

    try {
      const brandRef = doc(db, 'brands', cleanUsername);
      const brandSnap = await getDoc(brandRef);

      if (!brandSnap.exists()) {
        setError('Brand not found. Please check the username.');
        setLoading(false);
        return;
      }

      // Brand found, now fetch branches
      const branchesRef = collection(db, 'branches');
      const q = query(branchesRef, where('brandId', '==', cleanUsername));
      const branchSnaps = await getDocs(q);
      
      const branchData: any[] = [];
      branchSnaps.forEach((doc) => {
        const data = doc.data();
        // Show all branches so managers can re-login if needed
        branchData.push({ id: doc.id, ...data });
      });

      if (branchData.length === 0) {
        setError('No branches found for this brand. Please ask your brand owner to create one.');
        setLoading(false);
        return;
      }

      setBranches(branchData);
      setStep(2);
    } catch (err) {
      console.error(err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBranch = (branch: any) => {
    setSelectedBranch(branch);
    setStep(3);
    setError('');
  };

  const handleVerifyPin = async () => {
    if (!pin.trim()) return;

    setLoading(true);
    setError('');

    try {
      if (selectedBranch.pin !== pin.trim()) {
        setError('Incorrect PIN. Please ask your Brand Owner for the correct PIN.');
        setLoading(false);
        return;
      }

      // Log in anonymously (User does not need an email!)
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;

      // Update the user document to set their role and branch
      await setDoc(doc(db, 'users', user.uid), {
        role: 'manager',
        brandId: brandUsername.trim().toLowerCase(),
        branchId: selectedBranch.id
      }, { merge: true });

      // Update the branch to note who claimed it
      const branchRef = doc(db, 'branches', selectedBranch.id);
      await updateDoc(branchRef, {
        managerUid: user.uid,
      });

      // After this, App.tsx will automatically route them to the Dashboard!
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Anonymous Auth is not enabled in Firebase Console.');
      } else {
        setError('An error occurred during verification.');
      }
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
        {step === 1 && onBack && (
          <TouchableOpacity onPress={onBack} style={styles.topBackButton}>
            <ArrowLeft color="#000000" size={24} />
          </TouchableOpacity>
        )}
        
        <View style={styles.header}>
          <Store color="#000000" size={48} strokeWidth={1.5} />
          <Text style={styles.title}>Branch Login</Text>
          <Text style={styles.subtitle}>
            {step === 1 && "Find your restaurant's brand"}
            {step === 2 && "Select your specific branch"}
            {step === 3 && "Enter the PIN to gain access"}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BRAND USERNAME</Text>
              <View style={[styles.inputContainer, brandFocused && styles.inputContainerFocused]}>
                <Search color={brandFocused ? "#000000" : "#94a3b8"} size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. mcdonalds"
                  placeholderTextColor="#94a3b8"
                  value={brandUsername}
                  onChangeText={(text) => {
                    setBrandUsername(text.toLowerCase());
                    setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setBrandFocused(true)}
                  onBlur={() => setBrandFocused(false)}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleSearchBrand}
              disabled={loading || !brandUsername}
            >
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Search Brand</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={[styles.stepContainer, { maxHeight: 300 }]}>
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.branchItem}
                  onPress={() => handleSelectBranch(item)}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={styles.branchName}>{item.name}</Text>
                      {item.managerUid && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>Active</Text>
                        </View>
                      )}
                    </View>
                    {item.address && <Text style={styles.branchAddress}>{item.address}</Text>}
                  </View>
                  <ChevronRight color="#000000" size={20} />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setStep(1)}
            >
              <Text style={styles.backButtonText}>Back to Search</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>BRANCH PIN</Text>
              <View style={[styles.inputContainer, pinFocused && styles.inputContainerFocused]}>
                <Lock color={pinFocused ? "#000000" : "#94a3b8"} size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter PIN"
                  placeholderTextColor="#94a3b8"
                  value={pin}
                  onChangeText={setPin}
                  keyboardType="numeric"
                  secureTextEntry
                  onFocus={() => setPinFocused(true)}
                  onBlur={() => setPinFocused(false)}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleVerifyPin}
              disabled={loading || !pin}
            >
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Login to Branch</Text>}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => setStep(2)}
            >
              <Text style={styles.backButtonText}>Select a different branch</Text>
            </TouchableOpacity>
          </View>
        )}
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
    position: 'relative',
  },
  topBackButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
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
  stepContainer: {
    width: '100%',
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
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  branchName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  branchAddress: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  activeBadgeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  }
});
