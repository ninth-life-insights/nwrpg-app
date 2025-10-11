// src/components/quests/QuestDetailView.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import QuestMissionList from './QuestMissionList';
import AddMissionCard from '../missions/AddMissionCard';
import Badge from '../ui/Badge';
import { 
  getQuest, 
  updateQuest,
  deleteQuest,
  completeQuest,
  addMissionToQuest,
  removeMissionFromQuest,
  reorderQuestMissions
} from '../../services/questService';
import { getAllMissions, createMission } from '../../services/missionService';
import { calculateQuestProgress, QUEST_DIFFICULTY } from '../../types/Quests';
import './QuestDetailView.css';

const QuestDetailView = () => {
  const { questId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [quest, setQuest] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  
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
    navigate('/quests');
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
      // Create the mission with questId
      const missionId = await createMission(currentUser.uid, {
        ...missionData,
        questId: questId
      });
      
      // Add mission to quest
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
      await reorderQuestMissions(currentUser.uid, questId, newOrder);
      await loadQuestData();
    } catch (err) {
      console.error('Error reordering missions:', err);
      alert('Failed to reorder missions');
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

  return (
    <div className="quest-detail-view">
      {/* Quest Header */}
      <div className="quest-detail-header">
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

        <h1 className="quest-title">
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
            <Badge variant="difficulty" difficulty={quest.difficulty}>
              {quest.difficulty}
            </Badge>
          )}
          <div className="quest-progress-badge">
            {quest.completedMissions}/{quest.totalMissions} missions
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
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
        />

        <button 
          className="add-mission-to-quest-btn"
          onClick={() => setShowAddMission(true)}
        >
          + Add Mission to Quest
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="quest-actions">
        <button 
          className="complete-quest-btn"
          onClick={handleCompleteQuest}
          disabled={quest.status === 'completed'}
        >
          {quest.status === 'completed' ? 'Quest Complete ✓' : 'Complete Quest'}
        </button>
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
    </div>
  );
};

export default QuestDetailView;