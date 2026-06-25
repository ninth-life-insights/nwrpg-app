import React from 'react';
import { captureError } from '../utils/sentry';

async function softReset() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } finally {
    window.location.reload();
  }
}

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App ErrorBoundary caught:', error, info);
    captureError(error, { componentStack: info?.componentStack || null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const wrap = {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', padding: '24px',
      gap: '16px', textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    };
    const btn = {
      padding: '10px 20px', borderRadius: '8px', border: '1px solid #3b82f6',
      background: '#3b82f6', color: '#fff', fontSize: '1rem', cursor: 'pointer',
      minWidth: '240px',
    };
    const secondaryBtn = { ...btn, background: '#fff', color: '#3b82f6' };
    const pre = {
      maxWidth: '90vw', padding: '12px', background: '#fef2f2',
      border: '1px solid #fecaca', borderRadius: '8px', textAlign: 'left',
      fontSize: '0.85rem', overflowX: 'auto', color: '#b91c1c',
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    };

    return (
      <div style={wrap} role="alert">
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ margin: 0, color: '#4b5563' }}>
          The app hit an error while loading.
        </p>
        <pre style={pre}>{this.state.error.message || String(this.state.error)}</pre>
        <button style={btn} onClick={() => window.location.reload()}>Reload</button>
        <button style={secondaryBtn} onClick={softReset}>
          Soft reset (keeps you logged in)
        </button>
      </div>
    );
  }
}
