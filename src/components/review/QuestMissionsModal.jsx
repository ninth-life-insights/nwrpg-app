// src/components/review/QuestMissionsModal.jsx
import { useState } from 'react';
import Badge from '../ui/Badge';
import './QuestMissionsModal.css';

const MissionRow = ({ mission, onComplete, completing }) => {
  const isDone = mission.status === 'completed';

  return (
    <div className={`qmm-mission-row ${isDone ? 'qmm-mission-row--done' : ''}`}>
      <button
        className={`qmm-complete-btn ${isDone ? 'qmm-complete-btn--done' : ''}`}
        onClick={() => !isDone && onComplete(mission.id)}
        disabled={isDone || completing}
        aria-label={isDone ? 'Completed' : 'Mark complete'}
      >
        <span className="material-icons">
          {isDone ? 'check_circle' : 'radio_button_unchecked'}
        </span>
      </button>
      <div className="qmm-mission-info">
        <span className="qmm-mission-title">{mission.title}</span>
        {mission.skillName && (
          <span className="qmm-mission-skill">{mission.skillName}</span>
        )}
      </div>
      {completing === mission.id && (
        <span className="qmm-completing">...</span>
      )}
    </div>
  );
};

const QuestMissionsModal = ({ quest, missions, onMissionComplete, onClose }) => {
  const [completing, setCompleting] = useState(null);
  const [localMissions, setLocalMissions] = useState(missions);

  // Sort: incomplete first, then by customSortOrder
  const sorted = [...localMissions].sort((a, b) => {
    const aDone = a.status === 'completed' ? 1 : 0;
    const bDone = b.status === 'completed' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return (a.customSortOrder ?? 999) - (b.customSortOrder ?? 999);
  });

  const completedCount = localMissions.filter(m => m.status === 'completed').length;
  const totalCount = localMissions.length;
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleComplete = async (missionId) => {
    if (completing) return;
    setCompleting(missionId);
    try {
      await onMissionComplete(missionId);
      setLocalMissions(prev =>
        prev.map(m => m.id === missionId ? { ...m, status: 'completed' } : m)
      );
    } finally {
      setCompleting(null);
    }
  };

  return (
    <div className="qmm-overlay" onClick={onClose}>
      <div className="qmm-sheet" onClick={e => e.stopPropagation()}>

        <div className="qmm-header">
          <div className="qmm-header-main">
            <div className="qmm-header-text">
              <h2 className="qmm-quest-title">{quest.title}</h2>
              <div className="qmm-header-meta">
                <Badge variant="difficulty" difficulty={quest.difficulty} />
                <span className="qmm-progress-label">
                  {completedCount}/{totalCount} complete
                </span>
              </div>
            </div>
            <button className="qmm-close-btn" onClick={onClose} aria-label="Close">
              <span className="material-icons">close</span>
            </button>
          </div>
          <div className="qmm-header-bar">
            <div className="qmm-header-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="qmm-body">
          {sorted.length === 0 ? (
            <p className="qmm-empty">No missions in this quest yet.</p>
          ) : (
            sorted.map(mission => (
              <MissionRow
                key={mission.id}
                mission={mission}
                onComplete={handleComplete}
                completing={completing}
              />
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default QuestMissionsModal;
