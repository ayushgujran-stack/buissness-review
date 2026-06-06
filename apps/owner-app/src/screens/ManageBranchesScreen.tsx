import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Alert, Modal, Image, Switch, ScrollView } from 'react-native';
import { Store, Plus, Lock, QrCode, X, Settings } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { db, auth } from '../../firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import QRCodeFrameModal from '../components/QRCodeFrameModal';

const DEFAULT_QUICK_OPTIONS = ["Food Quality", "Service Speed", "Staff Behavior", "Ambience", "Value for Money", "Cleanliness"];

const DEFAULT_REVIEW_CONFIG = {
  quick: {
    options: [...DEFAULT_QUICK_OPTIONS],
  },
  detailed: {
    food: true,
    service: true,
    ambience: true,
    billing: true,
  },
};

export default function ManageBranchesScreen() {
  const { role, brandId, branchId } = useUser();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchGoogleReviewLink, setNewBranchGoogleReviewLink] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [configGoogleReviewLink, setConfigGoogleReviewLink] = useState('');

  // QR Code Modal State
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedBranchForQr, setSelectedBranchForQr] = useState<any>(null);
  const CUSTOMER_APP_URL = process.env.EXPO_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3000";

  // Review Config Modal/Direct Screen State
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [configQuickOptions, setConfigQuickOptions] = useState<string[]>([...DEFAULT_QUICK_OPTIONS]);
  const [configDetailed, setConfigDetailed] = useState({ food: true, service: true, ambience: true, billing: true });
  const [newCustomOption, setNewCustomOption] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [selectedBranchForConfig, setSelectedBranchForConfig] = useState<any>(null);

  // Manager Request State
  const [branchName, setBranchName] = useState('');
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [managerMessage, setManagerMessage] = useState('');

  useEffect(() => {
    if (role === 'owner') {
      fetchBranches();
    }
  }, [role, brandId]);

  useEffect(() => {
    if (role === 'manager' && branchId) {
      fetchManagerConfig();
    }
  }, [role, branchId]);

  const fetchManagerConfig = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const branchSnap = await getDoc(doc(db, 'branches', branchId));
      if (branchSnap.exists()) {
        const bData = branchSnap.data();
        setBranchName(bData.name || '');
        setConfigGoogleReviewLink(bData.googleReviewLink || '');
        const config = bData.reviewConfig;
        if (config) {
          setConfigQuickOptions([...(config.quick?.options || DEFAULT_QUICK_OPTIONS)]);
          setConfigDetailed({
            food: config.detailed?.food ?? true,
            service: config.detailed?.service ?? true,
            ambience: config.detailed?.ambience ?? true,
            billing: config.detailed?.billing ?? true,
          });
        } else {
          // Fallback to brand config
          if (brandId) {
            const brandSnap = await getDoc(doc(db, 'brands', brandId));
            if (brandSnap.exists()) {
              const brandConfig = brandSnap.data().reviewConfig;
              if (brandConfig) {
                setConfigQuickOptions([...(brandConfig.quick?.options || DEFAULT_QUICK_OPTIONS)]);
                setConfigDetailed({
                  food: brandConfig.detailed?.food ?? true,
                  service: brandConfig.detailed?.service ?? true,
                  ambience: brandConfig.detailed?.ambience ?? true,
                  billing: brandConfig.detailed?.billing ?? true,
                });
                return;
              }
            }
          }
          setConfigQuickOptions([...DEFAULT_QUICK_OPTIONS]);
          setConfigDetailed({ food: true, service: true, ambience: true, billing: true });
        }
      }
    } catch (err) {
      console.error("Error fetching manager branch config:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManagerConfig = async () => {
    setManagerMessage('');
    setRequestModalVisible(true);
  };

  const handleSubmitManagerRequest = async () => {
    if (!branchId || !brandId) return;
    setIsSavingConfig(true);
    try {
      const requestRef = collection(db, 'review_requests');
      const newConfig = {
        quick: { options: configQuickOptions },
        detailed: { ...configDetailed },
      };

      await addDoc(requestRef, {
        brandId,
        branchId,
        branchName: branchName || 'My Branch',
        managerUid: auth.currentUser?.uid || 'anonymous',
        message: managerMessage.trim(),
        status: 'pending',
        requestedConfig: newConfig,
        requestedGoogleReviewLink: configGoogleReviewLink.trim(),
        createdAt: serverTimestamp(),
      });

      setRequestModalVisible(false);
      Alert.alert("Request Sent", "Your review configuration change request has been submitted to the owner for approval!");
    } catch (error) {
      console.error("Error submitting request:", error);
      Alert.alert("Error", "Could not submit your request.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const fetchBranches = async () => {
    if (!brandId) return;
    try {
      const q = query(collection(db, 'branches'), where('brandId', '==', brandId));
      const querySnapshot = await getDocs(q);
      const fetchedBranches: any[] = [];
      querySnapshot.forEach((doc) => {
        fetchedBranches.push({ id: doc.id, ...doc.data() });
      });
      setBranches(fetchedBranches);
    } catch (error) {
      console.error("Error fetching branches:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBranch = async () => {
    if (!newBranchName.trim() || !brandId) return;
    
    setIsAdding(true);
    // Generate a simple 6-digit random PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
      const docRef = await addDoc(collection(db, 'branches'), {
        brandId,
        name: newBranchName.trim(),
        address: newBranchAddress.trim(),
        googleReviewLink: newBranchGoogleReviewLink.trim(),
        pin: pin,
        managerUid: null,
        createdAt: new Date(),
      });
      
      setBranches([...branches, {
        id: docRef.id,
        brandId,
        name: newBranchName.trim(),
        address: newBranchAddress.trim(),
        googleReviewLink: newBranchGoogleReviewLink.trim(),
        pin: pin,
        managerUid: null,
      }]);
      
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchGoogleReviewLink('');
    } catch (error) {
      console.error("Error adding branch:", error);
      Alert.alert("Error", "Could not create branch.");
    } finally {
      setIsAdding(false);
    }
  };

  // Open config modal — loads current brand-level config from Firestore
  const openConfigModal = async () => {
    if (!brandId) return;
    setSelectedBranchForConfig(null);
    setLoading(true);
    try {
      const brandDoc = await getDoc(doc(db, 'brands', brandId));
      if (brandDoc.exists()) {
        const config = brandDoc.data().reviewConfig;
        if (config) {
          setConfigQuickOptions([...(config.quick?.options || DEFAULT_QUICK_OPTIONS)]);
          setConfigDetailed({
            food: config.detailed?.food ?? true,
            service: config.detailed?.service ?? true,
            ambience: config.detailed?.ambience ?? true,
            billing: config.detailed?.billing ?? true,
          });
        } else {
          setConfigQuickOptions([...DEFAULT_QUICK_OPTIONS]);
          setConfigDetailed({ food: true, service: true, ambience: true, billing: true });
        }
      }
    } catch (err) {
      console.error('Error loading brand config:', err);
    } finally {
      setLoading(false);
      setNewCustomOption('');
      setConfigModalVisible(true);
    }
  };

  // Open branch-specific config modal
  const openBranchConfigModal = async (branch: any) => {
    setSelectedBranchForConfig(branch);
    setLoading(true);
    try {
      const branchDoc = await getDoc(doc(db, 'branches', branch.id));
      if (branchDoc.exists()) {
        const bData = branchDoc.data();
        setConfigGoogleReviewLink(bData.googleReviewLink || '');
        const config = bData.reviewConfig;
        if (config) {
          setConfigQuickOptions([...(config.quick?.options || DEFAULT_QUICK_OPTIONS)]);
          setConfigDetailed({
            food: config.detailed?.food ?? true,
            service: config.detailed?.service ?? true,
            ambience: config.detailed?.ambience ?? true,
            billing: config.detailed?.billing ?? true,
          });
        } else {
          // Fallback to brand config
          if (brandId) {
            const brandDoc = await getDoc(doc(db, 'brands', brandId));
            if (brandDoc.exists()) {
              const bConfig = brandDoc.data().reviewConfig;
              if (bConfig) {
                setConfigQuickOptions([...(bConfig.quick?.options || DEFAULT_QUICK_OPTIONS)]);
                setConfigDetailed({
                  food: bConfig.detailed?.food ?? true,
                  service: bConfig.detailed?.service ?? true,
                  ambience: bConfig.detailed?.ambience ?? true,
                  billing: bConfig.detailed?.billing ?? true,
                });
                return;
              }
            }
          }
          setConfigQuickOptions([...DEFAULT_QUICK_OPTIONS]);
          setConfigDetailed({ food: true, service: true, ambience: true, billing: true });
        }
      }
    } catch (err) {
      console.error("Error loading branch config:", err);
    } finally {
      setLoading(false);
      setNewCustomOption('');
      setConfigModalVisible(true);
    }
  };

  const toggleQuickOption = (option: string) => {
    if (configQuickOptions.includes(option)) {
      setConfigQuickOptions(configQuickOptions.filter(o => o !== option));
    } else {
      setConfigQuickOptions([...configQuickOptions, option]);
    }
  };

  const addCustomOption = () => {
    const trimmed = newCustomOption.trim();
    if (trimmed && !configQuickOptions.includes(trimmed)) {
      setConfigQuickOptions([...configQuickOptions, trimmed]);
      setNewCustomOption('');
    }
  };

  // Saves review config to the selected branch or brand document
  const handleSaveConfig = async () => {
    if (!brandId) return;
    setIsSavingConfig(true);
    try {
      const newConfig = {
        quick: { options: configQuickOptions },
        detailed: { ...configDetailed },
      };
      if (selectedBranchForConfig) {
        const branchRef = doc(db, 'branches', selectedBranchForConfig.id);
        await updateDoc(branchRef, { 
          reviewConfig: newConfig,
          googleReviewLink: configGoogleReviewLink.trim()
        });
        
        // Update local state so UI updates immediately
        setBranches(prevBranches => 
          prevBranches.map(b => 
            b.id === selectedBranchForConfig.id 
              ? { ...b, reviewConfig: newConfig, googleReviewLink: configGoogleReviewLink.trim() } 
              : b
          )
        );

        Alert.alert("Saved", `Review configuration updated for branch: ${selectedBranchForConfig.name}`);
      } else {
        const brandRef = doc(db, 'brands', brandId);
        await updateDoc(brandRef, { reviewConfig: newConfig });
        Alert.alert("Saved", "Review configuration updated for all branches.");
      }
      setConfigModalVisible(false);
    } catch (error) {
      console.error("Error saving review config:", error);
      Alert.alert("Error", "Could not save review configuration.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.branchCard}>
      <View style={styles.branchHeader}>
        <Text style={styles.branchName}>{item.name}</Text>
        {item.managerUid ? (
          <View style={styles.badgeClaimed}>
            <Text style={styles.badgeTextClaimed}>Claimed</Text>
          </View>
        ) : (
          <View style={styles.badgePending}>
            <Text style={styles.badgeTextPending}>Pending</Text>
          </View>
        )}
      </View>
      {item.address ? <Text style={styles.branchAddress}>{item.address}</Text> : null}
      
      {item.googleReviewLink ? (
        <Text style={styles.branchLinkText} numberOfLines={1}>
          Google Review: {item.googleReviewLink}
        </Text>
      ) : (
        <Text style={[styles.branchLinkText, { color: '#94a3b8', fontStyle: 'italic' }]}>
          No Google Review Link connected
        </Text>
      )}
      
      <View style={styles.actionRow}>
        <View style={styles.pinContainer}>
          <Lock size={14} color="#000000" />
          <Text style={styles.pinLabel}>Invite PIN:</Text>
          <Text style={styles.pinValue}>{item.pin}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.qrButton, { backgroundColor: '#f1f5f9' }]}
            onPress={() => {
              setSelectedBranchForQr(item);
              setQrModalVisible(true);
            }}
          >
            <QrCode size={16} color="#0f172a" />
            <Text style={[styles.qrButtonText, { color: '#0f172a', marginLeft: 4 }]}>QR</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.qrButton}
            onPress={() => openBranchConfigModal(item)}
          >
            <Settings size={16} color="#ffffff" />
            <Text style={[styles.qrButtonText, { marginLeft: 4 }]}>Form</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (role === 'manager') {
    if (loading) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <View style={{ marginBottom: 16, marginTop: 8 }}>
          <Text style={styles.title}>Customize Reviews</Text>
          <Text style={styles.subtitle}>Customize the review form options for your branch</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, width: '100%' }}>
          {/* Quick Review Options */}
          <Text style={[styles.configSectionTitle, { marginTop: 12 }]}>Quick Review Highlights</Text>
          <Text style={styles.configDesc}>Select which highlight chips customers can pick.</Text>
          
          <View style={styles.chipContainer}>
            {[...DEFAULT_QUICK_OPTIONS, ...configQuickOptions.filter(o => !DEFAULT_QUICK_OPTIONS.includes(o))].map(option => {
              const isActive = configQuickOptions.includes(option);
              const isCustom = !DEFAULT_QUICK_OPTIONS.includes(option);
              return (
                <TouchableOpacity 
                  key={option}
                  style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                  onPress={() => toggleQuickOption(option)}
                >
                  <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                    {isCustom ? `✦ ${option}` : option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Add Custom Option */}
          <View style={styles.addOptionRow}>
            <TextInput
              style={styles.addOptionInput}
              placeholder="Add custom option..."
              placeholderTextColor="#94a3b8"
              value={newCustomOption}
              onChangeText={setNewCustomOption}
              onSubmitEditing={addCustomOption}
            />
            <TouchableOpacity 
              style={styles.addOptionButton}
              onPress={addCustomOption}
              disabled={!newCustomOption.trim()}
            >
              <Plus size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Detailed Review Toggles */}
          <Text style={[styles.configSectionTitle, { marginTop: 28 }]}>Detailed Review Sections</Text>
          <Text style={styles.configDesc}>Toggle which categories appear in the detailed form.</Text>

          {([
            { key: 'food', label: 'Food Quality', desc: 'Taste, Temperature, Portion, Presentation, Variety' },
            { key: 'service', label: 'Service', desc: 'Behavior, Speed, Accuracy, Helpfulness' },
            { key: 'ambience', label: 'Ambience', desc: 'Cleanliness, Washroom, Music, Seating' },
            { key: 'billing', label: 'Billing', desc: 'Checkout Speed, Accuracy' },
          ] as const).map(section => (
            <View key={section.key} style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{section.label}</Text>
                <Text style={styles.toggleDesc}>{section.desc}</Text>
              </View>
              <Switch
                value={configDetailed[section.key]}
                onValueChange={(val) => setConfigDetailed(prev => ({ ...prev, [section.key]: val }))}
                trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                thumbColor={configDetailed[section.key] ? '#6366f1' : '#94a3b8'}
              />
            </View>
          ))}

          {/* Google Review Integration */}
          <Text style={[styles.configSectionTitle, { marginTop: 28 }]}>Google Review Connection</Text>
          <Text style={styles.configDesc}>Connect your branch's Google Business Review page URL so positive reviews can be redirected.</Text>
          <TextInput
            style={[styles.input, { marginTop: 12 }]}
            placeholder="e.g. https://g.page/r/YOUR_PLACE_ID/review"
            placeholderTextColor="#94a3b8"
            value={configGoogleReviewLink}
            onChangeText={setConfigGoogleReviewLink}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={{ height: 16 }} />
        </ScrollView>

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.saveConfigButton}
          onPress={handleSaveManagerConfig}
          disabled={isSavingConfig}
        >
          {isSavingConfig ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveConfigButtonText}>Save Configuration</Text>
          )}
        </TouchableOpacity>

        {/* Manager Change Request Modal */}
        <Modal
          visible={requestModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setRequestModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setRequestModalVisible(false)}
              >
                <X color="#000000" size={24} />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Request Form Change</Text>
              <Text style={styles.modalSubtitle}>
                Please explain why you want to change the review configuration for this branch (optional).
              </Text>

              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12, marginTop: 16, width: '100%' }]}
                placeholder="e.g. We want to collect feedback on service speed and behavior..."
                placeholderTextColor="#94a3b8"
                multiline={true}
                numberOfLines={4}
                value={managerMessage}
                onChangeText={setManagerMessage}
              />

              <TouchableOpacity 
                style={[styles.addButton, { backgroundColor: '#6366f1', marginTop: 16, width: '100%' }]}
                onPress={handleSubmitManagerRequest}
                disabled={isSavingConfig}
              >
                {isSavingConfig ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.addButtonText}>Submit Request to Owner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? [] : branches}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Brand-level Review Config Button */}
            <TouchableOpacity style={styles.configBanner} onPress={openConfigModal}>
              <View style={styles.configBannerLeft}>
                <Settings size={20} color="#6366f1" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={styles.configBannerTitle}>Customize Review Form</Text>
                  <Text style={styles.configBannerDesc}>Choose what customers review — applies to all branches</Text>
                </View>
              </View>
              <Text style={styles.configBannerArrow}>›</Text>
            </TouchableOpacity>

            <View style={styles.addSection}>
              <Text style={styles.sectionTitle}>Add New Branch</Text>
              <TextInput
                style={styles.input}
                placeholder="Branch Name (e.g. Downtown Ave)"
                placeholderTextColor="#94a3b8"
                value={newBranchName}
                onChangeText={setNewBranchName}
              />
              <TextInput
                style={styles.input}
                placeholder="Address (Optional)"
                placeholderTextColor="#94a3b8"
                value={newBranchAddress}
                onChangeText={setNewBranchAddress}
              />
              <TextInput
                style={styles.input}
                placeholder="Google Review Link (Optional)"
                placeholderTextColor="#94a3b8"
                value={newBranchGoogleReviewLink}
                onChangeText={setNewBranchGoogleReviewLink}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity 
                style={styles.addButton}
                onPress={handleAddBranch}
                disabled={isAdding || !newBranchName.trim()}
              >
                {isAdding ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Plus color="#ffffff" size={20} style={{ marginRight: 8 }} />
                    <Text style={styles.addButtonText}>Create Branch</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Your Branches ({branches.length})</Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#000000" style={{ marginTop: 40 }} />
          ) : (
            <Text style={styles.emptyText}>No branches created yet. Create one above!</Text>
          )
        }
      />

      {/* Premium Customizable QR Code Poster & Downloader Modal */}
      <QRCodeFrameModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
        branchId={selectedBranchForQr?.id || ''}
        branchName={selectedBranchForQr?.name || ''}
        brandId={brandId || ''}
      />

      {/* Brand-Level Review Config Modal */}
      <Modal
        visible={configModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setConfigModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setConfigModalVisible(false)}
            >
              <X color="#000000" size={24} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Customize Reviews</Text>
            <Text style={styles.modalSubtitle}>
              {selectedBranchForConfig ? `Branch: ${selectedBranchForConfig.name}` : 'Applies to all branches'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ width: '100%' }}>
              {/* Google Review Link (only for branch-level config) */}
              {selectedBranchForConfig && (
                <View style={{ marginBottom: 24 }}>
                  <Text style={styles.configSectionTitle}>GOOGLE REVIEW LINK</Text>
                  <Text style={styles.configDesc}>Connect this branch's Google review URL.</Text>
                  <TextInput
                    style={[styles.input, { marginTop: 8 }]}
                    placeholder="e.g. https://g.page/r/YOUR_PLACE_ID/review"
                    placeholderTextColor="#94a3b8"
                    value={configGoogleReviewLink}
                    onChangeText={setConfigGoogleReviewLink}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              )}
              {/* Quick Review Options */}
              <Text style={styles.configSectionTitle}>QUICK REVIEW HIGHLIGHTS</Text>
              <Text style={styles.configDesc}>Select which highlight chips customers can pick.</Text>
              
              <View style={styles.chipContainer}>
                {[...DEFAULT_QUICK_OPTIONS, ...configQuickOptions.filter(o => !DEFAULT_QUICK_OPTIONS.includes(o))].map(option => {
                  const isActive = configQuickOptions.includes(option);
                  const isCustom = !DEFAULT_QUICK_OPTIONS.includes(option);
                  return (
                    <TouchableOpacity 
                      key={option}
                      style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                      onPress={() => toggleQuickOption(option)}
                    >
                      <Text style={[styles.chipText, isActive ? styles.chipTextActive : styles.chipTextInactive]}>
                        {isCustom ? `✦ ${option}` : option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Add Custom Option */}
              <View style={styles.addOptionRow}>
                <TextInput
                  style={styles.addOptionInput}
                  placeholder="Add custom option..."
                  placeholderTextColor="#94a3b8"
                  value={newCustomOption}
                  onChangeText={setNewCustomOption}
                  onSubmitEditing={addCustomOption}
                />
                <TouchableOpacity 
                  style={styles.addOptionButton}
                  onPress={addCustomOption}
                  disabled={!newCustomOption.trim()}
                >
                  <Plus size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>

              {/* Detailed Review Toggles */}
              <Text style={[styles.configSectionTitle, { marginTop: 28 }]}>DETAILED REVIEW SECTIONS</Text>
              <Text style={styles.configDesc}>Toggle which categories appear in the detailed form.</Text>

              {([
                { key: 'food', label: 'Food Quality', desc: 'Taste, Temperature, Portion, Presentation, Variety' },
                { key: 'service', label: 'Service', desc: 'Behavior, Speed, Accuracy, Helpfulness' },
                { key: 'ambience', label: 'Ambience', desc: 'Cleanliness, Washroom, Music, Seating' },
                { key: 'billing', label: 'Billing', desc: 'Checkout Speed, Accuracy' },
              ] as const).map(section => (
                <View key={section.key} style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>{section.label}</Text>
                    <Text style={styles.toggleDesc}>{section.desc}</Text>
                  </View>
                  <Switch
                    value={configDetailed[section.key]}
                    onValueChange={(val) => setConfigDetailed(prev => ({ ...prev, [section.key]: val }))}
                    trackColor={{ false: '#e2e8f0', true: '#c7d2fe' }}
                    thumbColor={configDetailed[section.key] ? '#6366f1' : '#94a3b8'}
                  />
                </View>
              ))}

              <View style={{ height: 16 }} />
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity 
              style={styles.saveConfigButton}
              onPress={handleSaveConfig}
              disabled={isSavingConfig}
            >
              {isSavingConfig ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveConfigButtonText}>Save Configuration</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manager Change Request Modal */}
      <Modal
        visible={requestModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setRequestModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setRequestModalVisible(false)}
            >
              <X color="#000000" size={24} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Request Form Change</Text>
            <Text style={styles.modalSubtitle}>
              Please explain why you want to change the review configuration for this branch (optional).
            </Text>

            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 12, marginTop: 16 }]}
              placeholder="e.g. We want to collect feedback on service speed and behavior..."
              placeholderTextColor="#94a3b8"
              multiline={true}
              numberOfLines={4}
              value={managerMessage}
              onChangeText={setManagerMessage}
            />

            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: '#6366f1', marginTop: 16 }]}
              onPress={handleSubmitManagerRequest}
              disabled={isSavingConfig}
            >
              {isSavingConfig ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.addButtonText}>Submit Request to Owner</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  configBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0f0ff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  configBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  configBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4338ca',
    letterSpacing: -0.2,
  },
  configBannerDesc: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
    marginTop: 2,
  },
  configBannerArrow: {
    fontSize: 28,
    color: '#6366f1',
    fontWeight: '300',
    marginLeft: 8,
  },
  addSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 12,
    fontSize: 15,
    color: '#000000',
    fontWeight: '500',
  },
  addButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  branchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  branchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  branchName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
    letterSpacing: -0.3,
  },
  branchAddress: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    fontWeight: '500',
  },
  pinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pinLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    marginLeft: 6,
    marginRight: 6,
  },
  pinValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 1,
  },
  badgeClaimed: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextClaimed: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  badgePending: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeTextPending: {
    color: '#d97706',
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: '#64748b',
    marginTop: 30,
    fontSize: 15,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  qrButton: {
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#000000',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
    marginBottom: 24,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 24,
  },
  qrInstruction: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Review Config Modal Styles
  configSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6366f1',
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  configDesc: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipActive: {
    backgroundColor: '#eef2ff',
    borderColor: '#6366f1',
  },
  chipInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#6366f1',
  },
  chipTextInactive: {
    color: '#94a3b8',
  },
  addOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  addOptionInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 42,
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  addOptionButton: {
    backgroundColor: '#6366f1',
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090b',
  },
  toggleDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontWeight: '500',
  },
  saveConfigButton: {
    backgroundColor: '#6366f1',
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  saveConfigButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  branchLinkText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 16,
  },
});
