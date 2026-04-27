// src/components/review/QuestReviewCard.jsx
import { useState } from 'react';
import Badge from '../ui/Badge';
import './QuestReviewCard.css';

const QuestReviewCard = ({
  quest,
  weeklyStats,        // { count, lastDate } | null
  isRecentlyCompleted, // bool — renders a "completed this week" treatment
  onViewMissions,
  onArchive,          // (questId) => void — called after confirm
}) => {
  const [showConfirm, setShowConfirm] = useState(false);

  // Use quest's cached counts — getActiveMissions only returns active (incomplete)
  // missions so counting from the array would always show 0 completed.
  const totalMissions = quest.totalMissions ?? 0;
  const completedMissions = quest.completedMissions ?? 0;
  const weeklyCount = weeklyStats?.count ?? 0;

  // Progress bar segments: prior = completed before this week, weekly = completed this week
  const priorCompleted = Math.max(0, completedMissions - weeklyCount);
  const priorPct = totalMissions > 0 ? (priorCompleted / totalMissions) * 100 : 0;
  const weeklyPct = totalMissions > 0 ? (Math.min(weeklyCount, completedMissions) / totalMissions) * 100 : 0;
  const completedPct = isRecentlyCompleted && totalMissions > 0 ? 100 : 0;

  const handleArchiveClick = () => setShowConfirm(true);
  const handleConfirmArchive = () => {
    setShowConfirm(false);
    onArchive(quest.id);
  };

  if (isRecentlyCompleted) {
    return (
      <div className="qrc-card qrc-card--completed">
        <div className="qrc-completed-banner">
          <span className="material-icons qrc-completed-icon">workspace_premium</span>
          <span className="qrc-completed-label">Completed this week</span>
        </div>
        <div className="qrc-header">
          <div className="qrc-title-row">
            <div className="qrc-title-group">
              <h3 className="qrc-title">{quest.title}</h3>
              <div className="qrc-meta">
                <Badge variant="difficulty" difficulty={quest.difficulty}>{quest.difficulty}</Badge>
              </div>
            </div>
            <div className="qrc-count">
              <span className="qrc-count-done">{completedMissions}</span>
              <span className="qrc-count-sep">/</span>
              <span className="qrc-count-total">{totalMissions}</span>
            </div>
          </div>
          <div className="qrc-bar-track">
            <div className="qrc-bar-full" style={{ width: `${completedPct}%` }} />
          </div>
        </div>
        <div className="qrc-actions">
          <button className="qrc-view-btn" onClick={() => onViewMissions(quest.id)}>
            <span className="material-icons">list</span>
            View missions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="qrc-card">
      <div className="qrc-header">
        <div className="qrc-title-row">
          <div className="qrc-title-group">
            <h3 className="qrc-title">{quest.title}</h3>
            <div className="qrc-meta">
              <Badge variant="difficulty" difficulty={quest.difficulty}>{quest.difficulty}</Badge>
              {weeklyCount > 0 && (
                <span className="qrc-week-badge">
                  {weeklyCount} this week
                </span>
              )}
            </div>
          </div>
          <div className="qrc-count">
            <span className="qrc-count-done">{completedMissions}</span>
            <span className="qrc-count-sep">/</span>
            <span className="qrc-count-total">{totalMissions}</span>
          </div>
        </div>

        <div className="qrc-bar-track">
          <div className="qrc-bar-prior" style={{ width: `${priorPct}%` }} />
          <div className="qrc-bar-weekly" style={{ width: `${weeklyPct}%`, left: `${priorPct}%` }} />
        </div>
      </div>

      {showConfirm ? (
        <div className="qg-confirm-row">
          <span className="qg-confirm-text">Archive this quest?</span>
          <div className="qg-confirm-actions">
            <button
              className="qg-confirm-btn qg-confirm-btn--yes"
              onClick={handleConfirmArchive}
            >
              Archive
            </button>
            <button
              className="qg-confirm-btn qg-confirm-btn--no"
              onClick={() => setShowConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="qrc-actions">
          <button className="qrc-archive-btn" onClick={handleArchiveClick}>
            Archive
          </button>
          <button className="qrc-view-btn" onClick={() => onViewMissions(quest.id)}>
            <span className="material-icons">list</span>
            View missions
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestReviewCard;
