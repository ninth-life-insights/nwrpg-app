// src/components/quests/CreateQuestModal.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';
import { createQuest, addMissionToQuest, updateQuest } from '../../services/questService';
import { createMission } from '../../services/missionService';
import { createCustomAchievement } from '../../services/achievementService';
import { QUEST_DIFFICULTY } from '../../types/Quests';
import { DIFFICULTY_LEVELS, createMissionTemplate } from '../../types/Mission';
import AchievementBadge from '../achievements/AchievementBadge';
import CreateCustomAchievementModal from '../achievements/CreateCustomAchievementModal';
import ErrorMessage from '../ui/ErrorMessage';
import './CreateQuestModal.css';

const CreateQuestModal = ({ isOpen, onClose, onQuestCreated }) => {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: QUEST_DIFFICULTY.EASY,
  });
  
  const [missions, setMissions] = useState([]);
  const [currentMission, setCurrentMission] = useState('');
  const [currentMissionDifficulty, setCurrentMissionDifficulty] = useState(DIFFICULTY_LEVELS.EASY);
  
  const [pendingAchievement, setPendingAchievement] = useState(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleDifficultySelect = (difficulty) => {
    setFormData(prev => ({
      ...prev,
      difficulty
    }));
  };

  const handleAddMission = () => {
    if (!currentMission.trim()) return;
    
    setMissions(prev => [...prev, {
      title: currentMission.trim(),
      difficulty: currentMissionDifficulty,
      tempId: Date.now() // Temporary ID for UI
    }]);
    
    setCurrentMission('');
    setCurrentMissionDifficulty(DIFFICULTY_LEVELS.EASY);
  };

  const handleRemoveMission = (tempId) => {
    setMissions(prev => prev.filter(m => m.tempId !== tempId));
  };

  const handleMissionKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMission();
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Quest title is required';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Quest title must be 100 characters or less';
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be 500 characters or less';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Create all missions first
      const missionIds = [];
      for (const mission of missions) {
        const missionData = createMissionTemplate({
          title: mission.title,
          difficulty: mission.difficulty,
          status: 'active'
        });
        
        const missionId = await createMission(currentUser.uid, missionData);
        missionIds.push(missionId);
      }
      
      // Create the quest with mission IDs
      const questData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
        status: 'active',
        missionIds: missionIds,
        missionOrder: missionIds,
        completedMissionIds: [],
        totalMissions: missions.length,
        completedMissions: 0,
      };
      
      const newQuest = await createQuest(currentUser.uid, questData);

      // Update each mission to link it to the quest
      const { updateMission } = await import('../../services/missionService');
      for (let i = 0; i < missionIds.length; i++) {
        await updateMission(currentUser.uid, missionIds[i], {
          questId: newQuest.id,
          questOrder: i
        });
      }

      // Create pending achievement and link to quest
      if (pendingAchievement) {
        const achDoc = await createCustomAchievement(currentUser.uid, {
          ...pendingAchievement,
          questId: newQuest.id,
        });
        await updateQuest(currentUser.uid, newQuest.id, { achievement: achDoc.id });
      }

      if (onQuestCreated) {
        onQuestCreated({
          ...newQuest,
          missionIds,
          missionOrder: missionIds
        });
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        difficulty: QUEST_DIFFICULTY.EASY,
      });
      setMissions([]);
      setCurrentMission('');
      setCurrentMissionDifficulty(DIFFICULTY_LEVELS.EASY);
      setPendingAchievement(null);
      
      onClose();
    } catch (error) {
      console.error('Error creating quest:', error);
      setErrors({ submit: "Your quest wasn't saved. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="add-quest-overlay" onClick={handleBackdropClick}>
      <div className="add-quest-card" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          
          {/* Title Input */}
          <div className="add-quest-title-section">
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className={`add-quest-title-input ${errors.title ? 'error' : ''}`}
              placeholder="Quest Name *"
              disabled={isSubmitting}
              maxLength={100}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          {/* Description */}
          <div className="add-quest-description">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="add-quest-description-input"
              placeholder="Description (optional)"
              rows="2"
              disabled={isSubmitting}
              maxLength={500}
            />
          </div>

          {/* Difficulty Badge Selector */}
          <div className="add-quest-badges">
            <div className="difficulty-selector">
              {Object.values(QUEST_DIFFICULTY).map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => handleDifficultySelect(difficulty)}
                  className={`difficulty-badge-button ${formData.difficulty === difficulty ? 'selected' : 'unselected'}`}
                  disabled={isSubmitting}
                >
                  <Badge variant="difficulty" difficulty={difficulty}>{difficulty}</Badge>
                </button>
              ))}
            </div>
          </div>

          {/* Quest Reward */}
          <div className="quest-reward-section">
            <div className="quest-reward-label">Quest Reward <span className="quest-reward-optional">(optional)</span></div>
            {pendingAchievement ? (
              <div className="quest-reward-preview">
                <AchievementBadge color={pendingAchievement.badgeColor} badgeSymbol={pendingAchievement.badgeSymbol} size="sm" />
                <span className="quest-reward-preview__name">{pendingAchievement.name}</span>
                <button
                  type="button"
                  className="quest-reward-remove"
                  onClick={() => setPendingAchievement(null)}
                  disabled={isSubmitting}
                >×</button>
              </div>
            ) : (
              <button
                type="button"
                className="quest-reward-add-btn"
                onClick={() => setShowAchievementModal(true)}
                disabled={isSubmitting}
              >
                + Add Achievement Reward
              </button>
            )}
          </div>

          {/* Missions Section */}
          <div className="quest-missions-section">
            <div className="missions-header">Missions ({missions.length})</div>
            
            {/* Mission List - Scrollable */}
            {missions.length > 0 && (
              <div className="missions-list">
                {missions.map((mission) => (
                  <div key={mission.tempId} className="mission-item">
                    <Badge variant="difficulty" difficulty={mission.difficulty}>
                      {mission.difficulty}
                    </Badge>
                    <span className="mission-title">{mission.title}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMission(mission.tempId)}
                      className="remove-mission-btn-small"
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Mission Input */}
            <div className="add-mission-input-section">
              <input
                type="text"
                value={currentMission}
                onChange={(e) => setCurrentMission(e.target.value)}
                onKeyPress={handleMissionKeyPress}
                className="mission-input"
                placeholder="Add a mission..."
                disabled={isSubmitting}
              />
              <div className="mission-difficulty-selector">
                {Object.values(DIFFICULTY_LEVELS).map((difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    onClick={() => setCurrentMissionDifficulty(difficulty)}
                    className={`mini-difficulty-btn ${currentMissionDifficulty === difficulty ? 'selected' : ''}`}
                    disabled={isSubmitting}
                  >
                    <Badge variant="difficulty" difficulty={difficulty}>
                      {difficulty}
                    </Badge>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddMission}
                className="add-mission-btn-small"
                disabled={isSubmitting || !currentMission.trim()}
              >
                Add
              </button>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && <ErrorMessage message={errors.submit} />}

          {/* Action Buttons */}
          <div className="add-quest-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-btn"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Quest'}
            </button>
          </div>
        </form>
      </div>
      {showAchievementModal && (
        <CreateCustomAchievementModal
          pendingMode
          onClose={() => setShowAchievementModal(false)}
          onCreated={(data) => { setPendingAchievement(data); setShowAchievementModal(false); }}
        />
      )}
    </div>
  );
};

export default CreateQuestModal;