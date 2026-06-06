import React from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';
import { ModernCard } from '../../screens/DashboardScreen';

const { width } = Dimensions.get('window');

interface ReviewSlideshowProps {
  feedbacks: any[];
}

export default function ReviewSlideshow({ feedbacks }: ReviewSlideshowProps) {
  // Filter only feedbacks that have general comments
  const textFeedbacks = feedbacks.filter(f => f.feedbackText?.generalComments && f.feedbackText.generalComments.trim().length > 0);

  if (textFeedbacks.length === 0) {
    return null;
  }

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.slide}>
      <Text style={styles.commentText}>"{item.feedbackText.generalComments}"</Text>
      <View style={styles.authorRow}>
        <Text style={styles.authorName}>— {item.customer?.name || "Anonymous"}</Text>
        <View style={styles.ratingBadge}>
          <Text style={styles.ratingText}>{item.ratings?.overallAverage?.toFixed(1) || "0.0"} / 5.0</Text>
        </View>
      </View>
    </View>
  );

  return (
    <ModernCard delay={400}>
      <Text style={styles.kpiLabel}>RECENT DETAILED REVIEWS</Text>
      <FlatList
        data={textFeedbacks}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        snapToInterval={width - 64} // Card width approx
        decelerationRate="fast"
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 12 }}
      />
    </ModernCard>
  );
}

const styles = StyleSheet.create({
  kpiLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#64748b', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5,
    marginBottom: 8
  },
  slide: {
    width: width - 64 - 40, // Screen width minus padding
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
    minHeight: 140,
  },
  commentText: {
    fontSize: 16,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 24,
    marginBottom: 16,
  },
  authorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  ratingBadge: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingText: {
    color: '#4f46e5',
    fontWeight: '700',
    fontSize: 12,
  }
});
