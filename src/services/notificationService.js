// src/services/notificationService.js
// Pure browser Notification API calls — no Firestore, no React.
import { getActiveMissions } from './missionService';
import { isMissionDueToday, isMissionOverdue } from '../utils/dateHelpers';

const ICON = '/assets/App-Icon/Nwrpg-icon-192.png';
const BADGE = '/assets/App-Icon/Nwrpg-icon-72.png';

// Request notification permission from the browser.
// Must be called from a user gesture (button click).
// Returns 'granted' | 'denied' | 'default'
export const requestPermission = async () => {
  if (typeof Notification === 'undefined') return 'denied';
  return await Notification.requestPermission();
};

// Returns true if the browser supports notifications and permission is granted
export const hasPermission = () => {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
};

// Show a notification via the active service worker registration.
// url is stored in notification.data.url for the sw.js notificationclick handler.
export const showNotification = async (title, { body, url } = {}) => {
  if (!hasPermission()) return;
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, {
      body,
      icon: ICON,
      badge: BADGE,
      data: { url: url || '/home' },
      requireInteraction: false,
    });
  } catch (error) {
    console.warn('showNotification failed:', error);
  }
};

// Compute milliseconds until the next occurrence of hour:minute.
// If that time has already passed today, returns the delay for tomorrow.
export const msUntil = (hour, minute) => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, minute, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
};

// Query active missions and fire a notification if any are due today
export const checkAndFireDueTodayAlert = async (userId) => {
  try {
    const missions = await getActiveMissions(userId);
    const dueToday = missions.filter(isMissionDueToday);
    if (dueToday.length === 0) return;

    const count = dueToday.length;
    await showNotification('Missions due today', {
      body: count === 1
        ? '1 mission is due today'
        : `${count} missions are due today`,
      url: '/mission-bank',
    });
  } catch (error) {
    console.warn('checkAndFireDueTodayAlert failed:', error);
  }
};

// Query active missions and fire a notification if any are overdue
export const checkAndFireOverdueAlert = async (userId) => {
  try {
    const missions = await getActiveMissions(userId);
    const overdue = missions.filter(isMissionOverdue);
    if (overdue.length === 0) return;

    const count = overdue.length;
    await showNotification('Overdue missions', {
      body: count === 1
        ? '1 mission is overdue'
        : `${count} missions are overdue`,
      url: '/mission-bank',
    });
  } catch (error) {
    console.warn('checkAndFireOverdueAlert failed:', error);
  }
};
