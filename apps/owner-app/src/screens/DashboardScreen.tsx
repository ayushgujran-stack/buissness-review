import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, ActivityIndicator, TouchableOpacity, Modal, Image, Platform, Alert } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { QrCode, X, Upload, Mail } from 'lucide-react-native';
import { useFeedbacks } from '../hooks/useFeedbacks';
import { useUser } from '../context/UserContext';
import ReviewSlideshow from '../components/AI/ReviewSlideshow';
import AIInsightsCard from '../components/AI/AIInsightsCard';
import ChatbotCard from '../components/AI/ChatbotCard';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import QRCodeFrameModal from '../components/QRCodeFrameModal';

const screenWidth = Dimensions.get('window').width;

// Reusable Modern Card Component with Animation
export const ModernCard = ({ children, color = 'rgba(255, 255, 255, 0.8)', delay = 0 }: { children: React.ReactNode, color?: string, delay?: number }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.cardContainer, { backgroundColor: color, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
};

export default function DashboardScreen({ navigation }: { navigation: any }) {
  const { role, brandId, branchId } = useUser();
  const { feedbacks, loading } = useFeedbacks(branchId);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [branchName, setBranchName] = useState('My Branch');

  // Brand Logo State
  const [brandLogo, setBrandLogo] = useState('');
  const [brandNameStr, setBrandNameStr] = useState('');
  const [updatingLogo, setUpdatingLogo] = useState(false);

  // Pending reviews count state for top right badge
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (branchId) {
      const fetchBranchName = async () => {
        try {
          const docRef = doc(db, 'branches', branchId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setBranchName(docSnap.data().name || 'My Branch');
          }
        } catch (error) {
          console.error("Error fetching branch name:", error);
        }
      };
      fetchBranchName();
    }
  }, [branchId]);

  useEffect(() => {
    if (brandId) {
      const fetchBrandData = async () => {
        try {
          const docRef = doc(db, 'brands', brandId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBrandLogo(data.logo || '');
            setBrandNameStr(data.name || '');
          }
        } catch (error) {
          console.error("Error fetching brand data:", error);
        }
      };
      fetchBrandData();
    }
  }, [brandId]);

  // Listen for pending review requests to show notification badge on Dashboard top right
  useEffect(() => {
    if (!brandId || !role) {
      setPendingCount(0);
      return;
    }

    const q = query(
      collection(db, 'review_requests'),
      where('brandId', '==', brandId),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingCount(snapshot.size);
    }, (error) => {
      console.error("Error listening for pending requests:", error);
    });

    return () => unsubscribe();
  }, [brandId, role]);

  const handleSelectLogo = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          if (file.size > 500 * 1024) {
            Alert.alert('Error', 'Logo size should be under 500 KB');
            return;
          }
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Str = event.target?.result as string;
            setUpdatingLogo(true);
            try {
              const brandRef = doc(db, 'brands', brandId);
              await updateDoc(brandRef, { logo: base64Str });
              setBrandLogo(base64Str);
              Alert.alert('Success', 'Brand logo updated successfully!');
            } catch (err) {
              console.error("Error updating brand logo:", err);
              Alert.alert('Error', 'Could not update brand logo.');
            } finally {
              setUpdatingLogo(false);
            }
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      Alert.alert("Logo upload is supported on Web browsers.");
    }
  };

  const CUSTOMER_APP_URL = process.env.EXPO_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3000";

  const metrics = useMemo(() => {
    if (!feedbacks.length) return null;

    // 1. Today's Score
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayFeedbacks = feedbacks.filter(f => {
      if (!f.timestamp) return true; // If null (local write), it was created just now (today)!
      const date = typeof f.timestamp.toDate === 'function' ? f.timestamp.toDate() : new Date(f.timestamp);
      return date >= startOfToday;
    });
    const todayScore = todayFeedbacks.length > 0 
      ? todayFeedbacks.reduce((acc, f) => acc + (f.ratings?.overallAverage || 0), 0) / todayFeedbacks.length 
      : 0;

    // 2. NPS
    let promoters = 0;
    let detractors = 0;
    feedbacks.forEach(f => {
      const score = f.ratings?.overallAverage || 0;
      if (score >= 4.5) promoters++;
      else if (score <= 3.5) detractors++;
    });
    const total = feedbacks.length;
    const nps = Math.round(((promoters / total) - (detractors / total)) * 100);

    // 3. 7-Day Trend
    const chartLabels: string[] = [];
    const chartDataPoints: number[] = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d);
      dayStart.setHours(0,0,0,0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23,59,59,999);
      
      const dayFeedbacks = feedbacks.filter(f => {
        if (!f.timestamp) return false;
        const ts = typeof f.timestamp.toDate === 'function' ? f.timestamp.toDate() : new Date(f.timestamp);
        return ts >= dayStart && ts <= dayEnd;
      });
      
      const avg = dayFeedbacks.length > 0 
        ? dayFeedbacks.reduce((acc, f) => acc + (f.ratings?.overallAverage || 0), 0) / dayFeedbacks.length 
        : 0;
        
      chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      chartDataPoints.push(avg);
    }

    return {
      todayScore,
      totalFeedbacks: feedbacks.length,
      nps,
      promotersPercent: Math.round((promoters / total) * 100),
      detractorsPercent: Math.round((detractors / total) * 100),
      chartLabels,
      chartDataPoints,
    };
  }, [feedbacks]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const chartData = {
    labels: metrics?.chartLabels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{ data: metrics?.chartDataPoints || [0, 0, 0, 0, 0, 0, 0] }]
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subtitle}>Welcome back, here is your summary.</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {role === 'manager' && (
            <TouchableOpacity 
              style={styles.qrButton}
              onPress={() => setQrModalVisible(true)}
            >
              <QrCode size={20} color="#ffffff" />
              <Text style={styles.qrButtonText}>Branch QR</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.inboxHeaderButton}
            onPress={() => navigation.navigate('Inbox')}
          >
            <Mail size={22} color="#475569" />
            {pendingCount > 0 && (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>
                  {pendingCount > 9 ? '9+' : pendingCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Owner Brand Logo Upload Card on Dashboard */}
      {role === 'owner' && (
        <ModernCard color="#ffffff" delay={50}>
          <View style={styles.ownerBrandingRow}>
            {brandLogo ? (
              <View style={styles.logoWrapper}>
                <Image source={{ uri: brandLogo }} style={styles.dashboardLogo} />
                {updatingLogo && (
                  <View style={styles.logoSpinner}>
                    <ActivityIndicator color="#ffffff" size="small" />
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.noLogoAvatar}>
                <Text style={styles.noLogoAvatarText}>
                  {brandNameStr ? brandNameStr.charAt(0).toUpperCase() : 'B'}
                </Text>
              </View>
            )}
            
            <View style={styles.brandDetails}>
              <Text style={styles.brandNameText}>{brandNameStr || 'My Restaurant Brand'}</Text>
              <Text style={styles.brandUsernameText}>@{brandId || 'username'}</Text>
            </View>

            <TouchableOpacity 
              style={styles.updateLogoBtn} 
              onPress={handleSelectLogo}
              disabled={updatingLogo}
            >
              <Upload size={14} color="#6366f1" style={{ marginRight: 6 }} />
              <Text style={styles.updateLogoBtnText}>
                {updatingLogo ? 'Uploading...' : (brandLogo ? 'Update Logo' : 'Upload Logo')}
              </Text>
            </TouchableOpacity>
          </View>
        </ModernCard>
      )}

      {/* KPIs */}
      <View style={styles.row}>
        <View style={styles.flex1}>
          <ModernCard color="#09090b" delay={0}>
            <Text style={[styles.kpiLabel, { color: 'rgba(255,255,255,0.7)' }]}>TODAY'S SCORE</Text>
            <Text style={[styles.kpiValue, { color: '#ffffff' }]}>{metrics?.todayScore.toFixed(1) || '0.0'}</Text>
          </ModernCard>
        </View>
        <View style={{ width: 16 }} />
        <View style={styles.flex1}>
          <ModernCard color="rgba(255, 255, 255, 0.8)" delay={100}>
            <Text style={styles.kpiLabel}>FEEDBACKS</Text>
            <Text style={styles.kpiValue}>{metrics?.totalFeedbacks || 0}</Text>
          </ModernCard>
        </View>
      </View>

      <ModernCard color="rgba(255, 255, 255, 0.8)" delay={200}>
        <Text style={styles.kpiLabel}>NET PROMOTER SCORE (NPS)</Text>
        <Text style={styles.npsValue}>{(metrics && metrics.nps > 0) ? `+${metrics.nps}` : (metrics?.nps || 0)}</Text>
        <Text style={styles.npsSubtext}>{metrics?.promotersPercent || 0}% Promoters | {metrics?.detractorsPercent || 0}% Detractors</Text>
      </ModernCard>

      {/* Chart */}
      <ModernCard color="rgba(255, 255, 255, 0.8)" delay={300}>
        <Text style={[styles.kpiLabel, { marginBottom: 16 }]}>7-DAY TREND</Text>
        <LineChart
          data={chartData}
          width={screenWidth - 64} // padding
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Elegant indigo line
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`, // Slate labels
            style: { borderRadius: 16 },
            propsForDots: {
              r: '5',
              strokeWidth: '2',
              stroke: '#ffffff',
              fill: '#6366f1'
            },
            fillShadowGradient: '#6366f1',
            fillShadowGradientOpacity: 0.08,
          }}
          bezier
          style={{ marginVertical: 8, marginLeft: -16, borderRadius: 16 }}
        />
      </ModernCard>
      
      {/* New AI Features */}
      <ReviewSlideshow feedbacks={feedbacks} />
      <AIInsightsCard feedbacks={feedbacks} />
      <ChatbotCard feedbacks={feedbacks} />
      
      <View style={{ height: 40 }} />

      {/* Premium Customizable QR Code Poster & Downloader Modal */}
      {role === 'manager' && (
        <QRCodeFrameModal
          visible={qrModalVisible}
          onClose={() => setQrModalVisible(false)}
          branchId={branchId || ''}
          branchName={branchName}
          brandId={brandId || ''}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  header: { flex: 1 },
  title: { fontSize: 32, fontWeight: '800', color: '#09090b', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4, fontWeight: '500' },
  row: { flexDirection: 'row', marginBottom: 16 },
  flex1: { flex: 1 },
  
  cardContainer: { 
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.08)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  
  kpiLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 },
  kpiValue: { fontSize: 36, fontWeight: '800', color: '#09090b', marginTop: 4, letterSpacing: -1 },
  npsValue: { fontSize: 48, fontWeight: '800', color: '#6366f1', marginTop: 4, letterSpacing: -1 },
  npsSubtext: { fontSize: 14, fontWeight: '700', color: '#09090b', marginTop: 4 },
  
  // QR Code Styles
  qrButton: {
    backgroundColor: '#6366f1', // Premium Indigo accent
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  qrButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 9, 11, 0.4)',
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
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
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
    color: '#09090b',
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
    borderColor: 'rgba(99, 102, 241, 0.12)',
    marginBottom: 24,
  },
  qrInstruction: {
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  ownerBrandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  logoWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  dashboardLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: '#ffffff',
    resizeMode: 'contain',
  },
  logoSpinner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noLogoAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  noLogoAvatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
  },
  brandDetails: {
    flex: 1,
    marginLeft: 16,
  },
  brandNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#09090b',
    letterSpacing: -0.3,
  },
  brandUsernameText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  updateLogoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  updateLogoBtnText: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '700',
  },
  inboxHeaderButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    position: 'relative',
  },
  inboxBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    paddingHorizontal: 2,
  },
  inboxBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  }
});
