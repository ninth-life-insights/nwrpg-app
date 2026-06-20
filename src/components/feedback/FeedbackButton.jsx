// src/components/feedback/FeedbackButton.jsx
// A draggable, persistent feedback affordance, mounted once for any authed
// user. Mirrors iOS AssistiveTouch: tap to open the modal; drag (above a
// small movement threshold) to reposition; on release, snap horizontally to
// the nearer edge and persist position to localStorage.

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile } from '../../services/userService';
import FeedbackModal from './FeedbackModal';
import './FeedbackButton.css';

const STORAGE_KEY = 'nwrpg_feedback_btn_position';
const BUTTON_SIZE = 48;
const EDGE_INSET = 16;
const TOP_SAFE = 80;        // clears sticky page headers
const BOTTOM_SAFE = 96;     // clears centered FABs on Achievements / MissionBank
const DRAG_THRESHOLD_PX = 6;
const DEFAULT_BOTTOM_INSET = 24;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const readPersistedPosition = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (parsed.side === 'left' || parsed.side === 'right') &&
      typeof parsed.topPct === 'number'
    ) {
      return parsed;
    }
  } catch (_) {}
  return null;
};

const writePersistedPosition = (position) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch (_) {}
};

// Convert the persisted {side, topPct} into current viewport pixel coords.
// topPct is stored relative to viewport height so rotation/resize stays sane.
const settledCoords = ({ side, topPct }) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = side === 'left' ? EDGE_INSET : vw - BUTTON_SIZE - EDGE_INSET;
  const minY = TOP_SAFE;
  const maxY = vh - BOTTOM_SAFE - BUTTON_SIZE;
  const y = clamp(topPct * vh, minY, maxY);
  return { x, y };
};

const defaultPosition = () => ({
  side: 'right',
  topPct:
    typeof window !== 'undefined'
      ? (window.innerHeight - DEFAULT_BOTTOM_INSET - BUTTON_SIZE) /
        window.innerHeight
      : 0.85,
});

const FeedbackButton = () => {
  const location = useLocation();
  const { currentUser } = useAuth();
  const buttonRef = useRef(null);

  // Prefetch displayName once per session so the modal opens with the user's
  // name already known. Falls back to email; modal handles the null case too.
  const [displayName, setDisplayName] = useState(null);
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    getUserProfile(currentUser.uid)
      .then((profile) => {
        if (!cancelled && profile?.displayName) setDisplayName(profile.displayName);
      })
      .catch(() => {
        // Swallow — modal falls back to email.
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const [position, setPosition] = useState(
    () => readPersistedPosition() || defaultPosition()
  );
  const [coords, setCoords] = useState(() =>
    typeof window === 'undefined' ? { x: 0, y: 0 } : settledCoords(position)
  );
  const [dragging, setDragging] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const dragRef = useRef({
    active: false,
    moved: false,
    pointerStart: { x: 0, y: 0 },
    coordStart: { x: 0, y: 0 },
  });

  // Re-clamp on viewport resize so the button stays inside the safe band.
  useEffect(() => {
    const onResize = () => setCoords(settledCoords(position));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position]);

  const handlePointerDown = useCallback(
    (e) => {
      if (!buttonRef.current) return;
      try {
        buttonRef.current.setPointerCapture(e.pointerId);
      } catch (_) {}
      dragRef.current = {
        active: true,
        moved: false,
        pointerStart: { x: e.clientX, y: e.clientY },
        coordStart: { ...coords },
      };
    },
    [coords]
  );

  const handlePointerMove = useCallback((e) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const dx = e.clientX - drag.pointerStart.x;
    const dy = e.clientY - drag.pointerStart.y;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nextX = clamp(drag.coordStart.x + dx, 0, vw - BUTTON_SIZE);
    const nextY = clamp(drag.coordStart.y + dy, 0, vh - BUTTON_SIZE);
    setCoords({ x: nextX, y: nextY });
  }, []);

  const handlePointerUp = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.active = false;
      try {
        buttonRef.current?.releasePointerCapture(e.pointerId);
      } catch (_) {}

      if (!drag.moved) {
        setModalOpen(true);
        return;
      }

      // Snap horizontally to nearest edge; clamp vertically to safe band.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const centerX = coords.x + BUTTON_SIZE / 2;
      const side = centerX < vw / 2 ? 'left' : 'right';
      const snappedY = clamp(coords.y, TOP_SAFE, vh - BOTTOM_SAFE - BUTTON_SIZE);
      const topPct = snappedY / vh;
      const next = { side, topPct };
      setPosition(next);
      setCoords(settledCoords(next));
      writePersistedPosition(next);
      setDragging(false);
    },
    [coords]
  );

  const handlePointerCancel = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag.active) return;
      drag.active = false;
      try {
        buttonRef.current?.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setDragging(false);
      setCoords(settledCoords(position));
    },
    [position]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setModalOpen(true);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`feedback-btn${dragging ? ' is-dragging' : ''}`}
        style={{ transform: `translate3d(${coords.x}px, ${coords.y}px, 0)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onKeyDown={handleKeyDown}
        aria-label="Send feedback"
      >
        <span className="material-icons" aria-hidden="true">
          feedback
        </span>
      </button>
      {modalOpen && (
        <FeedbackModal
          page={location.pathname}
          displayName={displayName}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

export default FeedbackButton;
