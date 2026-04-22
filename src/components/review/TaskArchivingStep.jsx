// src/components/review/TaskArchivingStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions, expireMission } from '../../services/missionService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { toDateString, formatForUser } from '../../utils/dateHelpers';
import './TaskArchivingStep.css';

const TaskArchivingStep = ({ onNext, onSkipToSummary }) => {
  const { currentUser } = useAuth();
  const [expiredMissions, setExpiredMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [archivingId, setArchivingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const today = toDateString(new Date());

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const missions = await withTimeout(getActiveMissions(currentUser.uid));
      // Surface active missions with a passed expiryDate
      const expired = missions.filter(
        m => m.expiryDate && m.expiryDate < today
      );
      setExpiredMissions(expired);
    } catch (err) {
      console.error('Error loading missions for archiving:', err);
      setLoadError(getLoadErrorMessage(err, 'missions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const handleArchive = async (missionId) => {
    setArchivingId(missionId);
    setActionError(null);
    try {
      await expireMission(currentUser.uid, missionId);
      setExpiredMissions(prev => prev.filter(m => m.id !== missionId));
    } catch (err) {
      console.error('Error archiving mission:', err);
      setActionError("That mission didn't archive. Try again.");
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Clean House</h2>
        <p className="review-step-subtext">
          These missions have passed their deadline. Archive anything that's no longer relevant, or leave it to tackle later.
        </p>

        {loadError && (
          <ErrorMessage message={loadError} onRetry={loadData} />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Checking for expired missions...</p>
        )}

        {!loading && !loadError && expiredMissions.length === 0 && (
          <p className="review-step-empty">No missions with passed deadlines — you're all clear.</p>
        )}

        {actionError && (
          <ErrorMessage message={actionError} />
        )}

        {!loading && !loadError && expiredMissions.map(mission => (
          <div key={mission.id} className="ta-mission-row">
            <div className="ta-mission-info">
              <span className="ta-mission-title">{mission.title}</span>
              <span className="ta-expiry-date">
                Expired {formatForUser(mission.expiryDate)}
              </span>
            </div>
            <button
              className="ta-archive-btn"
              onClick={() => handleArchive(mission.id)}
              disabled={archivingId === mission.id}
            >
              {archivingId === mission.id ? 'Archiving...' : 'Archive'}
            </button>
          </div>
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

export default TaskArchivingStep;
