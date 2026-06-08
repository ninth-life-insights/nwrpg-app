// src/components/quests/QuestDetailView.js

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuests } from '../../contexts/QuestsContext';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import QuestMissionList from './QuestMissionList';
import AddMissionCard from '../missions/AddMissionCard';
import Badge from '../ui/Badge';
import StickyFooter from '../ui/StickyFooter';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getQuest,
  updateQuest,
  deleteQuest,
  completeQuest,
  archiveQuest,
  restoreQuest,
  reopenQuest,
  removeMissionFromQuest,
  reorderQuestMissions
} from '../../services/questService';
import { createCustomAchievement } from '../../services/achievementService';
import { getAllMissions } from '../../services/missionService';
import { MISSION_STATUS } from '../../types/Mission';
import { calculateQuestProgress, QUEST_DIFFICULTY, QUEST_STATUS } from '../../types/Quests';
import { formatForUserLong } from '../../utils/dateHelpers';
import AchievementBadge from '../achievements/AchievementBadge';
import AchievementToast from '../achievements/AchievementToast';
import CreateCustomAchievementModal from '../achievements/CreateCustomAchievementModal';
import ErrorMessage from '../ui/ErrorMessage';
import './QuestDetailView.css';

const QuestDetailView = ({ questId: questIdProp, onClose }) => {
  const { questId: questIdParam } = useParams();
  const questId = questIdProp ?? questIdParam;
  const isModal = !!onClose;
  const { currentUser } = useAuth();
  const { refreshQuests } = useQuests();
  const navigate = useNavigate();

  const [quest, setQuest] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questAchievement, setQuestAchievement] = useState(null);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef(null);
  const { notifyMissionCompletion, notifyQuestArchived, notifyQuestDeleted } = useNotifications();

  useEffect(() => {
    if (!showActionsMenu) return;
    const handleClickOutside = (e) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target)) {
        setShowActionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsMenu]);
  
  // Inline editing state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDifficulty, setEditedDifficulty] = useState(null);

  const descriptionInputRef = useRef(null);

  const handleAddDescription = () => {
    setIsEditMode(true);
    setTimeout(() => {
      descriptionInputRef.current?.focus();
    }, 0);
  };

  useEffect(() => {
    if (currentUser && questId) {
      loadQuestData();
    }
  }, [currentUser, questId]);

  useEffect(() => {
    if (quest) {
      setEditedTitle(quest.title);
      setEditedDescription(quest.description || '');
      setEditedDifficulty(quest.difficulty);
    }
  }, [quest]);

  const loadQuestData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [questData, allMissions] = await Promise.all([
        getQuest(currentUser.uid, questId),
        getAllMissions(currentUser.uid),
      ]);

      // Filter missions that belong to this quest, excluding archived (expired) ones
      const questMissions = allMissions.filter(
        m => m.questId === questId && m.status !== MISSION_STATUS.EXPIRED
      );

      setQuest(questData);
      setMissions(questMissions);

      // Load linked achievement if present
      if (questData.achievement) {
        const achSnap = await getDoc(doc(db, 'users', currentUser.uid, 'achievements', questData.achievement));
        setQuestAchievement(achSnap.exists() ? { id: achSnap.id, ...achSnap.data() } : null);
      } else {
        setQuestAchievement(null);
      }
    } catch (err) {
      console.error('Error loading quest:', err);
      setError("Your quest didn't load.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (isModal) onClose();
    else navigate('/quest-bank');
  };

  const handleToggleEditMode = async () => {
    if (isEditMode) {
      // Save changes
      setActionError(null);
      try {
        const updates = {
          title: editedTitle.trim(),
          description: editedDescription.trim(),
          difficulty: editedDifficulty
        };

        await updateQuest(currentUser.uid, questId, updates);
        await loadQuestData();
        setIsEditMode(false);
      } catch (err) {
        console.error('Error updating quest:', err);
        setActionError("Your quest didn't save. Try again.");
      }
    } else {
      // Enter edit mode
      setIsEditMode(true);
    }
  };

  const handleCompleteQuest = async () => {
    if (quest.completedMissions < missions.length) {
      setShowCompleteConfirm(true);
    } else {
      await completeQuestConfirmed();
    }
  };

  const completeQuestConfirmed = async () => {
    setActionError(null);
    try {
      await completeQuest(currentUser.uid, questId);
      setShowCompleteConfirm(false);
      await Promise.all([loadQuestData(), refreshQuests()]);
    } catch (err) {
      console.error('Error completing quest:', err);
      setShowCompleteConfirm(false);
      setActionError("That quest didn't complete. Try again.");
    }
  };

  const handleArchiveQuest = async () => {
    setActionError(null);
    setShowActionsMenu(false);
    const questTitle = quest.title;
    try {
      await archiveQuest(currentUser.uid, questId);
      await refreshQuests();
      notifyQuestArchived({
        questTitle,
        onUndo: async () => {
          await restoreQuest(currentUser.uid, questId);
          await refreshQuests();
        },
      });
      if (isModal) onClose();
      else navigate('/quest-bank');
    } catch (err) {
      console.error('Error archiving quest:', err);
      setActionError("That quest didn't archive. Try again.");
    }
  };

  const handleDeleteQuest = async () => {
    setActionError(null);
    setShowActionsMenu(false);
    const questTitle = quest.title;
    try {
      await deleteQuest(currentUser.uid, questId);
      await refreshQuests();
      notifyQuestDeleted({
        questTitle,
        onUndo: async () => {
          await restoreQuest(currentUser.uid, questId);
          await refreshQuests();
        },
      });
      if (isModal) onClose();
      else navigate('/quest-bank');
    } catch (err) {
      console.error('Error deleting quest:', err);
      setActionError("That quest didn't delete. Try again.");
    }
  };

  const handleAddMission = async () => {
    setActionError(null);
    try {
      await loadQuestData();
      setShowAddMission(false);
    } catch (err) {
      console.error('Error adding mission:', err);
      setActionError("That mission didn't add. Try again.");
    }
  };

  const handleRemoveMission = async (missionId) => {
    setActionError(null);
    try {
      await removeMissionFromQuest(currentUser.uid, questId, missionId);
      await loadQuestData();
    } catch (err) {
      console.error('Error removing mission:', err);
      setActionError("That mission didn't remove. Try again.");
    }
  };

  const handleReorderMissions = async (newOrder) => {
    try {
      // Optimistic update - update local state immediately
      setQuest(prev => ({
        ...prev,
        missionOrder: newOrder
      }));

      // Save to Firestore in background
      await reorderQuestMissions(currentUser.uid, questId, newOrder);

      // Don't reload - the local state is already updated
    } catch (err) {
      console.error('Error reordering missions:', err);
      // Revert optimistic update
      await loadQuestData();
      setActionError("That reorder didn't save. Try again.");
    }
  };

  const handleAddReward = async (data) => {
    setActionError(null);
    try {
      const achDoc = await createCustomAchievement(currentUser.uid, { ...data, questId });
      await updateQuest(currentUser.uid, questId, { achievement: achDoc.id });
      setShowRewardModal(false);
      await loadQuestData();
    } catch (err) {
      console.error('Error adding reward:', err);
      setActionError("That reward didn't save. Try again.");
    }
  };

  const handleRemoveReward = async () => {
    setActionError(null);
    try {
      const achRef = doc(db, 'users', currentUser.uid, 'achievements', questAchievement.id);
      await updateDoc(achRef, { status: 'deleted', deletedAt: serverTimestamp() });
      await updateQuest(currentUser.uid, questId, { achievement: null });
      await loadQuestData();
    } catch (err) {
      console.error('Error removing reward:', err);
      setActionError("That reward didn't remove. Try again.");
    }
  };

  const handleUncompleteQuest = async () => {
    setActionError(null);
    try {
      await reopenQuest(currentUser.uid, questId);
      await Promise.all([loadQuestData(), refreshQuests()]);
    } catch (err) {
      console.error('Error reopening quest:', err);
      setActionError("That quest didn't reopen. Try again.");
    }
  };

  const handleMissionUpdate = async () => {
    await loadQuestData();
  };

  if (loading) {
    return (
      <div className="quest-detail-view">
        <div className="loading-state">Loading quest...</div>
      </div>
    );
  }

  if (error || !quest) {
    return (
      <div className="quest-detail-view">
        <ErrorMessage
          message={error || 'Quest not found.'}
          onRetry={error ? loadQuestData : undefined}
          className="quest-load-error"
        />
      </div>
    );
  }

  const progress = calculateQuestProgress(quest, missions.length);

  const isCompleted = quest.status === 'completed';

  return (
    <div className={`quest-detail-view ${isCompleted ? 'completed' : ''}`}>
      {/* Quest Header */}
      <div className={`quest-detail-header ${isCompleted ? 'completed' : ''}`}>
        <div className="header-top">
          <button
            className="back-button"
            onClick={handleBack}
            aria-label={isModal ? 'Close' : 'Back'}
          >
            <span className="material-icons">{isModal ? 'close' : 'arrow_back'}</span>
          </button>
          <div className="header-top-right">
            <button
              className={`edit-button ${isEditMode ? 'active' : ''}`}
              onClick={handleToggleEditMode}
            >
              {isEditMode ? 'Done' : 'Edit'}
            </button>
            {(quest.status !== QUEST_STATUS.ARCHIVED || !isModal) && (
              <div className="quest-actions-menu" ref={actionsMenuRef}>
                <button
                  type="button"
                  className="quest-actions-menu__trigger"
                  onClick={() => setShowActionsMenu((open) => !open)}
                  aria-label="More actions"
                  aria-haspopup="menu"
                  aria-expanded={showActionsMenu}
                >
                  <span className="material-icons">more_vert</span>
                </button>
                {showActionsMenu && (
                  <div className="quest-actions-menu__dropdown" role="menu">
                    {quest.status !== QUEST_STATUS.ARCHIVED && (
                      <button
                        type="button"
                        className="quest-actions-menu__item"
                        onClick={handleArchiveQuest}
                        role="menuitem"
                      >
                        <span className="material-icons">archive</span>
                        Archive
                      </button>
                    )}
                    {!isModal && (
                      <button
                        type="button"
                        className="quest-actions-menu__item quest-actions-menu__item--danger"
                        onClick={handleDeleteQuest}
                        role="menuitem"
                      >
                        <span className="material-icons">delete</span>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <h1 className={`quest-title ${isCompleted ? 'completed' : ''}`}>
          {isEditMode ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="quest-title-input"
              placeholder="Quest title"
            />
          ) : (
            quest.title
          )}
        </h1>
        
        {(isEditMode || quest.description) && (
          <div className="quest-description-section">
            {isEditMode ? (
              <textarea
                ref={descriptionInputRef}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                className="quest-description-input"
                placeholder="Description (optional)"
                rows="2"
              />
            ) : (
              <p className="quest-description">{quest.description}</p>
            )}
          </div>
        )}
        {!isEditMode && !quest.description && !isCompleted && (
          <button
            type="button"
            className="quest-detail-header__ghost-prompt"
            onClick={handleAddDescription}
          >
            + Add description
          </button>
        )}

        <div className="quest-meta">
          {isEditMode ? (
            <div className="difficulty-selector-inline">
              {Object.values(QUEST_DIFFICULTY).map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => setEditedDifficulty(difficulty)}
                  className={`difficulty-btn-inline ${editedDifficulty === difficulty ? 'selected' : ''}`}
                >
                  <Badge variant="difficulty" difficulty={difficulty}>
                    {difficulty}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <>
              <Badge variant="difficulty" difficulty={quest.difficulty}>
                {quest.difficulty}
              </Badge>
              {isCompleted ? (
                <div className="quest-complete-badge">
                  <span className="material-icons" style={{ fontSize: '16px' }}>check_circle</span>
                  Quest Complete
                </div>
              ) : (
                <>
                  <div className="quest-progress-badge">
                    {quest.completedMissions}/{missions.length} missions
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              )}
            </>
          )}
          {isCompleted && quest.completedAt && (
            <div className="quest-completed-at">
              Completed {formatForUserLong(quest.completedAt)}
            </div>
          )}
        </div>
      </div>

      {/* Quest Reward */}
      {(questAchievement || !isCompleted) && (
        <div className="quest-reward-display">
          {questAchievement ? (
            <>
              <Link to="/achievements" className="quest-reward-badge-link">
                <AchievementBadge
                  color={questAchievement.badgeColor}
                  badgeSymbol={questAchievement.badgeSymbol}
                  size="sm"
                  locked={questAchievement.isPending}
                />
              </Link>
              <div className="quest-reward-display__text">
                <p className="quest-reward-name">{questAchievement.name}</p>
                <p className="quest-reward-status">
                  {questAchievement.isPending ? 'Complete quest to unlock' : 'Unlocked!'}
                </p>
              </div>
              {isEditMode && (
                <button className="quest-reward-remove-btn" onClick={handleRemoveReward}>
                  Remove
                </button>
              )}
            </>
          ) : (
            <button
              className="quest-reward-add-btn"
              onClick={() => setShowRewardModal(true)}
            >
              + Add Custom Achievement
            </button>
          )}
        </div>
      )}

      {/* Mission List */}
      <div className="quest-missions-section">
        <QuestMissionList
          missions={missions}
          questMissionOrder={quest.missionOrder}
          isEditMode={isEditMode}
          onMissionUpdate={handleMissionUpdate}
          onRemoveMission={handleRemoveMission}
          onReorderMissions={handleReorderMissions}
          onAchievementsUnlocked={(achievements) => setNewAchievements(achievements)}
        />
      </div>

      {actionError && <ErrorMessage message={actionError} className="quest-action-error" />}

      <StickyFooter bgColor="var(--color-quest-bg)" className="quest-detail-footer">
        {!isCompleted && (
          <button
            type="button"
            className="quest-add-mission-btn"
            onClick={() => setShowAddMission(true)}
          >
            + Add Mission to Quest
          </button>
        )}
        {isCompleted ? (
          <button
            type="button"
            className="reopen-quest-btn"
            onClick={handleUncompleteQuest}
          >
            Reopen Quest
          </button>
        ) : (
          <button
            type="button"
            className="complete-quest-btn"
            onClick={handleCompleteQuest}
          >
            Complete Quest
          </button>
        )}
      </StickyFooter>

      {showCompleteConfirm && createPortal(
        <div
          className="confirmation-modal"
          onClick={() => setShowCompleteConfirm(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Complete Quest?</h3>
            <p>You still have uncompleted missions. Are you sure you want to complete this quest?</p>
            <div className="modal-actions">
              <button onClick={() => setShowCompleteConfirm(false)}>Cancel</button>
              <button onClick={completeQuestConfirmed} className="confirm-btn">Complete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Mission Modal */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleAddMission}
          onCancel={() => setShowAddMission(false)}
          defaultQuestId={questId}
        />
      )}

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />

      {showRewardModal && (
        <CreateCustomAchievementModal
          pendingMode
          onClose={() => setShowRewardModal(false)}
          onCreated={handleAddReward}
        />
      )}
    </div>
  );
};

export default QuestDetailView;