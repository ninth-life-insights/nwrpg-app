// src/components/review/TaskExpirationStep.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { deleteMission } from '../../services/missionService';
import { getExpiringMissions, renewMissionExpiry } from '../../services/weeklyReviewService';
import { withTimeout, isDefinitelyOffline } from '../../utils/fetchWithTimeout';
import { formatForUser } from '../../utils/dateHelpers';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';
import './TaskExpirationStep.css';

const TaskExpirationStep = ({ onNext, onBack }) => {
  const { currentUser } = useAuth();

  const [expired, setExpired] = useState([]);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [renewingId, setRenewingId] = useState(null);
  const [renewDate, setRenewDate] = useState(''); // for the inline date picker

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your expiring tasks didn't load. Check your connection and try again.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const result = await withTimeout(getExpiringMissions(currentUser.uid, 14));
      setExpired(result.expired);
      setExpiringSoon(result.expiringSoon);
    } catch {
      setLoadError("Your expiring tasks didn't load.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleArchive = async (missionId) => {
    setActionError(null);
    try {
      await deleteMission(currentUser.uid, missionId);
      setExpired(prev => prev.filter(m => m.id !== missionId));
      setExpiringSoon(prev => prev.filter(m => m.id !== missionId));
    } catch {
      setActionError("That task didn't archive. Try again.");
    }
  };

  const handleBulkArchiveExpired = async () => {
    setActionError(null);
    setBulkArchiving(true);
    try {
      await Promise.all(expired.map(m => deleteMission(currentUser.uid, m.id)));
      setExpired([]);
    } catch {
      setActionError("Some tasks didn't archive. Try again.");
      await loadData();
    } finally {
      setBulkArchiving(false);
    }
  };

  const openRenew = (mission) => {
    setRenewingId(mission.id);
    // Default to 2 weeks from today
    const twoWeeksOut = new Date();
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
    setRenewDate(twoWeeksOut.toISOString().slice(0, 10));
  };

  const handleRenew = async (missionId) => {
    if (!renewDate) return;
    setActionError(null);
    try {
      await renewMissionExpiry(currentUser.uid, missionId, renewDate);
      setExpired(prev => prev.filter(m => m.id !== missionId));
      setExpiringSoon(prev => prev.filter(m => m.id !== missionId));
      setRenewingId(null);
    } catch {
      setActionError("That task didn't renew. Try again.");
    }
  };

  const totalCount = expired.length + expiringSoon.length;

  const renderMissionRow = (mission, isExpired) => {
    const isRenewing = renewingId === mission.id;
    return (
      <div key={mission.id} className="expiry-mission-row">
        <div className="expiry-mission-info">
          <span className="expiry-mission-title">{mission.title}</span>
          <span className={`expiry-mission-date ${isExpired ? 'expiry-mission-date--expired' : ''}`}>
            {isExpired ? `Expired ${formatForUser(mission.expiryDate)}` : `Expires ${formatForUser(mission.expiryDate)}`}
          </span>
        </div>

        {isRenewing ? (
          <div className="expiry-renew-form">
            <input
              type="date"
              className="expiry-date-input"
              value={renewDate}
              onChange={e => setRenewDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
            <div className="expiry-renew-actions">
              <button
                className="expiry-btn expiry-btn--confirm"
                onClick={() => handleRenew(mission.id)}
                disabled={!renewDate}
              >
                Save
              </button>
              <button
                className="expiry-btn expiry-btn--cancel"
                onClick={() => setRenewingId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="expiry-mission-actions">
            <button
              className="expiry-btn expiry-btn--renew"
              onClick={() => openRenew(mission)}
            >
              Renew
            </button>
            <button
              className="expiry-btn expiry-btn--archive"
              onClick={() => handleArchive(mission.id)}
            >
              Archive
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Expiring Tasks</h2>
        <p className="review-step-subtext">
          Archive tasks you no longer need, or renew ones that still matter.
        </p>

        {loadError && <ErrorMessage message={loadError} onRetry={loadData} />}
        {actionError && <ErrorMessage message={actionError} />}

        {loading && <p className="review-step-loading">Loading…</p>}

        {!loading && !loadError && totalCount === 0 && (
          <p className="review-step-empty">No tasks expiring in the next 14 days.</p>
        )}

        {/* Expired section */}
        {!loading && !loadError && expired.length > 0 && (
          <div className="expiry-section">
            <div className="expiry-section-header">
              <span className="expiry-section-label">Expired</span>
              <button
                className="expiry-bulk-archive-btn"
                onClick={handleBulkArchiveExpired}
                disabled={bulkArchiving}
              >
                {bulkArchiving ? 'Archiving…' : `Archive all (${expired.length})`}
              </button>
            </div>
            <div className="expiry-mission-list">
              {expired.map(m => renderMissionRow(m, true))}
            </div>
          </div>
        )}

        {/* Expiring soon section */}
        {!loading && !loadError && expiringSoon.length > 0 && (
          <div className="expiry-section">
            <div className="expiry-section-header">
              <span className="expiry-section-label">Expiring soon</span>
            </div>
            <div className="expiry-mission-list">
              {expiringSoon.map(m => renderMissionRow(m, false))}
            </div>
          </div>
        )}
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next
        </button>
        <button className="review-skip-link" onClick={onBack}>
          Back
        </button>
      </StickyFooter>
    </div>
  );
};

export default TaskExpirationStep;
