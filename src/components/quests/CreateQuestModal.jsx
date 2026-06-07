// src/components/quests/CreateQuestModal.js

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useQuests } from '../../contexts/QuestsContext';
import { useRooms } from '../../contexts/RoomsContext';
import Badge from '../ui/Badge';
import { createQuest, updateQuest } from '../../services/questService';
import { createMission } from '../../services/missionService';
import { createCustomAchievement } from '../../services/achievementService';
import { QUEST_DIFFICULTY } from '../../types/Quests';
import { DIFFICULTY_LEVELS, createMissionTemplate } from '../../types/Mission';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import AchievementBadge from '../achievements/AchievementBadge';
import CreateCustomAchievementModal from '../achievements/CreateCustomAchievementModal';
import ErrorMessage from '../ui/ErrorMessage';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './CreateQuestModal.css';

const CreateQuestModal = ({ isOpen, onClose, onQuestCreated }) => {
  const { currentUser } = useAuth();
  const { refreshQuests } = useQuests();
  const { rooms } = useRooms();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: QUEST_DIFFICULTY.EASY,
  });

  const [missions, setMissions] = useState([]);
  const [currentMission, setCurrentMission] = useState('');

  // Session-sticky defaults applied to every mission added until changed.
  // Mirrors QuickAddRoutineSheet — pick once, brain-dump titles. To "edit"
  // an added row, delete it and re-add with new session values.
  const [sessionDifficulty, setSessionDifficulty] = useState(DIFFICULTY_LEVELS.EASY);
  const [sessionSkill, setSessionSkill] = useState('');
  const [sessionRoomId, setSessionRoomId] = useState('');
  
  const [pendingAchievement, setPendingAchievement] = useState(null);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  useModalBackButton(isOpen, onClose);

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

    const roomName = sessionRoomId
      ? rooms.find(r => r.id === sessionRoomId)?.name ?? null
      : null;

    setMissions(prev => [...prev, {
      title: currentMission.trim(),
      difficulty: sessionDifficulty,
      skill: sessionSkill || null,
      baseLocation: sessionRoomId || null,
      baseLocationName: roomName, // cached for row display
      tempId: Date.now()
    }]);

    setCurrentMission('');
    // Session controls intentionally not reset — they persist across adds.
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
          skill: mission.skill,
          baseLocation: mission.baseLocation,
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

      await refreshQuests();

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
      setSessionDifficulty(DIFFICULTY_LEVELS.EASY);
      setSessionSkill('');
      setSessionRoomId('');
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

  return createPortal(
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
            <div className="quest-reward-label">Quest Reward</div>
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
                + Add Custom Achievement
              </button>
            )}
          </div>

          {/* Missions Section */}
          <div className="quest-missions-section">
            <div className="missions-header">Missions ({missions.length})</div>

            {/* Mission List - Scrollable */}
            {missions.length > 0 && (
              <div className="missions-list">
                {missions.map((mission) => {
                  const hasMeta = mission.skill || mission.baseLocationName;
                  return (
                    <div key={mission.tempId} className="mission-item">
                      <Badge variant="difficulty" difficulty={mission.difficulty}>
                        {mission.difficulty}
                      </Badge>
                      <div className="mission-item-body">
                        <span className="mission-title">{mission.title}</span>
                        {hasMeta && (
                          <span className="mission-meta">
                            {mission.skill}
                            {mission.skill && mission.baseLocationName ? ' · ' : ''}
                            {mission.baseLocationName}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMission(mission.tempId)}
                        className="remove-mission-btn-small"
                        disabled={isSubmitting}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Mission — title is the primary action. Session controls below
                apply to whatever's typed next; muted until the user begins typing
                so they don't visually outweigh the empty title input. */}
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

              <div className={`mission-session-controls ${currentMission.trim() ? 'is-active' : 'is-muted'}`}>
                <label className="session-control">
                  <span className="session-control-label">Skill</span>
                  <select
                    className="session-control-select"
                    value={sessionSkill}
                    onChange={(e) => setSessionSkill(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">None</option>
                    {AVAILABLE_SKILLS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>

                <label className="session-control">
                  <span className="session-control-label">Room</span>
                  <select
                    className="session-control-select"
                    value={sessionRoomId}
                    onChange={(e) => setSessionRoomId(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="">None</option>
                    {rooms.map((room) => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                  </select>
                </label>

                <div className="session-control session-control--difficulty">
                  <span className="session-control-label">Difficulty</span>
                  <div className="mission-difficulty-selector">
                    {Object.values(DIFFICULTY_LEVELS).map((difficulty) => (
                      <button
                        key={difficulty}
                        type="button"
                        onClick={() => setSessionDifficulty(difficulty)}
                        className={`mini-difficulty-btn ${sessionDifficulty === difficulty ? 'selected' : ''}`}
                        disabled={isSubmitting}
                      >
                        <Badge variant="difficulty" difficulty={difficulty}>
                          {difficulty}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
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
    </div>,
    document.body
  );
};

export default CreateQuestModal;