// src/components/missions/AddMissionCard.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createMission, updateMission } from '../../services/missionService';
import Badge from '../ui/Badge';
import CompletionTypeSelector from './sub-components/CompletionTypeSelector';
import RecurrenceSelector, { RECURRENCE_PATTERNS } from './sub-components/recurrenceSelector';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import { toDateString, fromDateString } from '../../utils/dateHelpers';
import {
  createMissionTemplate,
  validateMission,
  DIFFICULTY_LEVELS,
  COMPLETION_TYPES,
  DUE_TYPES,
} from '../../types/Mission';
import { validateMissionData } from '../../utils/missionHelpers';
import './AddMissionCard.css';

const AddMissionCard = ({ 
  onAddMission, 
  onCancel,
  mode = 'add',
  initialMission = null,
  onUpdateMission
}) => {
  const { currentUser } = useAuth();
  
  // Get default expiry date (30 days from now)
  const getDefaultExpiryDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // Initialize form data based on mode
  const getInitialFormData = () => {
    if (mode === 'edit' && initialMission) {
      return {
        title: initialMission.title || '',
        description: initialMission.description || '',
        difficulty: initialMission.difficulty || DIFFICULTY_LEVELS.EASY,
        completionType: initialMission.completionType || COMPLETION_TYPES.SIMPLE,
        dueType: initialMission.dueType || DUE_TYPES.UNIQUE,
        dueDate: initialMission.dueDate || '',
        skill: initialMission.skill || '',
        expiryDate: initialMission.expiryDate || '',
        hasExpiryDate: !!initialMission.expiryDate,
        timerDurationMinutes: initialMission.timerDurationMinutes || '',
        targetCount: initialMission.targetCount || '',
        recurrence: initialMission.recurrence || {
          pattern: RECURRENCE_PATTERNS.NONE,
          interval: 1,
          weekdays: [],
          dayOfMonth: null,
          endDate: null,
          maxOccurrences: null
        },
        priority: initialMission.priority || 'normal',
        pinned: initialMission.pinned || false,
        isDailyMission: initialMission.isDailyMission || false
      };
    }
    
    return {
      title: '',
      description: '',
      difficulty: DIFFICULTY_LEVELS.EASY,
      completionType: COMPLETION_TYPES.SIMPLE,
      dueType: DUE_TYPES.UNIQUE,
      dueDate: '',
      skill: '',
      expiryDate: getDefaultExpiryDate(),
      hasExpiryDate: true,
      timerDurationMinutes: '',
      targetCount: '',
      recurrence: {
        pattern: RECURRENCE_PATTERNS.NONE,
        interval: 1,
        weekdays: [],
        dayOfMonth: null,
        endDate: null,
        maxOccurrences: null
      },
      priority: 'normal',
      pinned: false,
      isDailyMission: false
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState({});
  const [showDueDateField, setShowDueDateField] = useState(mode === 'edit' && initialMission?.dueDate);
  const [showSkillField, setShowSkillField] = useState(mode === 'edit' && initialMission?.skill);
  const [showExpiryField, setShowExpiryField] = useState(mode === 'edit' && initialMission?.expiryDate);
  const [skillSearch, setSkillSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when initialMission changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && initialMission) {
      setFormData(getInitialFormData());
      setShowDueDateField(!!initialMission.dueDate);
      setShowSkillField(!!initialMission.skill);
      setShowExpiryField(!!initialMission.expiryDate);
    }
  }, [mode, initialMission]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
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

  const handleRecurrenceChange = (newRecurrence) => {
    setFormData(prev => ({
      ...prev,
      recurrence: newRecurrence,
      dueType: newRecurrence.pattern !== RECURRENCE_PATTERNS.NONE ? DUE_TYPES.RECURRING : DUE_TYPES.UNIQUE
    }));
  };

  const handleRemoveExpiryDate = () => {
    setFormData(prev => ({
      ...prev,
      expiryDate: '',
      hasExpiryDate: false
    }));
  };

  const createMissionDataFromForm = () => {
    return createMissionTemplate({
      title: formData.title.trim(),
      description: formData.description.trim(),
      difficulty: formData.difficulty,
      completionType: formData.completionType,
      dueType: formData.dueType,
      dueDate: formData.dueDate ? toDateString(formData.dueDate) : '',
      expiryDate: formData.hasExpiryDate ? toDateString(formData.expiryDate) : null,
      skill: formData.skill.trim() || null,
      timerDurationMinutes: formData.timerDurationMinutes ? parseInt(formData.timerDurationMinutes, 10) : null,
      targetCount: formData.targetCount ? parseInt(formData.targetCount, 10) : null,
      recurrence: formData.recurrence,
      category: 'personal',
      isDailyMission: formData.isDailyMission,
      priority: formData.priority,
      pinned: formData.pinned
    });
  };

  const validateForm = () => {
    const missionData = createMissionDataFromForm();
    const validation = validateMissionData(missionData);
    
    if (!validation.isValid) {
      const newErrors = {};
      validation.errors.forEach(error => {
        const errorLower = error.toLowerCase();
        if (errorLower.includes('title')) newErrors.title = error;
        else if (errorLower.includes('timer') || errorLower.includes('duration')) newErrors.timerDurationMinutes = error;
        else if (errorLower.includes('count') || errorLower.includes('target')) newErrors.targetCount = error;
        else if (errorLower.includes('due date') || errorLower.includes('recurring')) newErrors.dueDate = error;
        else if (errorLower.includes('recurrence') || errorLower.includes('weekday')) newErrors.recurrence = error;
        else newErrors.general = error;
      });
      setErrors(newErrors);
    }
    
    return validation.isValid;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      difficulty: DIFFICULTY_LEVELS.EASY,
      completionType: COMPLETION_TYPES.SIMPLE,
      dueType: DUE_TYPES.UNIQUE,
      dueDate: '',
      skill: '',
      expiryDate: getDefaultExpiryDate(),
      hasExpiryDate: true,
      timerDurationMinutes: '',
      targetCount: '',
      recurrence: {
        pattern: RECURRENCE_PATTERNS.NONE,
        interval: 1,
        weekdays: [],
        dayOfMonth: null,
        endDate: null,
        maxOccurrences: null
      },
      priority: 'normal',
      pinned: false,
      isDailyMission: false
    });
    
    setShowDueDateField(false);
    setShowSkillField(false);
    setShowExpiryField(false);
    setSkillSearch('');
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm() || !currentUser) {
      return;
    }

    setIsSubmitting(true);

    try {
      const missionData = createMissionDataFromForm();

      if (mode === 'edit' && initialMission) {
        // Update existing mission
        await updateMission(currentUser.uid, initialMission.id, missionData);
        
        if (onUpdateMission) {
          onUpdateMission({
            ...initialMission,
            ...missionData,
            id: initialMission.id,
            updatedAt: new Date()
          });
        }
      } else {
        // Create new mission
        const missionId = await createMission(currentUser.uid, missionData);
        
        if (!missionId) {
          throw new Error('Failed to create mission: No ID returned');
        }
        
        onAddMission({
          ...missionData,
          id: missionId,
          status: 'active',
          createdAt: new Date()
        });
      }

      resetForm();
      onCancel();

    } catch (error) {
      console.error(`Error ${mode === 'edit' ? 'updating' : 'creating'} mission:`, error);
      setErrors({ submit: `Failed to ${mode === 'edit' ? 'update' : 'create'} mission. Please try again.` });
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  <Badge variant="difficulty" difficulty={difficulty}>{difficulty}</Badge> 
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
                  className={`optional-input ${errors.dueDate ? 'error' : ''}`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ 
                      ...prev, 
                      dueDate: '',
                      recurrence: {
                        pattern: RECURRENCE_PATTERNS.NONE,
                        interval: 1,
                        weekdays: [],
                        dayOfMonth: null,
                        endDate: null,
                        maxOccurrences: null
                      },
                      dueType: DUE_TYPES.UNIQUE
                    }));
                    setShowDueDateField(false);
                  }}
                  className="remove-field-btn"
                  disabled={isSubmitting}
                >
                  ×
                </button>
              </div>
              {errors.dueDate && <span className="error-text">{errors.dueDate}</span>}
            </div>
          )}

          {/* Recurrence Selector */}
          {formData.dueDate && (
            <div className="recurrence-section">
              <RecurrenceSelector
                recurrence={formData.recurrence}
                onRecurrenceChange={handleRecurrenceChange}
                dueDate={formData.dueDate}
                disabled={isSubmitting}
                errors={errors}
              />
            </div>
          )}

          {/* Skill Field */}
          {(showSkillField || formData.skill) && (
            <div className="skill-field-section">
              <label>Skill</label>
              {formData.skill ? (
                <div className="selected-skill-inline">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, skill: '' }));
                      setShowSkillField(true);
                      setSkillSearch('');
                    }}
                    className="skill-badge-button"
                    disabled={isSubmitting}
                  >
                    <Badge variant="skill">Skill: {formData.skill}</Badge>
                  </button>
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
                        <Badge variant="skill">{skill}</Badge>
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
              {isSubmitting 
                ? (mode === 'edit' ? 'Updating...' : 'Adding...') 
                : (mode === 'edit' ? 'Update Mission' : 'Add Mission')
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMissionCard;