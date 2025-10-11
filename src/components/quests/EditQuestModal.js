// src/components/quests/EditQuestModal.js

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../ui/Badge';
import { updateQuest } from '../../services/questService';
import { QUEST_DIFFICULTY } from '../../types/Quests';
import './CreateQuestModal.css'; // Reuse the same styles

const EditQuestModal = ({ isOpen, onClose, quest, onQuestUpdated }) => {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState({
    title: quest.title || '',
    description: quest.description || '',
    difficulty: quest.difficulty || QUEST_DIFFICULTY.EASY,
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
      const updates = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        difficulty: formData.difficulty,
      };
      
      await updateQuest(currentUser.uid, quest.id, updates);
      
      if (onQuestUpdated) {
        onQuestUpdated({
          ...quest,
          ...updates
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating quest:', error);
      setErrors({ submit: 'Failed to update quest. Please try again.' });
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

          {/* Submit Error */}
          {errors.submit && (
            <div className="error-text" style={{ textAlign: 'center', marginTop: '15px' }}>
              {errors.submit}
            </div>
          )}

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
              {isSubmitting ? 'Updating...' : 'Update Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditQuestModal;