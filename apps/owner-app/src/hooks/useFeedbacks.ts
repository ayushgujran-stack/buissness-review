import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useUser } from '../context/UserContext';

export type FeedbackData = {
  id: string;
  branchId: string;
  customer?: { name: string; mobile: string; residingArea?: string };
  ratings: {
    food: { taste: number; temp: number; portion: number; presentation: number; variety: number; average: number };
    service: { behavior: number; speed: number; accuracy: number; helpfulness: number; average: number };
    ambience: { cleanliness: number; washroom: number; music: number; seating: number; average: number };
    billing: { checkoutSpeed: number; accuracy: number; average: number };
    overallAverage: number;
  };
  feedbackText?: { generalComments: string };
  timestamp?: any;
};

export function useFeedbacks(specificBranchId?: string | null, ignoreRoleRestriction = false) {
  const { role, brandId, branchId } = useUser();
  const [feedbacks, setFeedbacks] = useState<FeedbackData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) {
      setLoading(false);
      return;
    }
    
    // We fetch all feedbacks FOR THIS BRAND ordered by timestamp.
    // This is secure and requires a Composite Index (brandId ASC, timestamp DESC).
    const q = query(
      collection(db, 'feedbacks'),
      where('brandId', '==', brandId),
      orderBy('timestamp', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: FeedbackData[] = [];
      snapshot.forEach((doc) => {
        const item = { id: doc.id, ...doc.data() } as FeedbackData;
        
        // Strict Data Filtering based on User Role (unless explicitly ignored)
        if (role === 'owner' || ignoreRoleRestriction) {
          // If they are looking at a specific branch via parameter, filter by it
          if (!specificBranchId || item.branchId === specificBranchId) {
            data.push(item);
          }
        } else if (role === 'manager') {
          // Managers ONLY see feedbacks belonging to their specific branch
          if (item.branchId === branchId) {
            data.push(item);
          }
        }
      });
      setFeedbacks(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching feedbacks: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role, brandId, branchId, specificBranchId, ignoreRoleRestriction]);

  return { feedbacks, loading };
}
