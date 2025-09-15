// src/components/missions/AddMissionCard.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createMission } from '../../services/missionService';
import DifficultyBadge from './sub-components/DifficultyBadge';
import SkillBadge from './sub-components/SkillBadge';
import CompletionTypeSelector from './sub-components/CompletionTypeSelector';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import {
  createMissionTemplate,
  validateMission,
  DIFFICULTY_LEVELS,
  COMPLETION_TYPES,
  DUE_TYPES,
  MISSION_STATUS
} from '../../types/Mission';
import './AddMissionCard.css';

const AddMissionCard = ({ onAddMission, onCancel }) => {
  const { currentUser } = useAuth();
  
  // Get default expiry date (30 days from now)
  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    difficulty: DIFFICULTY_LEVELS.EASY,
    completionType: COMPLETION_TYPES.SIMPLE,
    dueType: DUE_TYPES.UNIQUE,
    dueDate: '',
    skill: '',
    expiryDate: getDefaultExpiryDate(),
    hasExpiryDate: true,
    // Timer fields
    timerDurationMinutes: '',
    // Count fields  
    targetCount: '',
    // Other fields
    priority: 'normal',
    pinned: false,
    isDailyMission: false
  });

  const [errors, setErrors] = useState({});
  const [showDueDateField, setShowDueDateField] = useState(false);
  const [showSkillField, setShowSkillField] = useState(false);
  const [showExpiryField, setShowExpiryField] = useState(false);

  const [skillSearch, setSkillSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDifficultySelect = (difficulty) => {
    setFormData(prev => ({
      ...prev,
      difficulty: difficulty
    }));
  };

  const handleCompletionTypeSelect = (completionType) => {
    setFormData(prev => ({
      ...prev,
      completionType: completionType,
      // Reset completion-specific fields when changing types
      timerDurationMinutes: completionType === COMPLETION_TYPES.TIMER ? prev.timerDurationMinutes : null,
      targetCount: completionType === COMPLETION_TYPES.COUNT ? prev.targetCount : null,
    }));
  };

  const handleSkillSelect = (skill) => {
    setFormData(prev => ({
      ...prev,
      skill: skill
    }));
    setSkillSearch('');
  };

  const handleRemoveExpiryDate = () => {
    setFormData(prev => ({
      ...prev,
      expiryDate: '',
      hasExpiryDate: false
    }));
  };

  const validateForm = () => {
    // Create a mission object using our schema
    const missionData = createMissionTemplate({
      title: formData.title.trim(),
      description: formData.description.trim(),
      difficulty: formData.difficulty,
      completionType: formData.completionType,
      dueType: formData.dueType,
      skill: formData.skill.trim() || null,
      timerDurationMinutes: formData.timerDurationMinutes ? parseInt(formData.timerDurationMinutes) : null,
      targetCount: formData.targetCount ? parseInt(formData.targetCount) : null,
      priority: formData.priority,
      pinned: formData.pinned,
      isDailyMission: formData.isDailyMission
    });

    const validation = validateMission(missionData);
    
    if (!validation.isValid) {
      const newErrors = {};
      validation.errors.forEach(error => {
        if (error.includes('title')) newErrors.title = error;
        else if (error.includes('timer')) newErrors.timerDurationMinutes = error;
        else if (error.includes('count')) newErrors.targetCount = error;
        else newErrors.general = error;
      });
      setErrors(newErrors);
    }
    
    return validation.isValid;
  };

  
const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!validateForm() || !currentUser) {
    return;
  }

  setIsSubmitting(true);

  try {
    const missionData = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      difficulty: formData.difficulty,
      // xpReward: getXPReward(formData.difficulty),
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      skill: formData.skill.trim() || null,
      expiryDate: formData.hasExpiryDate ? new Date(formData.expiryDate) : null,
      category: 'personal', // You can expand this later
      isDailyMission: false
    };

    const missionId = await createMission(currentUser.uid, missionData);
    
    // Validate that we got a valid mission ID back
    if (!missionId) {
      throw new Error('Failed to create mission: No ID returned');
    }
    
    // Call the parent component's callback with the new mission ID
    onAddMission({
      ...missionData,
      id: missionId,
      status: 'active',
      completed: false,
      createdAt: new Date()
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      difficulty: 'easy',
      dueDate: '',
      skill: '',
      expiryDate: getDefaultExpiryDate(),
      hasExpiryDate: true
    });

  } catch (error) {
    console.error('Error creating mission:', error);
    setErrors({ submit: 'Failed to create mission. Please try again.' });
  } finally {
    setIsSubmitting(false);
  }
};

  // Filter skills based on search
  const filteredSkills = AVAILABLE_SKILLS.filter(skill =>
    skill.toLowerCase().includes(skillSearch.toLowerCase())
  );

  return (
    <div className="add-mission-overlay" onClick={onCancel}>
      <div className="add-mission-card" onClick={(e) => e.stopPropagation()}>
        
        <form onSubmit={handleSubmit}>
          
          {/* Title Input */}
          <div className="add-mission-title-section">
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={`add-mission-title-input ${errors.title ? 'error' : ''}`}
              placeholder="Mission Name *"
              disabled={isSubmitting}
            />
            {errors.title && <span className="error-text">{errors.title}</span>}
          </div>

          {/* Description */}
          <div className="add-mission-description">
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="add-mission-description-input"
              placeholder="Description (optional)"
              rows="2"
              disabled={isSubmitting}
            />
          </div>

          {/* Difficulty Badge Selector */}
          <div className="add-mission-badges">
            <div className="difficulty-selector">
              {Object.values(DIFFICULTY_LEVELS).map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => handleDifficultySelect(difficulty)}
                  className={`difficulty-badge-button ${formData.difficulty === difficulty ? 'selected' : 'unselected'}`}
                  disabled={isSubmitting}
                >
                  <DifficultyBadge difficulty={difficulty} />
                </button>
              ))}
            </div>
          </div>

          {/* Completion Type Selector */}
          <CompletionTypeSelector
            completionType={formData.completionType}
            onCompletionTypeChange={handleCompletionTypeSelect}
            timerDurationMinutes={formData.timerDurationMinutes ? parseInt(formData.timerDurationMinutes) : null}
            onTimerDurationChange={(minutes) => setFormData(prev => ({ ...prev, timerDurationMinutes: minutes }))}
            targetCount={formData.targetCount ? parseInt(formData.targetCount) : null}
            onTargetCountChange={(count) => setFormData(prev => ({ ...prev, targetCount: count }))}
            disabled={isSubmitting}
            errors={errors}
          />

          {/* Optional Field Ghost Badges */}
          <div className="ghost-badges">
            {!showDueDateField && !formData.dueDate && (
              <button
                type="button"
                onClick={() => setShowDueDateField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Due date
              </button>
            )}
            
            {!showSkillField && !formData.skill && (
              <button
                type="button"
                onClick={() => setShowSkillField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Skill
              </button>
            )}
            
            {!showExpiryField && formData.hasExpiryDate && (
              <button
                type="button"
                onClick={() => setShowExpiryField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                Edit expiration date
              </button>
            )}
            
            {!formData.hasExpiryDate && (
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, expiryDate: getDefaultExpiryDate(), hasExpiryDate: true }));
                  setShowExpiryField(true);
                }}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Expiration date
              </button>
            )}

          </div>

          {/* Due Date Field */}
          {(showDueDateField || formData.dueDate) && (
            <div className="optional-field-inline">
              <label>Due Date</label>
              <div className="field-with-remove">
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className="optional-input"
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, dueDate: '' }));
                    setShowDueDateField(false);
                  }}
                  className="remove-field-btn"
                  disabled={isSubmitting}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Skill Field */}
          {(showSkillField || formData.skill) && (
            <div className="skill-field-section">
              <label>Skill</label>
              {formData.skill ? (
                <div className="selected-skill-inline">
                  <SkillBadge skill={formData.skill} />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, skill: '' }));
                      setShowSkillField(false);
                      setSkillSearch('');
                    }}
                    className="remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <>
                  <div className="field-with-remove">
                    <input
                      type="text"
                      value={skillSearch}
                      onChange={(e) => setSkillSearch(e.target.value)}
                      className="optional-input"
                      placeholder="Search skills..."
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowSkillField(false);
                        setSkillSearch('');
                      }}
                      className="remove-field-btn"
                      disabled={isSubmitting}
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="skills-grid-inline">
                    {filteredSkills.map((skill) => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleSkillSelect(skill)}
                        className="skill-option-inline"
                        disabled={isSubmitting}
                      >
                        <SkillBadge skill={skill} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Expiry Date Field */}
          {(showExpiryField || (!formData.hasExpiryDate && showExpiryField)) && (
            <div className="optional-field-inline">
              <label>Expires</label>
              {formData.hasExpiryDate ? (
                <div className="field-with-remove">
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    className="optional-input"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleRemoveExpiryDate();
                      setShowExpiryField(false);
                    }}
                    className="remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* General Error Display */}
          {errors.general && (
            <div className="error-text" style={{ textAlign: 'center', marginBottom: '15px' }}>
              {errors.general}
            </div>
          )}

          {/* Submit Error Display */}
          {errors.submit && (
            <div className="error-text" style={{ textAlign: 'center', marginBottom: '15px' }}>
              {errors.submit}
            </div>
          )}

          {/* Action Buttons */}
          <div className="add-mission-actions">
            <button
              type="button"
              onClick={onCancel}
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
              {isSubmitting ? 'Adding...' : 'Add Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMissionCard;