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

// ─── Room card ────────────────────────────────────────────────────────────────

const RoomCheckInCard = ({ room, stats, localCleanliness, actionError, onCleanlinessChange, onCleanlinessSave }) => {
  const [showSlider, setShowSlider] = useState(false);

  const cleanlinessColor = CLEANLINESS_COLORS[localCleanliness];
  const cleanlinessLabel = CLEANLINESS_LABELS[localCleanliness];
  const cleanlinessPercent = (localCleanliness / 5) * 100;

  return (
    <div className="bci-room-card">
      <div className="bci-room-header">
        <div className="bci-room-icon">
          {isImageIcon(room.icon)
            ? <img src={`/assets/Rooms/${room.icon}`} alt={room.name} className="bci-room-icon-img" />
            : <span className="material-icons">{room.icon}</span>
          }
        </div>
        <span className="bci-room-name">{room.name}</span>
      </div>

      <div className="bci-cleanliness-row">
        <div className="bci-cleanliness-bar-wrap">
          <div className="bci-cleanliness-bar-track">
            <div
              className="bci-cleanliness-bar-fill"
              style={{ width: `${cleanlinessPercent}%`, backgroundColor: cleanlinessColor }}
            />
          </div>
        </div>
        <span className="bci-cleanliness-label" style={{ color: cleanlinessColor }}>
          {cleanlinessLabel}
        </span>
        <button
          className="bci-cleanliness-edit-btn"
          onClick={() => setShowSlider(v => !v)}
          aria-label="Adjust cleanliness"
        >
          <span className="material-icons">
            {showSlider ? 'expand_less' : 'edit'}
          </span>
        </button>
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
          className="bci-cleanliness-slider"
        />
      )}

      {actionError && (
        <p className="bci-action-error">{actionError}</p>
      )}

      <div className="bci-stats-grid">
        <div className="bci-stat">
          <div className="bci-stat-number">{stats.completedThisWeek}</div>
          <div className="bci-stat-label">Done This Week</div>
        </div>
        <div className="bci-stat">
          <div className="bci-stat-number">{stats.dueNextWeek}</div>
          <div className="bci-stat-label">Due Next Week</div>
        </div>
        <div className={`bci-stat ${stats.overdue > 0 ? 'bci-stat--overdue' : ''}`}>
          <div className="bci-stat-number">{stats.overdue}</div>
          <div className="bci-stat-label">Overdue</div>
        </div>
      </div>
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

        {!loading && !loadError && rooms.map(room => (
          <RoomCheckInCard
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
