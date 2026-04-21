// src/components/quests/QuestDetailView.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import QuestMissionList from './QuestMissionList';
import AddMissionCard from '../missions/AddMissionCard';
import Badge from '../ui/Badge';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getQuest,
  updateQuest,
  deleteQuest,
  completeQuest,
  archiveQuest,
  updateQuestStatus,
  addMissionToQuest,
  removeMissionFromQuest,
  reorderQuestMissions
} from '../../services/questService';
import { createCustomAchievement, unawardPendingAchievement } from '../../services/achievementService';
import { getAllMissions, updateMission } from '../../services/missionService';
import { MISSION_STATUS } from '../../types/Mission';
import { calculateQuestProgress, QUEST_DIFFICULTY, QUEST_STATUS } from '../../types/Quests';
import { formatForUserLong } from '../../utils/dateHelpers';
import AchievementBadge from '../achievements/AchievementBadge';
import AchievementToast from '../achievements/AchievementToast';
import CreateCustomAchievementModal from '../achievements/CreateCustomAchievementModal';
import ErrorMessage from '../ui/ErrorMessage';
import './QuestDetailView.css';

const QuestDetailView = () => {
  const { questId } = useParams();
  const { currentUser } = useAuth();
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const { notifyMissionCompletion } = useNotifications();
  
  // Inline editing state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDifficulty, setEditedDifficulty] = useState(null);

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

      const questData = await getQuest(currentUser.uid, questId);
      const allMissions = await getAllMissions(currentUser.uid);
      
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
    navigate('/quest-bank');
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
    if (quest.completedMissions < quest.totalMissions) {
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
      await loadQuestData();
    } catch (err) {
      console.error('Error completing quest:', err);
      setShowCompleteConfirm(false);
      setActionError("That quest didn't complete. Try again.");
    }
  };

  const handleDeleteQuest = () => {
    setShowDeleteConfirm(true);
  };

  const deleteQuestConfirmed = async () => {
    setActionError(null);
    try {
      await deleteQuest(currentUser.uid, questId);
      setShowDeleteConfirm(false);
      navigate('/quests');
    } catch (err) {
      console.error('Error deleting quest:', err);
      setShowDeleteConfirm(false);
      setActionError("That quest didn't delete. Try again.");
    }
  };

  const handleArchiveQuest = () => {
    setShowArchiveConfirm(true);
  };

  const archiveQuestConfirmed = async () => {
    setActionError(null);
    try {
      await archiveQuest(currentUser.uid, questId);
      setShowArchiveConfirm(false);
      navigate('/quest-bank');
    } catch (err) {
      console.error('Error archiving quest:', err);
      setShowArchiveConfirm(false);
      setActionError("That quest didn't archive. Try again.");
    }
  };

  const handleAddMission = async (missionData) => {
    setActionError(null);
    try {
      const { id: missionId } = missionData;
      await updateMission(currentUser.uid, missionId, { questId });
      await addMissionToQuest(currentUser.uid, questId, missionId);
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
      if (quest.achievement) {
        await unawardPendingAchievement(currentUser.uid, quest.achievement);
      }
      await updateQuestStatus(currentUser.uid, questId, QUEST_STATUS.ACTIVE);
      await loadQuestData();
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

  const progress = calculateQuestProgress(quest);

  const isCompleted = quest.status === 'completed';

  return (
    <div className={`quest-detail-view ${isCompleted ? 'completed' : ''}`}>
      {/* Quest Header */}
      <div className={`quest-detail-header ${isCompleted ? 'completed' : ''}`}>
        <div className="header-top">
          <button className="back-button" onClick={handleBack}>
            <span className="material-icons">arrow_back</span>
            Back
          </button>
          <button 
            className={`edit-button ${isEditMode ? 'active' : ''}`}
            onClick={handleToggleEditMode}
          >
            {isEditMode ? 'Done' : 'Edit'}
          </button>
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
                    {quest.completedMissions}/{quest.totalMissions} missions
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
      {(questAchievement || isEditMode) && (
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
              + Add Achievement Reward
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

        {!isCompleted && (
          <button
            className="add-mission-to-quest-btn"
            onClick={() => setShowAddMission(true)}
          >
            + Add Mission to Quest
          </button>
        )}
      </div>

      {actionError && <ErrorMessage message={actionError} className="quest-action-error" />}

      {/* Bottom Actions */}
      <div className={`quest-actions ${isCompleted ? 'completed' : ''}`}>
        <div className="quest-actions-primary">
          {isCompleted ? (
            <button
              className="reopen-quest-btn"
              onClick={handleUncompleteQuest}
            >
              Reopen Quest
            </button>
          ) : (
            <button
              className="complete-quest-btn"
              onClick={handleCompleteQuest}
            >
              Complete Quest
            </button>
          )}
        </div>
        <div className="quest-actions-secondary">
          {quest.status !== QUEST_STATUS.ARCHIVED && (
            <button
              className="archive-quest-btn"
              onClick={handleArchiveQuest}
            >
              Archive Quest
            </button>
          )}
          <button
            className="delete-quest-btn"
            onClick={handleDeleteQuest}
          >
            Delete Quest
          </button>
        </div>
      </div>

      {/* Confirmation Modals */}
      {showCompleteConfirm && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <h3>Complete Quest?</h3>
            <p>You still have uncompleted missions. Are you sure you want to complete this quest?</p>
            <div className="modal-actions">
              <button onClick={() => setShowCompleteConfirm(false)}>Cancel</button>
              <button onClick={completeQuestConfirmed} className="confirm-btn">Complete</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <h3>Delete Quest?</h3>
            <p>This will remove the quest but keep all missions. Are you sure?</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button onClick={deleteQuestConfirmed} className="confirm-btn delete">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showArchiveConfirm && (
        <div className="confirmation-modal">
          <div className="modal-content">
            <h3>Archive Quest?</h3>
            <p>This quest will move to your archive. You can restore it any time.</p>
            <div className="modal-actions">
              <button onClick={() => setShowArchiveConfirm(false)}>Cancel</button>
              <button onClick={archiveQuestConfirmed} className="confirm-btn">Archive</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Mission Modal */}
      {showAddMission && (
        <AddMissionCard
          onAddMission={handleAddMission}
          onCancel={() => setShowAddMission(false)}
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