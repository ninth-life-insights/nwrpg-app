// src/services/pushService.js
//
// Web Push subscription management (client side). Pairs with:
//   - the SW `push` handler in src/sw.js (shows the notification)
//   - the backend sender in api/send-push.js (delivers via VAPID)
//
// A device subscribes once permission is granted (the tutorial opt-in and the
// Settings master toggle both call enablePushForUser). The subscription is
// stored per-device under users/{uid}/pushSubscriptions/{deviceId} so multiple
// devices can each receive pushes, and the backend can prune dead endpoints.

import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';
import { updateUserProfile } from './userService';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// VAPID public keys are URL-safe base64; the Push API wants a Uint8Array.
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
};

// Stable per-device id so re-subscribing on the same device overwrites the
// same Firestore doc instead of piling up stale subscriptions.
const getDeviceId = () => {
  let id = null;
  try { id = localStorage.getItem('pushDeviceId'); } catch { /* private mode */ }
  if (!id) {
    id = (crypto?.randomUUID?.())
      || `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { localStorage.setItem('pushDeviceId', id); } catch { /* ignore */ }
  }
  return id;
};

// Persist the device's IANA timezone so the server knows when "8am" is for
// this user. Non-fatal — push still works with whatever tz is on record.
export const saveTimezone = async (userId) => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) await updateUserProfile(userId, { timezone: tz });
  } catch (e) {
    console.warn('saveTimezone failed:', e);
  }
};

export const isPushSupported = () =>
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window;

// Subscribe this device to web push and store the subscription. Safe to call
// repeatedly — reuses any existing subscription and overwrites the per-device
// doc. No-op (returns null) when push is unsupported or the VAPID key is
// missing, so callers never need to guard.
export const enablePushForUser = async (userId) => {
  await saveTimezone(userId);
  if (!isPushSupported()) return null;
  if (!VAPID_PUBLIC) {
    console.warn('VITE_VAPID_PUBLIC_KEY is not set — skipping push subscribe.');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    }
    const json = sub.toJSON();
    await setDoc(doc(db, 'users', userId, 'pushSubscriptions', getDeviceId()), {
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
    });
    return sub;
  } catch (e) {
    console.error('enablePushForUser failed:', e);
    return null;
  }
};

// Unsubscribe this device and remove its stored subscription. Used when the
// user turns notifications off in Settings.
export const disablePushForUser = async (userId) => {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    await deleteDoc(doc(db, 'users', userId, 'pushSubscriptions', getDeviceId()));
  } catch (e) {
    console.error('disablePushForUser failed:', e);
  }
};
