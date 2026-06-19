// src/components/missions/MissionCardFull.js
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import AddMissionCard from './AddMissionCard';
import ErrorMessage from '../ui/ErrorMessage';
import {
  MISSION_STATUS,
} from '../../types/Mission';
import {
  isMissionDueToday,
  isMissionDueTomorrow,
  isMissionOverdue,
  formatForUser,
  formatForUserLong,
  toDateString
} from '../../utils/dateHelpers';
import { isRecurringMission, isEvergreenMission, getRecurrenceDisplayText } from '../../utils/recurrenceHelpers';
import { useRooms } from '../../contexts/RoomsContext';
import { useQuests } from '../../contexts/QuestsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useIsDailyMission } from '../../contexts/DailyMissionsContext';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import {
  deleteMission,
  archiveMission,
  restoreMission,
  updateMissionCompletedDate,
  toggleMissionPriority,
} from '../../services/missionService';
import dayjs from 'dayjs';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './MissionCardFull.css';

const MissionCardFull = ({
  mission,
  onClose,
  onToggleComplete,
  onMissionChanged,
  onPriorityToggled,
  onCompletedAtChanged,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { roomsMap } = useRooms();
  const { questsMap } = useQuests();
  const { notifyMissionDeleted, notifyMissionArchived } = useNotifications();
  const isDailyMission = useIsDailyMission(mission.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editFocusField, setEditFocusField] = useState(null);

  useModalBackButton(true, onClose);
  const [showExpiryNote, setShowExpiryNote] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [actionRetry, setActionRetry] = useState(null);
  const [missionOverride, setMissionOverride] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState('');
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState(null);
  const actionsMenuRef = useRef(null);

  const displayMission = missionOverride
    ? {
        ...missionOverride,
        status: mission.status,
        xpAwarded: mission.xpAwarded
      }
    : mission;

  const roomName = displayMission.baseLocation ? roomsMap[displayMission.baseLocation]?.name ?? null : null;
  const quest = displayMission.questId ? questsMap[displayMission.questId] ?? null : null;

  const handleClose = () => {
    setMissionOverride(null);
    setActionError(null);
    setActionRetry(null);
    setShowDatePicker(false);
    setDateError(null);
    onClose();
  };

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
    if (!displayMission.dueDate) return null;

    if (isMissionOverdue(displayMission)) return { status: 'overdue', display: `Overdue · ${formatForUser(displayMission.dueDate)}` };
    if (isMissionDueToday(displayMission)) return { status: 'today', display: 'Due Today' };
    if (isMissionDueTomorrow(displayMission)) return { status: 'tomorrow', display: 'Due Tomorrow' };

    return {
      status: 'upcoming',
      display: formatForUser(displayMission.dueDate)
    };
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return formatForUserLong(date);
  };

  const wasEdited = () => {
    if (!displayMission.updatedAt || !displayMission.createdAt) return false;
    const created = displayMission.createdAt.toDate ? displayMission.createdAt.toDate() : new Date(displayMission.createdAt);
    const updated = displayMission.updatedAt.toDate ? displayMission.updatedAt.toDate() : new Date(displayMission.updatedAt);
    return Math.abs(updated - created) > 5 * 60 * 1000;
  };

  const dueDateInfo = getDueDateInfo();
  const createdDisplay = formatTimestamp(displayMission.createdAt);
  const editedDisplay = wasEdited() ? formatTimestamp(displayMission.updatedAt) : null;
  const expiryDisplay = displayMission.expiryDate ? formatForUserLong(displayMission.expiryDate) : null;
  const completedDisplay = formatTimestamp(displayMission.completedAt);
  console.log('[BACKDATE] MissionCardFull rendering', {
    missionId: mission.id,
    propCompletedAt: mission.completedAt?.toDate?.()?.toISOString?.()
      ?? (mission.completedAt instanceof Date ? mission.completedAt.toISOString() : String(mission.completedAt)),
    missionOverrideCompletedAt: missionOverride?.completedAt?.toDate?.()?.toISOString?.()
      ?? (missionOverride?.completedAt instanceof Date ? missionOverride.completedAt.toISOString() : missionOverride?.completedAt && String(missionOverride.completedAt)),
    displayedCompletedAt: displayMission.completedAt?.toDate?.()?.toISOString?.()
      ?? (displayMission.completedAt instanceof Date ? displayMission.completedAt.toISOString() : String(displayMission.completedAt)),
    completedDisplay,
  });
  const today = toDateString(new Date());
  const futureScheduledDates = (displayMission.scheduledDates ?? [])
    .filter(d => d >= today)
    .sort();
  const isRecurring = isRecurringMission(displayMission);
  const isEvergreen = isEvergreenMission(displayMission);
  const recurrenceText = getRecurrenceDisplayText(displayMission, { verbose: true });
  const { isPending, isOptimisticallyComplete } = useMissionCompletion();
  const isCompletionPending = isPending(mission.id);
  const isCompleted = displayMission.status === MISSION_STATUS.COMPLETED;
  const isVisuallyComplete = isCompleted || isOptimisticallyComplete(mission.id);
  const isActive = displayMission.status === MISSION_STATUS.ACTIVE;
  const isExpired = displayMission.status === MISSION_STATUS.EXPIRED;
  const completedDate = isCompleted && displayMission.completedAt
    ? toDateString(displayMission.completedAt.toDate?.() ?? new Date(displayMission.completedAt))
    : null;
  const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const createdAtDateString = displayMission.createdAt
    ? toDateString(displayMission.createdAt.toDate?.() ?? new Date(displayMission.createdAt))
    : null;

  const handleDelete = async () => {
    setActionError(null);
    setActionRetry(() => handleDelete);
    const userId = currentUser.uid;
    const missionId = mission.id;
    const missionTitle = displayMission.title;
    const notifyChange = onMissionChanged;
    try {
      await deleteMission(userId, missionId);
      notifyChange?.(missionId, 'deleted');
      notifyMissionDeleted({
        missionTitle,
        onUndo: async () => {
          await restoreMission(userId, missionId);
          notifyChange?.(missionId, 'restored');
        },
      });
      handleClose();
    } catch {
      setActionError("That mission didn't delete. Try again.");
    }
  };

  const handleArchive = async () => {
    setActionError(null);
    setActionRetry(() => handleArchive);
    const userId = currentUser.uid;
    const missionId = mission.id;
    const missionTitle = displayMission.title;
    const notifyChange = onMissionChanged;
    try {
      await archiveMission(userId, missionId);
      notifyChange?.(missionId, 'archived');
      notifyMissionArchived({
        missionTitle,
        onUndo: async () => {
          await restoreMission(userId, missionId);
          notifyChange?.(missionId, 'restored');
        },
      });
      handleClose();
    } catch {
      setActionError("That mission didn't archive. Try again.");
    }
  };

  const handleRestore = async () => {
    setActionError(null);
    setActionRetry(() => handleRestore);
    try {
      await restoreMission(currentUser.uid, mission.id);
      onMissionChanged?.(mission.id, 'restored');
      handleClose();
    } catch {
      setActionError("That mission didn't restore. Try again.");
    }
  };

  const handleTogglePriority = async () => {
    setActionError(null);
    setActionRetry(() => handleTogglePriority);
    const current = displayMission.isPriority === true;
    // Optimistic update so the card visual responds immediately. We use a
    // lightweight onPriorityToggled callback (not onMissionChanged) so the
    // parent updates just this one mission's field in-place rather than
    // doing a full Firestore reload — which would risk re-mounting state
    // and closing the modal.
    setMissionOverride(prev => ({ ...(prev ?? displayMission), isPriority: !current }));
    onPriorityToggled?.(!current);
    try {
      const isNow = await toggleMissionPriority(currentUser.uid, mission.id);
      setMissionOverride(prev => ({ ...(prev ?? displayMission), isPriority: isNow }));
      onPriorityToggled?.(isNow);
    } catch {
      setMissionOverride(prev => ({ ...(prev ?? displayMission), isPriority: current }));
      onPriorityToggled?.(current);
      setActionError("That mission's priority didn't save. Try again.");
    }
  };

  const openDatePicker = () => {
    setDateError(null);
    setDatePickerValue(completedDate || '');
    setShowDatePicker(true);
  };

  const closeDatePicker = () => {
    setShowDatePicker(false);
    setDateError(null);
  };

  const persistCompletedDate = async (newDateString) => {
    if (!currentUser || dateSaving) return;
    setDateSaving(true);
    setDateError(null);
    try {
      const result = await updateMissionCompletedDate(currentUser.uid, mission.id, newDateString);
      setMissionOverride(prev => ({
        ...(prev ?? displayMission),
        completedAt: result.completedAt,
      }));
      onCompletedAtChanged?.(result.completedAt);
      setShowDatePicker(false);
    } catch (err) {
      console.error('Failed to update completed date:', err);
      setDateError("That date didn't save. Try again.");
    } finally {
      setDateSaving(false);
    }
  };

  const handleMarkYesterday = () => persistCompletedDate(yesterday);

  const handleSavePickedDate = () => {
    if (!datePickerValue) {
      setDateError('Pick a date first.');
      return;
    }
    persistCompletedDate(datePickerValue);
  };

  const handleEditClick = (fieldHint) => {
    setEditFocusField(fieldHint ?? null);
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditFocusField(null);
  };

  const handleMissionUpdate = (updatedMission) => {
    setMissionOverride(updatedMission);
    setIsEditing(false);
    setEditFocusField(null);
    onMissionChanged?.(mission.id, 'updated');
  };

  return createPortal(
    <>
      <div className="mission-detail-overlay" onClick={handleClose}>
        <div className="mission-detail-modal" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="mission-detail-header">
            <button className="mission-modal-back" onClick={handleClose} aria-label="Close">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>

            <div className="mission-detail-header-actions">
              {!isExpired && (
                <button
                  type="button"
                  className={`priority-toggle-btn ${displayMission.isPriority ? 'active' : ''}`}
                  onClick={handleTogglePriority}
                  aria-label={displayMission.isPriority ? 'Remove priority' : 'Mark as priority'}
                  aria-pressed={displayMission.isPriority === true}
                  title={displayMission.isPriority ? 'Remove priority' : 'Mark as priority'}
                >
                  <span className="material-icons">{displayMission.isPriority ? 'flag' : 'outlined_flag'}</span>
                </button>
              )}

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
                      {isActive && (
                        <button
                          className="dropdown-item"
                          onClick={() => { setShowActionsMenu(false); handleEditClick(); }}
                        >
                          <span className="material-icons">edit</span>
                          Edit
                        </button>
                      )}
                      <button
                        className="dropdown-item archive-item"
                        onClick={() => { setShowActionsMenu(false); handleArchive(); }}
                      >
                        <span className="material-icons">archive</span>
                        Archive
                      </button>
                      <button
                        className="dropdown-item delete-item"
                          onClick={() => { setShowActionsMenu(false); handleDelete(); }}
                      >
                        <span className="material-icons">delete</span>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mission Content */}
          <div className="mission-detail-content">
            
            {/* Daily Mission Badge */}
            {isDailyMission && (
              <div className="daily-mission-header">
                <Badge variant="daily-large" icon="sunny">Daily</Badge>
              </div>
            )}

            {/* Title + Description */}
            <div className="mission-title-section">
              <div className="mission-title-with-date">
                <h2
                  className={`mission-detail-title ${isCompleted ? 'completed' : ''}${isActive ? ' tappable' : ''}`}
                  onClick={isActive ? handleEditClick : undefined}
                >
                  {displayMission.title}
                </h2>
                {dueDateInfo && (
                  <Badge variant={`due-${dueDateInfo.status}`}>
                    {dueDateInfo.display}
                  </Badge>
                )}
              </div>

              {displayMission.description ? (
                <div
                  className={`mission-description${isActive ? ' tappable' : ''}`}
                  onClick={isActive ? () => handleEditClick('description') : undefined}
                >
                  <p>{displayMission.description}</p>
                </div>
              ) : isActive ? (
                <button className="ghost-prompt" onClick={() => handleEditClick('description')}>
                  <span className="material-icons">add</span>
                  Add description
                </button>
              ) : null}
            </div>

            {/* Badges */}
            <div className="mission-badges">
              {isRecurring && (
                <Badge variant="recurrence">{recurrenceText}</Badge>
              )}

              {isEvergreen && (
                <Badge variant="evergreen">Evergreen</Badge>
              )}

              {roomName && (
                <button
                  className={`badge-as-button${isActive ? ' tappable' : ''}`}
                  onClick={isActive ? () => handleEditClick('room') : undefined}
                  disabled={!isActive}
                >
                  <Badge variant="room" icon="home">{roomName}</Badge>
                </button>
              )}

              {quest && (
                <div className="quest-indicator-badge" onClick={handleQuestClick}>
                  <Badge variant="quest">Quest: {quest.title}</Badge>
                </div>
              )}

              <Badge variant="difficulty" difficulty={displayMission.difficulty}>{displayMission.difficulty}</Badge>

              {displayMission.skill && (
                <Badge variant="skill">Skill: {displayMission.skill}</Badge>
              )}

              {isActive && !dueDateInfo && (
                <button className="ghost-prompt" onClick={() => handleEditClick('dueDate')}>
                  <span className="material-icons">add</span>
                  Add due date
                </button>
              )}

              {isActive && !displayMission.skill && (
                <button className="ghost-prompt" onClick={() => handleEditClick('skill')}>
                  <span className="material-icons">add</span>
                  Add skill
                </button>
              )}

              {isActive && !roomName && (
                <button className="ghost-prompt" onClick={() => handleEditClick('room')}>
                  <span className="material-icons">add</span>
                  Add room
                </button>
              )}
            </div>

            {/* Scheduled Daily Dates */}
            {futureScheduledDates.length > 0 && (
              <div className="scheduled-daily-row">
                <span className="material-icons scheduled-daily-icon">sunny</span>
                <span className="scheduled-daily-text">
                  Scheduled as daily: {futureScheduledDates.map(d => formatForUserLong(d)).join(', ')}
                </span>
              </div>
            )}

            {/* Completed banner — promoted hierarchy when the mission is done */}
            {isCompleted && completedDisplay && (
              <div className="completed-banner">
                <span className="material-icons completed-banner-icon">check_circle</span>
                <div className="completed-banner-text">
                  <div className="completed-banner-label">Completed</div>
                  <div className="completed-banner-date">{completedDisplay}</div>
                </div>
                {!showDatePicker && (
                  <button
                    type="button"
                    className="completed-banner-edit"
                    onClick={openDatePicker}
                    aria-label="Edit completed date"
                  >
                    <span className="material-icons">edit</span>
                  </button>
                )}
                {showDatePicker && (
                  <div className="completed-date-picker">
                    {completedDate !== yesterday && (
                      <button
                        type="button"
                        className="completed-date-picker-yesterday"
                        onClick={handleMarkYesterday}
                        disabled={dateSaving}
                      >
                        Yesterday
                      </button>
                    )}
                    <input
                      type="date"
                      className="completed-date-picker-input"
                      value={datePickerValue}
                      max={today}
                      min={createdAtDateString || undefined}
                      onChange={(e) => {
                        setDatePickerValue(e.target.value);
                        setDateError(null);
                      }}
                      disabled={dateSaving}
                    />
                    {dateError && (
                      <ErrorMessage message={dateError} />
                    )}
                    <div className="completed-date-picker-actions">
                      <button
                        type="button"
                        className="completed-date-picker-cancel"
                        onClick={closeDatePicker}
                        disabled={dateSaving}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="completed-date-picker-save"
                        onClick={handleSavePickedDate}
                        disabled={dateSaving || !datePickerValue || datePickerValue === completedDate}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

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
              {expiryDisplay && (
                <div className="metadata-row expiry-row">
                  <span>Up for review by {expiryDisplay}</span>
                  <button
                    type="button"
                    className="info-icon"
                    aria-label="About the review date"
                    onClick={() => setShowExpiryNote(v => !v)}
                  >
                    <span className="material-icons-outlined">info</span>
                  </button>
                  {showExpiryNote && (
                    <p className="expiry-note">Missions are never archived without your permission. After this date, this mission will be surfaced during your weekly review.</p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {actionError && (
              <ErrorMessage message={actionError} onRetry={actionRetry} />
            )}
            <div className="mission-actions">
              {isExpired ? (
                <button
                  onClick={handleRestore}
                  className="action-button restore-button"
                >
                  Restore Mission
                </button>
              ) : (
                <button
                  onClick={() => onToggleComplete(mission.id, isCompleted, mission.xpReward)}
                  disabled={isCompletionPending}
                  className={`action-button ${isVisuallyComplete ? 'mark-incomplete' : 'mark-complete'}`}
                >
                  {isVisuallyComplete ? 'Mark as Incomplete' : 'Mark as Complete'}
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
          initialMission={displayMission}
          onCancel={handleEditCancel}
          onUpdateMission={handleMissionUpdate}
          autoOpenField={editFocusField}
        />
      )}
    </>,
    document.body
  );
};

export default MissionCardFull;
