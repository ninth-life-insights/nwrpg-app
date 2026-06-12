import { useEffect, useState } from 'react';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        padding: '6px 12px',
        background: '#374151',
        color: '#fff',
        fontSize: '0.85rem',
        textAlign: 'center',
        zIndex: 100,
        fontWeight: 500,
      }}
    >
      You're offline — changes will sync when you reconnect.
    </div>
  );
}
