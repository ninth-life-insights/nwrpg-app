// src/pages/WeeklyLogDetailPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getWeeklySnapshot,
  generateWeeklySnapshot,
  updateWeeklySnapshotStory,
} from '../services/weeklyReviewService';
import WeeklyReviewSummary from '../components/review/WeeklyReviewSummary';
import ErrorMessage from '../components/ui/ErrorMessage';
import { formatWeekLabel } from '../utils/weeklyReviewHelpers';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import dayjs from 'dayjs';
import './WeeklyLogDetailPage.css';

const WeeklyLogDetailPage = () => {
  const { currentUser } = useAuth();
  const { weekStart } = useParams();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  const weekEnd = weekStart ? dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD') : null;
  const headerTitle = weekStart && weekEnd
    ? formatWeekLabel(dayjs(weekStart), dayjs(weekEnd))
    : 'Weekly Review';

  useEffect(() => {
    if (!currentUser || !weekStart) return;
    const load = async () => {
      if (isDefinitelyOffline()) {
        setLoadError("This entry didn't load. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snap = await withTimeout(getWeeklySnapshot(currentUser.uid, weekStart));
        if (snap) setSnapshot(snap);
      } catch (err) {
        console.error('Error loading weekly snapshot:', err);
        setLoadError(getLoadErrorMessage(err, 'this entry'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser, weekStart, reloadTrigger]);

  const handleUpdateStory = async (text) => {
    await updateWeeklySnapshotStory(currentUser.uid, weekStart, text);
    setSnapshot(prev => ({ ...prev, userEditedStory: text }));
  };

  const handleRegenerateStory = (newStory) => {
    setSnapshot(prev => ({ ...prev, aiStory: newStory, userEditedStory: null }));
  };

  return (
    <div className="weekly-log-detail-page">
      <header className="adventure-log-detail-header">
        <button
          className="adventure-log-detail-back-btn"
          onClick={() => navigate('/adventure-log')}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="adventure-log-detail-title">{headerTitle}</h1>
        <div className="adventure-log-detail-header-spacer" />
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
        />
      )}

      {loading ? (
        <div className="adventure-log-detail-loading">
          <p>Loading entry...</p>
        </div>
      ) : loadError ? null : !snapshot ? (
        <div className="adventure-log-detail-empty">
          <span className="material-icons">search_off</span>
          <p>No weekly review found for this period.</p>
        </div>
      ) : (
        <div className="adventure-log-detail-content">
          <WeeklyReviewSummary
            snapshot={snapshot}
            loading={false}
            onUpdateStory={handleUpdateStory}
            onRegenerateStory={handleRegenerateStory}
            userId={currentUser.uid}
            weekStart={weekStart}
            weekEnd={snapshot.weekEnd || weekEnd}
          />
        </div>
      )}
    </div>
  );
};

export default WeeklyLogDetailPage;
