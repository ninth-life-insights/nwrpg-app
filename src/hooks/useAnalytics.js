import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { analytics } from '../services/firebase/config';
import { useAuth } from '../contexts/AuthContext';

// Wires Firebase Analytics into the SPA. Mount once inside <AppContent>.
// - Ties events to the signed-in user via setUserId (powers GA4 User Explorer)
// - Logs a manual page_view on each route change (Firebase auto page_view only
//   fires on full document loads, not React Router navigations)
export const useAnalytics = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!analytics) return;
    setUserId(analytics, currentUser ? currentUser.uid : null);
    // display-mode tells us standalone (installed PWA) vs browser tab.
    // Sticky on the analytics instance, but re-setting on auth change is
    // idempotent and covers the case where analytics resolved after mount.
    const displayMode = window.matchMedia('(display-mode: standalone)').matches
      ? 'standalone'
      : 'browser';
    setUserProperties(analytics, { display_mode: displayMode });
  }, [currentUser]);

  useEffect(() => {
    if (!analytics) return;
    logEvent(analytics, 'page_view', {
      page_path: location.pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location.pathname]);
};
