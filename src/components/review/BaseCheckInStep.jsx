// src/components/review/BaseCheckInStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getRooms, updateRoomCleanliness } from '../../services/roomService';
import { getAllMissions } from '../../services/missionService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout } from '../../utils/fetchWithTimeout';
import dayjs from 'dayjs';
import './BaseCheckInStep.css';

const CLEANLINESS_COLORS = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#10b981' };
const CLEANLINESS_LABELS = { 1: 'Messy', 2: 'Needs Help', 3: 'Workable', 4: 'Clean', 5: 'Spotless' };

const isImageIcon = (icon) => icon && icon.includes('.');

const calcRoomStats = (roomId, missions) => {
  const now = dayjs();
  const sevenDaysAgo = now.subtract(7, 'day');
  const sevenDaysFromNow = now.add(7, 'day');

  let completedThisWeek = 0;
  let dueNextWeek = 0;
  let overdue = 0;

  missions.forEach(m => {
    if (m.baseLocation !== roomId || m.status === 'deleted') return;

    if (m.status === 'completed') {
      if (m.completedAt) {
        const completedDate = m.completedAt.toDate ? m.completedAt.toDate() : new Date(m.completedAt);
        if (dayjs(completedDate).isAfter(sevenDaysAgo)) completedThisWeek++;
      }
    } else if (m.status === 'active' && m.dueDate) {
      const due = dayjs(m.dueDate);
      if (due.isBefore(now, 'day')) {
        overdue++;
      } else if (!due.isAfter(sevenDaysFromNow, 'day')) {
        dueNextWeek++;
      }
    }
  });

  return { completedThisWeek, dueNextWeek, overdue };
};

const buildStatsLine = ({ completedThisWeek, dueNextWeek, overdue }) => {
  const parts = [];
  if (completedThisWeek > 0) parts.push({ text: `${completedThisWeek} done`, overdue: false });
  if (dueNextWeek > 0) parts.push({ text: `${dueNextWeek} due next week`, overdue: false });
  if (overdue > 0) parts.push({ text: `${overdue} overdue`, overdue: true });
  return parts;
};

// ─── Room row ─────────────────────────────────────────────────────────────────

const RoomCheckInRow = ({ room, stats, localCleanliness, actionError, onCleanlinessChange, onCleanlinessSave }) => {
  const [showSlider, setShowSlider] = useState(false);

  const cleanlinessColor = CLEANLINESS_COLORS[localCleanliness];
  const cleanlinessLabel = CLEANLINESS_LABELS[localCleanliness];
  const cleanlinessPercent = (localCleanliness / 5) * 100;
  const statsParts = buildStatsLine(stats);

  return (
    <div className="bci-room-row">
      <div className="bci-room-top">
        <div className="bci-room-icon-wrap">
          {isImageIcon(room.icon)
            ? <img src={`/assets/Rooms/${room.icon}`} alt="" className="bci-room-img" />
            : <span className="material-icons bci-room-material-icon">{room.icon}</span>
          }
        </div>

        <span className="bci-room-name">{room.name}</span>

        <button
          className="bci-cleanliness-toggle"
          onClick={() => setShowSlider(v => !v)}
          aria-label="Adjust cleanliness"
        >
          <span className="bci-cleanliness-label" style={{ color: cleanlinessColor }}>
            {cleanlinessLabel}
          </span>
          <span className="material-icons bci-toggle-chevron">
            {showSlider ? 'expand_less' : 'expand_more'}
          </span>
        </button>
      </div>

      <div className="bci-bar-track">
        <div
          className="bci-bar-fill"
          style={{ width: `${cleanlinessPercent}%`, backgroundColor: cleanlinessColor }}
        />
      </div>

      {showSlider && (
        <input
          type="range"
          min="1"
          max="5"
          value={localCleanliness}
          onChange={e => onCleanlinessChange(room.id, parseInt(e.target.value))}
          onMouseUp={() => onCleanlinessSave(room.id)}
          onTouchEnd={() => onCleanlinessSave(room.id)}
          className="bci-slider"
        />
      )}

      {actionError && <p className="bci-action-error">{actionError}</p>}

      {statsParts.length > 0 && (
        <p className="bci-stats-line">
          {statsParts.map((part, i) => (
            <span key={i}>
              {i > 0 && <span className="bci-stats-sep"> · </span>}
              <span className={part.overdue ? 'bci-stats-overdue' : ''}>{part.text}</span>
            </span>
          ))}
        </p>
      )}
    </div>
  );
};

// ─── Main step ────────────────────────────────────────────────────────────────

const BaseCheckInStep = ({ onNext, onSkipToSummary }) => {
  const { currentUser } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [allMissions, setAllMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [cleanlinessMap, setCleanlinessMap] = useState({});
  const [actionErrors, setActionErrors] = useState({});

  const load = async () => {
    if (!currentUser) return;
    setLoadError(null);
    setLoading(true);
    try {
      const [roomData, missions] = await withTimeout(
        Promise.all([
          getRooms(currentUser.uid),
          getAllMissions(currentUser.uid),
        ])
      );
      setRooms(roomData);
      setAllMissions(missions);
      const initial = {};
      roomData.forEach(r => { initial[r.id] = r.cleanliness || 3; });
      setCleanlinessMap(initial);
    } catch (err) {
      console.error('Error loading base check-in data:', err);
      setLoadError("Your base didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentUser]);

  const handleCleanlinessChange = (roomId, value) => {
    setCleanlinessMap(prev => ({ ...prev, [roomId]: value }));
  };

  const handleCleanlinessSave = async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const value = cleanlinessMap[roomId];
    if (value === room.cleanliness) return;

    setActionErrors(prev => ({ ...prev, [roomId]: null }));
    try {
      await updateRoomCleanliness(currentUser.uid, roomId, value);
      setRooms(prev => prev.map(r => r.id === roomId ? { ...r, cleanliness: value } : r));
    } catch (err) {
      console.error('Error saving cleanliness:', err);
      setActionErrors(prev => ({
        ...prev,
        [roomId]: "That cleanliness update didn't save. Try again.",
      }));
      setCleanlinessMap(prev => ({ ...prev, [roomId]: room.cleanliness }));
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Base Check-In</h2>
        <p className="review-step-subtext">
          Take a moment to walk through each room and see how things are holding up.
          Updating cleanliness ratings now helps keep your weekly picture accurate.
        </p>

        {loadError && (
          <ErrorMessage message={loadError} onRetry={load} />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Loading your base...</p>
        )}

        {!loading && !loadError && (
          <div className="bci-room-list">
            {rooms.map(room => (
              <RoomCheckInRow
                key={room.id}
                room={room}
                stats={calcRoomStats(room.id, allMissions)}
                localCleanliness={cleanlinessMap[room.id] ?? room.cleanliness ?? 3}
                actionError={actionErrors[room.id]}
                onCleanlinessChange={handleCleanlinessChange}
                onCleanlinessSave={handleCleanlinessSave}
              />
            ))}
          </div>
        )}
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Skip to summary
        </button>
      </StickyFooter>
    </div>
  );
};

export default BaseCheckInStep;
