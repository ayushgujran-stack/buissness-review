import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ModernCard } from '../../screens/DashboardScreen';
import { Sparkles } from 'lucide-react-native';

interface AIInsightsCardProps {
  feedbacks: any[];
}

export default function AIInsightsCard({ feedbacks }: AIInsightsCardProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const customerAppUrl = process.env.EXPO_PUBLIC_CUSTOMER_APP_URL || "http://localhost:3000";

  const generateInsights = async () => {
    if (feedbacks.length === 0) {
      setError("No feedbacks available to analyze.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${customerAppUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feedbacks }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to analyze feedbacks on backend.");
      }

      const data = await res.json();
      setInsight(data.insight);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate AI insights. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModernCard delay={500}>
      <View style={styles.header}>
        <Sparkles color="#8b5cf6" size={20} />
        <Text style={styles.kpiLabel}>AI REVIEW ANALYSIS</Text>
      </View>
      
      {!insight && !loading && !error && (
        <TouchableOpacity style={styles.generateButton} onPress={generateInsights}>
          <Text style={styles.generateButtonText}>Generate AI Insights</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#8b5cf6" />
          <Text style={styles.loadingText}>Analyzing recent feedback...</Text>
        </View>
      )}

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {insight && (
        <View style={styles.insightContainer}>
          <Text style={styles.insightText}>{insight}</Text>
        </View>
      )}
    </ModernCard>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  kpiLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#64748b', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginLeft: 8,
  },
  generateButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 12,
    color: '#64748b',
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  insightContainer: {
    backgroundColor: '#f5f3ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ede9fe',
  },
  insightText: {
    color: '#4c1d95',
    fontSize: 15,
    lineHeight: 24,
  }
});
