import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { ModernCard } from './DashboardScreen';
import { useFeedbacks } from '../hooks/useFeedbacks';
import { useUser } from '../context/UserContext';

const screenWidth = Dimensions.get('window').width;

export default function ServiceAreaScreen() {
  const { branchId } = useUser();
  const { feedbacks, loading } = useFeedbacks(branchId);

  const chartData = useMemo(() => {
    let speedComplaints = 0;
    let behaviorComplaints = 0;
    let accuracyComplaints = 0;
    let helpfulnessComplaints = 0;

    feedbacks.forEach(f => {
      const service = f.ratings?.service;
      if (service) {
        if (service.speed < 3) speedComplaints++;
        if (service.behavior < 3) behaviorComplaints++;
        if (service.accuracy < 3) accuracyComplaints++;
        if (service.helpfulness < 3) helpfulnessComplaints++;
      }
    });

    return {
      labels: ['Speed', 'Behavior', 'Accuracy', 'Helpfulness'],
      datasets: [{ data: [speedComplaints, behaviorComplaints, accuracyComplaints, helpfulnessComplaints] }]
    };
  }, [feedbacks]);

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Complaints</Text>
        <Text style={styles.subtitle}>Where are we losing points?</Text>
      </View>

      <ModernCard delay={100}>
        <Text style={styles.kpiLabel}>LOW RATINGS (&lt; 3 STARS) SKEW</Text>
        <BarChart
          data={chartData}
          width={screenWidth - 64}
          height={260}
          yAxisLabel=""
          yAxisSuffix=""
          fromZero={true}
          verticalLabelRotation={15}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
            style: { borderRadius: 16 },
            barPercentage: 0.7,
            fillShadowGradient: '#6366f1',
            fillShadowGradientOpacity: 0.8,
            propsForVerticalLabels: {
              fontSize: 10,
            },
          }}
          style={{ marginVertical: 16, marginLeft: -16, borderRadius: 16 }}
          showValuesOnTopOfBars
        />
      </ModernCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4 },
  kpiLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
});
