// src/components/missions/MissionCardFull.js
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import AddMissionCard from './AddMissionCard';
import {
  MISSION_STATUS,
} from '../../types/Mission';
import {
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  formatForUser,
  formatForUserLong
} from '../../utils/dateHelpers';
import { isRecurringMission, isEvergreenMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import './MissionCardFull.css';

const MissionCardFull = ({
  mission,
  onClose,
  onToggleComplete,
  onDeleteMission,
  onArchiveMission,
  onRestoreMission,
  onUpdateMission,
  quest = null
}) => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [showExpiryNote, setShowExpiryNote] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);

  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClickOutside = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showActionsMenu]);

  const handleQuestClick = (e) => {
    e.stopPropagation();
    if (quest && quest.id) {
      navigate(`/quests/${quest.id}`);
    }
  };

  const getDueDateInfo = () => {
    if (!mission.dueDate) return null;

    if (isMissionOverdue(mission)) return { status: 'overdue', display: `Overdue · ${formatForUser(mission.dueDate)}` };
    if (isMissionDueToday(mission)) return { status: 'today', display: 'Due Today' };
    if (isMissionDueTomorrow(mission)) return { status: 'tomorrow', display: 'Due Tomorrow' };

    return {
      status: 'upcoming',
      display: formatForUser(mission.dueDate)
    };
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatForUserLong(date);
  };

  const wasEdited = () => {
    if (!mission.updatedAt || !mission.createdAt) return false;
    const created = mission.createdAt.toDate ? mission.createdAt.toDate() : new Date(mission.createdAt);
    const updated = mission.updatedAt.toDate ? mission.updatedAt.toDate() : new Date(mission.updatedAt);
    return Math.abs(updated - created) > 5 * 60 * 1000; // more than 5 minutes apart
  };

  const dueDateInfo = getDueDateInfo();
  const createdDisplay = formatTimestamp(mission.createdAt);
  const editedDisplay = wasEdited() ? formatTimestamp(mission.updatedAt) : null;
  const expiryDisplay = mission.expiryDate ? formatForUserLong(mission.expiryDate) : null;
  const completedDisplay = formatTimestamp(mission.completedAt);
  const isRecurring = isRecurringMission(mission);
  const isEvergreen = isEvergreenMission(mission);
  const recurrenceText = getRecurrenceDisplayText(mission);
  const isCompleted = mission.status === MISSION_STATUS.COMPLETED;
  const isActive = mission.status === MISSION_STATUS.ACTIVE;
  const isExpired = mission.status === MISSION_STATUS.EXPIRED;

  const handleDeleteMission = async () => {
    if (onDeleteMission) {
      await onDeleteMission(mission.id);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
  };

  const handleMissionUpdate = (updatedMission) => {
    if (onUpdateMission) {
      onUpdateMission(updatedMission);
    }
    setIsEditing(false);
  };

  return (
    <>
      <div className="mission-detail-overlay" onClick={onClose}>
        <div className="mission-detail-modal" onClick={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <div className="mission-detail-header">
            <button className="back-button" onClick={onClose} aria-label="Close">
              <span className="material-icons">arrow_back</span>
            </button>

            {!isExpired && (
              <div className="actions-menu-wrapper" ref={actionsMenuRef}>
                <button
                  className="more-button"
                  onClick={(e) => { e.stopPropagation(); setShowActionsMenu(v => !v); }}
                  aria-label="More options"
                >
                  <span className="material-icons">more_vert</span>
                </button>
                {showActionsMenu && (
                  <div className="actions-dropdown">
                    <button
                      className="dropdown-item archive-item"
                      onClick={() => { setShowActionsMenu(false); onArchiveMission && onArchiveMission(mission.id); }}
                    >
                      <span className="material-icons">archive</span>
                      Archive
                    </button>
                    <button
                      className="dropdown-item delete-item"
                      onClick={() => { setShowActionsMenu(false); handleDeleteMission(); }}
                    >
                      <span className="material-icons">delete</span>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mission Content */}
          <div className="mission-detail-content">
            
            {/* Daily Mission Badge */}
            {mission.isDailyMission && (
              <div className="daily-mission-header">
                <Badge variant="daily-large" icon="sunny">Daily</Badge>
              </div>
            )}
            
            {/* Title with Edit Button */}
            <div className="mission-title-section">
              <div className="title-with-edit">
                <h2 className={`mission-detail-title ${isCompleted ? 'completed' : ''}`}>
                  {mission.title}
                </h2>
                {isActive && (
                  <button className="edit-button-inline" onClick={handleEditClick} title="Edit mission">
                    <span className="material-icons">edit</span>
                  </button>
                )}
              </div>
              
              {/* Description */}
              <div className={`mission-description${mission.description ? '' : ' empty'}`}>
                <p>{mission.description || 'No description'}</p>
              </div>
            </div>

            {/* Badges */}
            <div className="mission-badges">
              {isRecurring && (
                <Badge variant="recurrence">{recurrenceText}</Badge>
              )}

              {isEvergreen && (
                <Badge variant="evergreen">Evergreen</Badge>
              )}
              
              {dueDateInfo && (
                <Badge variant={`due-${dueDateInfo.status}`}>
                  {dueDateInfo.display}
                </Badge>
              )}

              {quest && (
              <div className="quest-indicator-badge" onClick={handleQuestClick}>
                <Badge variant="quest">Quest: {quest.title}</Badge>
              </div>
            )}

              <Badge variant="difficulty" difficulty={mission.difficulty}>{mission.difficulty}</Badge>
              
              {mission.skill && (
                <Badge variant="skill">Skill: {mission.skill}</Badge>
              )}
            </div>

            {/* Mission Metadata */}
            <div className="mission-metadata">
              {(createdDisplay || editedDisplay) && (
                <div className="metadata-row">
                  {createdDisplay && <span>Created {createdDisplay}</span>}
                  {editedDisplay && (
                    <>
                      {createdDisplay && <span className="metadata-sep">·</span>}
                      <span>Edited {editedDisplay}</span>
                    </>
                  )}
                </div>
              )}
              {isCompleted && completedDisplay && (
                <div className="metadata-row">
                  <span>Completed {completedDisplay}</span>
                </div>
              )}
              {expiryDisplay && (
                <div className="metadata-row expiry-row">
                  <span>Expires {expiryDisplay}</span>
                  <span
                    className="info-icon"
                    aria-label="About expiry"
                    onClick={() => setShowExpiryNote(v => !v)}
                  >ⓘ</span>
                  {showExpiryNote && (
                    <p className="expiry-note">Missions are never archived without your permission. After the expiry date, this mission will be surfaced during your weekly review.</p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mission-actions">
              {isExpired ? (
                <button
                  onClick={() => onRestoreMission && onRestoreMission(mission.id)}
                  className="action-button restore-button"
                >
                  Restore Mission
                </button>
              ) : (
                <button
                  onClick={() => onToggleComplete(mission.id, isCompleted, mission.xpReward)}
                  className={`action-button ${isCompleted ? 'mark-incomplete' : 'mark-complete'}`}
                >
                  {isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal Overlay */}
      {isEditing && (
        <AddMissionCard
          mode="edit"
          initialMission={mission}
          onCancel={handleEditCancel}
          onUpdateMission={handleMissionUpdate}
        />
      )}
    </>
  );
};

export default MissionCardFull;