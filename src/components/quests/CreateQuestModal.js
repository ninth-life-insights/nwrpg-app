// src/components/quests/CreateQuestModal.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';
import { createQuest } from '../../services/questService';
import { QUEST_DIFFICULTY, QUEST_XP_REWARDS } from '../../types/Quests';
import './CreateQuestModal.css';

const CreateQuestModal = ({ isOpen, onClose, onQuestCreated }) => {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: QUEST_DIFFICULTY.EASY,
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handleDifficultyChange = (difficulty) => {
    setFormData(prev => ({
      ...prev,
      difficulty
    }));
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
      const questData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
        status: 'active', // Start as active, skip planning mode for now
        missionIds: [],
        missionOrder: [],
        completedMissionIds: [],
        totalMissions: 0,
        completedMissions: 0,
      };
      
      const newQuest = await createQuest(currentUser.uid, questData);
      
      if (onQuestCreated) {
        onQuestCreated(newQuest);
      }
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        difficulty: QUEST_DIFFICULTY.EASY,
      });
      
      onClose();
    } catch (error) {
      console.error('Error creating quest:', error);
      setErrors({ submit: 'Failed to create quest. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const xpReward = QUEST_XP_REWARDS[formData.difficulty];

  return (
    <div className="create-quest-modal-overlay" onClick={handleBackdropClick}>
      <div className="create-quest-modal">
        <div className="modal-header">
          <h2>Create New Quest</h2>
          <button className="close-button" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="quest-form">
          {/* Title Input */}
          <div className="form-group">
            <label htmlFor="title">
              Quest Title <span className="required">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g., Spring Cleaning, Plan Family Vacation"
              maxLength={100}
              className={errors.title ? 'error' : ''}
            />
            {errors.title && (
              <span className="error-message">{errors.title}</span>
            )}
            <span className="char-count">{formData.title.length}/100</span>
          </div>

          {/* Description Input */}
          <div className="form-group">
            <label htmlFor="description">Description (Optional)</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="What's this quest about?"
              rows={3}
              maxLength={500}
              className={errors.description ? 'error' : ''}
            />
            {errors.description && (
              <span className="error-message">{errors.description}</span>
            )}
            <span className="char-count">{formData.description.length}/500</span>
          </div>

          {/* Difficulty Selection */}
          <div className="form-group">
            <label>Difficulty</label>
            <div className="difficulty-selector">
              <button
                type="button"
                className={`difficulty-option ${formData.difficulty === QUEST_DIFFICULTY.EASY ? 'selected' : ''}`}
                onClick={() => handleDifficultyChange(QUEST_DIFFICULTY.EASY)}
              >
                <Badge variant="difficulty" difficulty="easy">Easy</Badge>
                <span className="xp-label">+{QUEST_XP_REWARDS[QUEST_DIFFICULTY.EASY]} XP</span>
              </button>

              <button
                type="button"
                className={`difficulty-option ${formData.difficulty === QUEST_DIFFICULTY.MEDIUM ? 'selected' : ''}`}
                onClick={() => handleDifficultyChange(QUEST_DIFFICULTY.MEDIUM)}
              >
                <Badge variant="difficulty" difficulty="medium">Medium</Badge>
                <span className="xp-label">+{QUEST_XP_REWARDS[QUEST_DIFFICULTY.MEDIUM]} XP</span>
              </button>

              <button
                type="button"
                className={`difficulty-option ${formData.difficulty === QUEST_DIFFICULTY.HARD ? 'selected' : ''}`}
                onClick={() => handleDifficultyChange(QUEST_DIFFICULTY.HARD)}
              >
                <Badge variant="difficulty" difficulty="hard">Hard</Badge>
                <span className="xp-label">+{QUEST_XP_REWARDS[QUEST_DIFFICULTY.HARD]} XP</span>
              </button>
            </div>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="submit-error">{errors.submit}</div>
          )}

          {/* Action Buttons */}
          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateQuestModal;