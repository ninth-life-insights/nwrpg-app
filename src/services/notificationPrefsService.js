// src/services/notificationPrefsService.js
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

const DEFAULT_PREFS = {
  enabled: false,
  planYourDay:    { enabled: true, hour: 8,  minute: 0 },
  reviewYourDay:  { enabled: true, hour: 20, minute: 0 },
  dueTodayAlerts: { enabled: true },
  overdueAlerts:  { enabled: true },
};

// Returns stored prefs merged with defaults (so new fields never come back undefined)
export const getNotificationPrefs = async (userId) => {
  try {
    const ref = doc(db, 'users', userId, 'settings', 'notifications');
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ...DEFAULT_PREFS };

    const data = snap.data();
    return {
      ...DEFAULT_PREFS,
      ...data,
      planYourDay:    { ...DEFAULT_PREFS.planYourDay,    ...data.planYourDay },
      reviewYourDay:  { ...DEFAULT_PREFS.reviewYourDay,  ...data.reviewYourDay },
      dueTodayAlerts: { ...DEFAULT_PREFS.dueTodayAlerts, ...data.dueTodayAlerts },
      overdueAlerts:  { ...DEFAULT_PREFS.overdueAlerts,  ...data.overdueAlerts },
    };
  } catch (error) {
    console.error('getNotificationPrefs error:', error);
    return { ...DEFAULT_PREFS };
  }
};

// Full replace — safe because we always write the complete prefs object
export const saveNotificationPrefs = async (userId, prefs) => {
  try {
    const ref = doc(db, 'users', userId, 'settings', 'notifications');
    const { updatedAt, ...rest } = prefs; // strip any stale timestamp before writing
    await setDoc(ref, { ...rest, updatedAt: serverTimestamp() });
  } catch (error) {
    console.error('saveNotificationPrefs error:', error);
    throw error;
  }
};
