// services/feedbackService.js
// Beta feedback: a single top-level /feedback collection. Each doc records
// who submitted, what they wrote, which page they were on, and their UA.
// No client reads — browse via Firebase console or full DB export.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

export const createFeedback = async (userId, { displayName, page, message, category }) => {
  const docRef = await addDoc(collection(db, 'feedback'), {
    userId,
    displayName: displayName || null,
    page: page || null,
    message: message.trim(),
    category: category || null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};
