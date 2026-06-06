import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { ModernCard } from './DashboardScreen';
import { Star, Award } from 'lucide-react-native';
import { useFeedbacks } from '../hooks/useFeedbacks';
import { useUser } from '../context/UserContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export default function BranchAnalysisScreen() {
  const { brandId } = useUser();
  const { feedbacks, loading } = useFeedbacks(null, true);
  const [branchNames, setBranchNames] = useState<Record<string, string>>({});

  // Robust dynamic branch name resolution
  useEffect(() => {
    const fetchBranchNames = async () => {
      // 1. Fetch all branches by brandId as a base
      if (brandId) {
        try {
          const q = query(collection(db, 'branches'), where('brandId', '==', brandId));
          const snap = await getDocs(q);
          const map: Record<string, string> = {};
          snap.forEach(doc => {
            map[doc.id] = doc.data().name;
          });
          setBranchNames(prev => ({ ...prev, ...map }));
        } catch (err) {
          console.error("Error fetching branches by brand", err);
        }
      }
    };
    fetchBranchNames();
  }, [brandId]);

  // 2. Dynamic lookup for any branch IDs present in feedbacks but missing from state
  useEffect(() => {
    const resolveFeedbackBranchNames = async () => {
      if (feedbacks.length === 0) return;
      
      try {
        const missingIds = Array.from(
          new Set(
            feedbacks
              .map(f => f.branchId)
              .filter(id => id && !branchNames[id])
          )
        );

        if (missingIds.length === 0) return;

        const resolvedMap: Record<string, string> = {};
        await Promise.all(
          missingIds.map(async (id) => {
            // Attempt to load from branches collection directly
            try {
              const docRef = doc(db, 'branches', id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                resolvedMap[id] = docSnap.data().name;
              }
            } catch (e) {
              // Ignore single lookup failures (could be seeded mock string ID)
            }
          })
        );

        if (Object.keys(resolvedMap).length > 0) {
          setBranchNames(prev => ({ ...prev, ...resolvedMap }));
        }
      } catch (err) {
        console.error("Error resolving feedback branch names dynamically", err);
      }
    };
    
    resolveFeedbackBranchNames();
  }, [feedbacks, branchNames]);

  const branches = useMemo(() => {
    const branchStats: Record<string, { id: string; totalScore: number; volume: number }> = {};

    feedbacks.forEach(f => {
      const id = f.branchId || "unknown";
      
      if (!branchStats[id]) {
        branchStats[id] = { id, totalScore: 0, volume: 0 };
      }
      branchStats[id].totalScore += (f.ratings?.overallAverage || 0);
      branchStats[id].volume += 1;
    });

    const calculatedBranches = Object.values(branchStats).map(b => ({
      name: branchNames[b.id] || b.id,
      score: b.volume > 0 ? b.totalScore / b.volume : 0,
      volume: b.volume
    }));

    return calculatedBranches.sort((a, b) => b.score - a.score);
  }, [feedbacks, branchNames]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Branch performance ranking</Text>
      </View>

      {branches.length === 0 ? (
        <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 40, fontWeight: '500' }}>No feedbacks yet!</Text>
      ) : null}

      {branches.map((branch, index) => {
        const isWinner = index === 0;
        return (
          <View key={branch.name}>
            <ModernCard color={isWinner ? '#000000' : 'rgba(255, 255, 255, 0.8)'} delay={index * 80}>
              <View style={styles.row}>
                <View style={[styles.rankBadge, isWinner ? styles.winnerRankBadge : styles.normalRankBadge]}>
                  {isWinner ? (
                    <Award size={20} color="#000000" />
                  ) : (
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.branchName, isWinner ? styles.winnerText : styles.normalText]}>
                    {branch.name}
                  </Text>
                  <Text style={[styles.volumeText, isWinner ? styles.winnerSubtext : styles.normalSubtext]}>
                    {branch.volume} {branch.volume === 1 ? 'Feedback' : 'Feedbacks'}
                  </Text>
                </View>
                <View style={[
                  styles.scoreBox, 
                  isWinner ? styles.winnerScoreBox : styles.normalScoreBox
                ]}>
                  <Star 
                    size={16} 
                    fill={isWinner ? '#ffffff' : '#000000'} 
                    color={isWinner ? '#ffffff' : '#000000'} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.scoreText, isWinner ? styles.winnerScoreText : styles.normalScoreText]}>
                    {branch.score.toFixed(1)}
                  </Text>
                </View>
              </View>
            </ModernCard>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', padding: 16 },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#000000', letterSpacing: -1 },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center' },
  
  rankBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  winnerRankBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
  },
  normalRankBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  rankText: { color: '#000000', fontWeight: '800', fontSize: 16 },
  branchName: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  winnerText: { color: '#ffffff' },
  normalText: { color: '#000000' },
  volumeText: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  winnerSubtext: { color: 'rgba(255,255,255,0.7)' },
  normalSubtext: { color: '#64748b' },
  
  scoreBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  winnerScoreBox: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  normalScoreBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#000000',
  },
  scoreText: { fontSize: 16, fontWeight: '800' },
  winnerScoreText: { color: '#ffffff' },
  normalScoreText: { color: '#000000' }
});
