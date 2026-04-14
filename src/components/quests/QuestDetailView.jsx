// src/components/quests/QuestDetailView.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuestMissionList from './QuestMissionList';
import AddMissionCard from '../missions/AddMissionCard';
import Badge from '../ui/Badge';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  getQuest,
  updateQuest,
  deleteQuest,
  completeQuest,
  updateQuestStatus,
  addMissionToQuest,
  removeMissionFromQuest,
  reorderQuestMissions
} from '../../services/questService';
import { getAllMissions, updateMission } from '../../services/missionService';
import { calculateQuestProgress, QUEST_DIFFICULTY, QUEST_STATUS } from '../../types/Quests';
import { formatForUserLong } from '../../utils/dateHelpers';
import AchievementToast from '../achievements/AchievementToast';
import './QuestDetailView.css';

const QuestDetailView = () => {
  const { questId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [quest, setQuest] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAchievements, setNewAchievements] = useState([]);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
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
      
      // Filter missions that belong to this quest
      const questMissions = allMissions.filter(m => m.questId === questId);
      
      setQuest(questData);
      setMissions(questMissions);
    } catch (err) {
      console.error('Error loading quest:', err);
      setError('Failed to load quest');
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
        alert('Failed to update quest');
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
    try {
      await completeQuest(currentUser.uid, questId);
      setShowCompleteConfirm(false);
      await loadQuestData();
    } catch (err) {
      console.error('Error completing quest:', err);
      alert('Failed to complete quest');
    }
  };

  const handleDeleteQuest = () => {
    setShowDeleteConfirm(true);
  };

  const deleteQuestConfirmed = async () => {
    try {
      await deleteQuest(currentUser.uid, questId);
      setShowDeleteConfirm(false);
      navigate('/quests');
    } catch (err) {
      console.error('Error deleting quest:', err);
      alert('Failed to delete quest');
    }
  };

  const handleAddMission = async (missionData) => {
    try {
      const { id: missionId } = missionData;
      await updateMission(currentUser.uid, missionId, { questId });
      await addMissionToQuest(currentUser.uid, questId, missionId);
      await loadQuestData();
      setShowAddMission(false);
    } catch (err) {
      console.error('Error adding mission:', err);
      alert('Failed to add mission');
    }
  };

  const handleRemoveMission = async (missionId) => {
    try {
      await removeMissionFromQuest(currentUser.uid, questId, missionId);
      await loadQuestData();
    } catch (err) {
      console.error('Error removing mission:', err);
      alert('Failed to remove mission');
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
      // Only reload on error to revert
      await loadQuestData();
      alert('Failed to reorder missions');
    }
  };

  const handleUncompleteQuest = async () => {
    try {
      await updateQuestStatus(currentUser.uid, questId, QUEST_STATUS.ACTIVE);
      await loadQuestData();
    } catch (err) {
      console.error('Error reopening quest:', err);
      alert('Failed to reopen quest');
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
        <div className="error-state">{error || 'Quest not found'}</div>
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

      {/* Bottom Actions */}
      <div className={`quest-actions ${isCompleted ? 'completed' : ''}`}>
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
        <button
          className="delete-quest-btn"
          onClick={handleDeleteQuest}
        >
          Delete Quest
        </button>
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
    </div>
  );
};

export default QuestDetailView;