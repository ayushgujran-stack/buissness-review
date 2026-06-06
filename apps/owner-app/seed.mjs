import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAslTWBolaQX0sZzbiVSmfuM0lqi4BllFA",
  authDomain: "review-app-2f663.firebaseapp.com",
  projectId: "review-app-2f663",
  storageBucket: "review-app-2f663.firebasestorage.app",
  messagingSenderId: "251075732638",
  appId: "1:251075732638:web:7abee3292be93f2f5cc78f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const dummyComments = [
  {
    rating: 4.8,
    comments: "The truffle pasta was absolutely amazing! Great vibe."
  },
  {
    rating: 2.1,
    comments: "The steak was overcooked and the service speed was terrible. Very disappointed."
  },
  {
    rating: 5.0,
    comments: "Loved the garlic bread and the pizza! Staff was very friendly."
  },
  {
    rating: 3.5,
    comments: "Soup was okay, but the waiter was quite rude."
  },
  {
    rating: 4.5,
    comments: "Really fast service! The coffee and cake were perfect before my flight."
  },
  {
    rating: 4.9,
    comments: "Best salad I have ever had! And the cake was incredibly soft and delicious."
  },
  {
    rating: 1.8,
    comments: "The pizza base was like cardboard and the coffee was ice cold. Will not return."
  },
  {
    rating: 4.6,
    comments: "Amazing selection of tea and pastries. The bread is freshly baked."
  }
];

async function seed() {
  const brandId = process.argv[2];
  if (!brandId) {
    console.error("Error: Please provide a brand username as an argument.");
    console.log("Usage: node seed.mjs <brand_username>");
    console.log("Example: node seed.mjs aishani");
    process.exit(1);
  }

  // 1. Verify if the brand exists
  console.log(`Checking if brand "${brandId}" exists in Firestore...`);
  const brandsRef = collection(db, "brands");
  const brandQuery = query(brandsRef, where("username", "==", brandId));
  const brandSnap = await getDocs(brandQuery);

  if (brandSnap.empty) {
    console.error(`Error: Brand with username "${brandId}" does not exist.`);
    console.log("Please create the brand first using the Owner App setup screen.");
    process.exit(1);
  }

  console.log(`Brand verified! Fetching branches for "${brandId}"...`);

  // 2. Fetch branches for the brand
  const branchesRef = collection(db, "branches");
  const branchesQuery = query(branchesRef, where("brandId", "==", brandId));
  const branchesSnap = await getDocs(branchesQuery);

  let branchIds = [];
  branchesSnap.forEach((doc) => {
    branchIds.push(doc.id);
  });

  if (branchIds.length === 0) {
    console.log(`No active branches found for "${brandId}". Creating a sample branch first...`);
    // Create a sample branch so we have somewhere to seed
    const newBranchRef = await addDoc(collection(db, "branches"), {
      brandId,
      name: "Downtown Ave",
      address: "123 Main Street",
      pin: "123456",
      managerUid: null,
      createdAt: new Date()
    });
    branchIds.push(newBranchRef.id);
    console.log(`Sample branch "Downtown Ave" created with ID: ${newBranchRef.id}`);
  }

  console.log(`Seeding feedbacks across ${branchIds.length} branch(es)...`);

  // 3. Seed feedbacks with both brandId and branchId
  for (let i = 0; i < dummyComments.length; i++) {
    const feedbackText = dummyComments[i];
    // Cycle through available branch IDs
    const assignedBranchId = branchIds[i % branchIds.length];

    const feedbackDoc = {
      brandId: brandId,
      branchId: assignedBranchId,
      ratings: {
        overallAverage: feedbackText.rating,
        food: { taste: feedbackText.rating, temp: feedbackText.rating, portion: feedbackText.rating, presentation: feedbackText.rating, variety: feedbackText.rating, average: feedbackText.rating },
        service: { behavior: feedbackText.rating, speed: feedbackText.rating, accuracy: feedbackText.rating, helpfulness: feedbackText.rating, average: feedbackText.rating },
        ambience: { cleanliness: feedbackText.rating, washroom: feedbackText.rating, music: feedbackText.rating, seating: feedbackText.rating, average: feedbackText.rating },
        billing: { checkoutSpeed: feedbackText.rating, accuracy: feedbackText.rating, average: feedbackText.rating }
      },
      feedbackText: { generalComments: feedbackText.comments },
      timestamp: new Date(),
      metadata: { source: "seed_script", userAgent: "NodeJS Seed Script" },
      customer: { name: `Customer ${i + 1}`, mobile: "+1 234 567 8900", residingArea: "City Center" }
    };

    await addDoc(collection(db, "feedbacks"), feedbackDoc);
    console.log(`Added feedback with score ${feedbackText.rating} to branch: ${assignedBranchId}`);
  }

  console.log("Seeding complete successfully!");
  process.exit(0);
}

seed().catch(console.error);
