// src/pages/AdventureLogDetailPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  getDailySnapshot,
  updateSnapshotStory,
  getEncountersForDate,
} from '../services/reviewService';
import ReviewSummary from '../components/review/ReviewSummary';
import './AdventureLogDetailPage.css';

// Format "2026-04-09" → "Wednesday, Apr 9, 2026"
const formatDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
};

const AdventureLogDetailPage = () => {
  const { currentUser } = useAuth();
  const { date } = useParams();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser || !date) return;
    const load = async () => {
      setLoading(true);
      try {
        const [snap, encounters] = await Promise.all([
          getDailySnapshot(currentUser.uid, date),
          getEncountersForDate(currentUser.uid, date),
        ]);
        if (snap) setSnapshot({ ...snap, encounters });
      } catch (err) {
        console.error('Error loading snapshot:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser, date]);

  const handleUpdateStory = async (text) => {
    await updateSnapshotStory(currentUser.uid, date, text);
    setSnapshot(prev => ({ ...prev, userEditedStory: text }));
  };

  const handleRegenerateStory = async (newStory) => {
    setSnapshot(prev => ({ ...prev, aiStory: newStory, aiStoryGenerated: true }));
  };

  return (
    <div className="adventure-log-detail-page">
      <header className="adventure-log-detail-header">
        <button
          className="adventure-log-detail-back-btn"
          onClick={() => navigate('/adventure-log')}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        {date && <h1 className="adventure-log-detail-title">{formatDate(date)}</h1>}
        <div className="adventure-log-detail-header-spacer" />
      </header>

      {loading ? (
        <div className="adventure-log-detail-loading">
          <p>Loading entry...</p>
        </div>
      ) : !snapshot ? (
        <div className="adventure-log-detail-empty">
          <span className="material-icons">search_off</span>
          <p>No entry found for this date.</p>
        </div>
      ) : (
        <div className="adventure-log-detail-content">
          <ReviewSummary
            snapshot={snapshot}
            loading={false}
            onUpdateStory={handleUpdateStory}
            onRegenerateStory={handleRegenerateStory}
            userId={currentUser.uid}
            date={date}
          />
        </div>
      )}
    </div>
  );
};

export default AdventureLogDetailPage;
