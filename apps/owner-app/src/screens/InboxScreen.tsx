import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { Check, X, MessageSquare, Clock, ArrowRight, RefreshCw, Mail } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { db } from '../../firebase';
import { collection, query, where, doc, updateDoc, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';

export default function InboxScreen() {
  const { role, brandId, branchId } = useUser();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!brandId) return;

    setLoading(true);
    let q;

    if (role === 'owner') {
      q = query(
        collection(db, 'review_requests'),
        where('brandId', '==', brandId)
      );
    } else {
      q = query(
        collection(db, 'review_requests'),
        where('brandId', '==', brandId),
        where('branchId', '==', branchId)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests: any[] = [];
      snapshot.forEach((doc) => {
        fetchedRequests.push({ id: doc.id, ...doc.data() });
      });
      fetchedRequests.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
      setRequests(fetchedRequests);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to review requests:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [brandId, branchId, role]);

  const confirmAction = (title: string, message: string): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }
    return new Promise((resolve) => {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Confirm", onPress: () => resolve(true) },
      ]);
    });
  };

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleApprove = async (request: any) => {
    const confirmed = await confirmAction(
      "Approve Request",
      `Approve review form configuration for branch "${request.branchName}"?`
    );
    if (!confirmed) return;

    setProcessing(request.id);
    try {
      // 1. Update the request status to approved
      const requestRef = doc(db, 'review_requests', request.id);
      await updateDoc(requestRef, {
        status: 'approved',
        processedAt: serverTimestamp(),
      });

      // 2. Apply the configuration to the specific branch only
      const branchRef = doc(db, 'branches', request.branchId);
      const updateData: any = {
        reviewConfig: request.requestedConfig,
      };
      if (request.requestedGoogleReviewLink !== undefined) {
        updateData.googleReviewLink = request.requestedGoogleReviewLink;
      }
      await updateDoc(branchRef, updateData);

      showMessage("Success", "Request approved and branch configuration updated!");
    } catch (error) {
      console.error("Error approving request:", error);
      showMessage("Error", "Failed to approve request.");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: any) => {
    const confirmed = await confirmAction(
      "Reject Request",
      `Reject review form configuration for branch "${request.branchName}"?`
    );
    if (!confirmed) return;

    setProcessing(request.id);
    try {
      const requestRef = doc(db, 'review_requests', request.id);
      await updateDoc(requestRef, {
        status: 'rejected',
        processedAt: serverTimestamp(),
      });

      showMessage("Success", "Request has been rejected.");
    } catch (error) {
      console.error("Error rejecting request:", error);
      showMessage("Error", "Failed to reject request.");
    } finally {
      setProcessing(null);
    }
  };

  // Filter requests based on tab for Owner
  const filteredRequests = requests.filter(req => {
    if (role === 'manager') return true; // Manager sees all in single list
    if (activeTab === 'pending') {
      return req.status === 'pending';
    } else {
      return req.status !== 'pending';
    }
  });

  const renderConfigDetails = (config: any) => {
    if (!config) return null;
    const quickOptions = config.quick?.options || [];
    const detailed = config.detailed || {};

    return (
      <View style={styles.configPreview}>
        <Text style={styles.configSubTitle}>Quick Option Chips:</Text>
        <View style={styles.chipContainer}>
          {quickOptions.map((opt: string, index: number) => (
            <View key={index} style={styles.previewChip}>
              <Text style={styles.previewChipText}>{opt}</Text>
            </View>
          ))}
          {quickOptions.length === 0 && (
            <Text style={styles.emptyConfigText}>None selected</Text>
          )}
        </View>

        <Text style={[styles.configSubTitle, { marginTop: 10 }]}>Detailed Sections:</Text>
        <View style={styles.detailedStatusRow}>
          {Object.entries(detailed).map(([key, val]) => (
            <View key={key} style={styles.detailedIndicator}>
              <View style={[styles.dot, val ? styles.dotActive : styles.dotInactive]} />
              <Text style={styles.indicatorLabel}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderRequestCard = ({ item }: { item: any }) => {
    const formattedDate = item.createdAt?.toDate 
      ? item.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Just now';

    const getStatusStyle = (status: string) => {
      switch (status) {
        case 'approved': return styles.statusApproved;
        case 'rejected': return styles.statusRejected;
        default: return styles.statusPending;
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'approved': return 'Approved';
        case 'rejected': return 'Rejected';
        default: return 'Pending';
      }
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.branchName}>{item.branchName}</Text>
            <View style={styles.timeRow}>
              <Clock size={12} color="#94a3b8" />
              <Text style={styles.timeText}>{formattedDate}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
            <Text style={[styles.statusText, { color: item.status === 'pending' ? '#d97706' : item.status === 'approved' ? '#16a34a' : '#dc2626' }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {item.message ? (
          <View style={styles.messageBubble}>
            <MessageSquare size={14} color="#6366f1" style={{ marginTop: 2, marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.messageLabel}>Manager Explanation:</Text>
              <Text style={styles.messageText}>"{item.message}"</Text>
            </View>
          </View>
        ) : (
          <View style={styles.messageBubble}>
            <MessageSquare size={14} color="#94a3b8" style={{ marginTop: 2, marginRight: 8 }} />
            <Text style={[styles.messageText, { fontStyle: 'italic', color: '#94a3b8' }]}>
              No explanation message provided.
            </Text>
          </View>
        )}

        {item.requestedGoogleReviewLink ? (
          <View style={[styles.messageBubble, { backgroundColor: '#e0e7ff', borderColor: '#c7d2fe', borderWidth: 1, marginTop: 4, marginBottom: 16 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.messageLabel, { color: '#4338ca' }]}>Requested Google Review Link:</Text>
              <Text style={[styles.messageText, { color: '#312e81', fontWeight: 'bold' }]}>
                {item.requestedGoogleReviewLink}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Requested Configuration:</Text>
        {renderConfigDetails(item.requestedConfig)}

        {role === 'owner' && item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item)}
              disabled={processing === item.id}
            >
              {processing === item.id ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <>
                  <X size={18} color="#dc2626" style={{ marginRight: 6 }} />
                  <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>Reject</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleApprove(item)}
              disabled={processing === item.id}
            >
              {processing === item.id ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Check size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={[styles.actionBtnText, { color: '#ffffff' }]}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.subtitle}>
          {role === 'owner' 
            ? 'Review and manage branch configuration requests' 
            : 'Track your branch configuration requests status'}
        </Text>
      </View>

      {role === 'owner' && (
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
            onPress={() => setActiveTab('pending')}
          >
            <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
              Pending Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              Request History
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequestCard}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Mail size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No requests found.</Text>
            <Text style={styles.emptySubText}>
              {role === 'owner' 
                ? 'All requests have been processed.' 
                : 'Configure your branch form under Setup to submit a request.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#09090b',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#6366f1',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.08)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.015,
    shadowRadius: 10,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  branchName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusPending: {
    backgroundColor: '#fef3c7',
  },
  statusApproved: {
    backgroundColor: '#dcfce7',
  },
  statusRejected: {
    backgroundColor: '#fee2e2',
  },
  messageBubble: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  configPreview: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  configSubTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  previewChip: {
    backgroundColor: '#e6f4fe',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  previewChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0369a1',
  },
  emptyConfigText: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  detailedStatusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#16a34a',
  },
  dotInactive: {
    backgroundColor: '#cbd5e1',
  },
  indicatorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  approveBtn: {
    backgroundColor: '#6366f1',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 2,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  emptySubText: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
    fontWeight: '500',
  },
});
