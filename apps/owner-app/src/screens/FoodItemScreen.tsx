import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { ModernCard } from './DashboardScreen';
import { TrendingUp, TrendingDown, Plus, Trash2 } from 'lucide-react-native';
import { useFeedbacks } from '../hooks/useFeedbacks';
import { useUser } from '../context/UserContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function FoodItemScreen() {
  const { brandId, branchId } = useUser();
  const { feedbacks, loading: feedbacksLoading } = useFeedbacks(branchId);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingKeywords, setLoadingKeywords] = useState(true);

  useEffect(() => {
    const fetchKeywords = async () => {
      setLoadingKeywords(true);
      let keywordsFromDb: string[] = [];
      try {
        if (branchId) {
          const branchRef = doc(db, 'branches', branchId);
          const branchSnap = await getDoc(branchRef);
          if (branchSnap.exists() && branchSnap.data().menuKeywords) {
            keywordsFromDb = branchSnap.data().menuKeywords;
          }
        }
        if (keywordsFromDb.length === 0 && brandId) {
          const brandRef = doc(db, 'brands', brandId);
          const brandSnap = await getDoc(brandRef);
          if (brandSnap.exists() && brandSnap.data().menuKeywords) {
            keywordsFromDb = brandSnap.data().menuKeywords;
          }
        }
      } catch (err) {
        console.error("Error loading custom keywords:", err);
      }
      
      if (keywordsFromDb.length > 0) {
        setCustomKeywords(keywordsFromDb);
      } else {
        setCustomKeywords(['pasta', 'bread', 'cake', 'steak', 'soup', 'pizza', 'salad', 'coffee', 'tea']);
      }
      setLoadingKeywords(false);
    };

    fetchKeywords();
  }, [brandId, branchId]);

  const handleAddKeyword = async () => {
    const trimmed = newKeywordInput.trim().toLowerCase();
    if (!trimmed || customKeywords.includes(trimmed)) return;

    const updated = [...customKeywords, trimmed];
    setCustomKeywords(updated);
    setNewKeywordInput('');

    if (branchId) {
      setSaving(true);
      try {
        const branchRef = doc(db, 'branches', branchId);
        await updateDoc(branchRef, { menuKeywords: updated });
      } catch (err) {
        console.error("Error saving keyword:", err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    const updated = customKeywords.filter(k => k !== keyword);
    setCustomKeywords(updated);

    if (branchId) {
      setSaving(true);
      try {
        const branchRef = doc(db, 'branches', branchId);
        await updateDoc(branchRef, { menuKeywords: updated });
      } catch (err) {
        console.error("Error removing keyword:", err);
      } finally {
        setSaving(false);
      }
    }
  };

  const sentiment = useMemo(() => {
    const positive: Record<string, number> = {};
    const negative: Record<string, number> = {};

    feedbacks.forEach(f => {
      const text = f.feedbackText?.generalComments?.toLowerCase() || '';
      const score = f.ratings?.overallAverage || 0;

      customKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          if (score >= 4) {
            positive[keyword] = (positive[keyword] || 0) + 1;
          } else if (score <= 3) {
            negative[keyword] = (negative[keyword] || 0) + 1;
          }
        }
      });
    });

    const topDishes = Object.entries(positive)
      .map(([name, mentions]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), mentions }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 5);

    const bottomDishes = Object.entries(negative)
      .map(([name, mentions]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), mentions }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 5);

    return { topDishes, bottomDishes };
  }, [feedbacks, customKeywords]);

  if (feedbacksLoading || loadingKeywords) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Menu AI</Text>
        <Text style={styles.subtitle}>Sentiment analysis from feedback text</Text>
      </View>

      {/* Dynamic Keywords Management */}
      <ModernCard delay={50}>
        <Text style={styles.kpiLabel}>Tracked Menu Items</Text>
        <Text style={styles.configDesc}>Add or remove items you want to monitor in customer reviews.</Text>
        
        <View style={styles.chipContainer}>
          {customKeywords.map(keyword => (
            <View key={keyword} style={styles.chip}>
              <Text style={styles.chipText}>{keyword}</Text>
              <TouchableOpacity onPress={() => handleRemoveKeyword(keyword)} style={styles.removeChipBtn}>
                <Trash2 size={12} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {customKeywords.length === 0 && (
            <Text style={styles.emptyText}>No items tracked. Add some below!</Text>
          )}
        </View>

        <View style={styles.addOptionRow}>
          <TextInput
            style={styles.addOptionInput}
            placeholder="Add new dish to track..."
            placeholderTextColor="#94a3b8"
            value={newKeywordInput}
            onChangeText={setNewKeywordInput}
            onSubmitEditing={handleAddKeyword}
          />
          <TouchableOpacity 
            style={styles.addOptionButton}
            onPress={handleAddKeyword}
            disabled={saving || !newKeywordInput.trim()}
          >
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Plus size={18} color="#ffffff" />}
          </TouchableOpacity>
        </View>
      </ModernCard>

      <ModernCard color="#6366f1" delay={100}>
        <View style={styles.sectionHeader}>
          <TrendingUp color="#ffffff" size={24} strokeWidth={2.5} />
          <Text style={[styles.sectionTitle, { color: '#ffffff' }]}>Top Mentions</Text>
        </View>
        
        {sentiment.topDishes.length === 0 ? <Text style={{ color: 'rgba(255,255,255,0.7)' }}>No positive mentions yet.</Text> : null}

        {sentiment.topDishes.map((dish, i) => (
          <View key={dish.name} style={styles.listItem}>
            <Text style={[styles.rank, { color: 'rgba(255,255,255,0.7)' }]}>#{i + 1}</Text>
            <Text style={[styles.dishName, { color: '#ffffff' }]}>{dish.name}</Text>
            <Text style={[styles.mentions, { color: 'rgba(255,255,255,0.9)' }]}>{dish.mentions} mentions</Text>
          </View>
        ))}
      </ModernCard>

      <ModernCard delay={200}>
        <View style={styles.sectionHeader}>
          <TrendingDown color="#ef4444" size={24} strokeWidth={2.5} />
          <Text style={styles.sectionTitle}>Needs Improvement</Text>
        </View>
        
        {sentiment.bottomDishes.length === 0 ? <Text style={{ color: '#64748b' }}>No negative mentions yet.</Text> : null}

        {sentiment.bottomDishes.map((dish, i) => (
          <View key={dish.name} style={[styles.listItem, { borderBottomColor: '#f1f5f9' }]}>
            <Text style={styles.rank}>#{i + 1}</Text>
            <Text style={styles.dishName}>{dish.name}</Text>
            <Text style={styles.mentions}>{dish.mentions} mentions</Text>
          </View>
        ))}
      </ModernCard>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
  
  kpiLabel: { fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  configDesc: { fontSize: 13, color: '#64748b', fontWeight: '500', marginBottom: 16 },
  
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  chipText: { fontSize: 13, fontWeight: '700', color: '#0f172a', textTransform: 'capitalize' },
  removeChipBtn: { marginLeft: 8, padding: 2 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontStyle: 'italic', fontWeight: '500' },
  
  addOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addOptionInput: { flex: 1, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, height: 44, fontSize: 14, color: '#000000', fontWeight: '500' },
  addOptionButton: { backgroundColor: '#6366f1', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5, marginLeft: 10 },
  
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  rank: { fontSize: 16, fontWeight: '700', width: 36, color: '#94a3b8' },
  dishName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#0f172a' },
  mentions: { fontSize: 14, fontWeight: '600', color: '#64748b' }
});
