import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type FeedbackData = {
  brandId: string;
  branchId: string;
  customer: {
    name: string;
    mobile: string;
    residingArea?: string;
  };
  ratings: {
    food: {
      taste: number;
      temp: number;
      portion: number;
      presentation: number;
      variety: number;
      average: number;
    };
    service: {
      behavior: number;
      speed: number;
      accuracy: number;
      helpfulness: number;
      average: number;
    };
    ambience: {
      cleanliness: number;
      washroom: number;
      music: number;
      seating: number;
      average: number;
    };
    billing: {
      checkoutSpeed: number;
      accuracy: number;
      average: number;
    };
    overallAverage: number;
  };
  feedbackText: {
    generalComments: string;
  };
  metadata: {
    source: string;
    userAgent: string;
  };
};

export async function submitFeedback(data: FeedbackData) {
  try {
    const docRef = await addDoc(collection(db, "feedbacks"), {
      ...data,
      timestamp: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return { success: false, error };
  }
}
