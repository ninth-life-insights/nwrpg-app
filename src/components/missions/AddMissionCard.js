// src/components/missions/AddMissionCard.js
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createMission } from '../../services/missionService';
import DifficultyBadge from './DifficultyBadge';
import SkillBadge from './SkillBadge';
import { AVAILABLE_SKILLS } from '../../data/Skills';
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
    difficulty: 'easy',
    dueDate: '',
    skill: '',
    expiryDate: getDefaultExpiryDate(),
    hasExpiryDate: true
  });

  const [errors, setErrors] = useState({});
  const [showDueDateField, setShowDueDateField] = useState(false);
  const [showSkillField, setShowSkillField] = useState(false);
  const [showExpiryField, setShowExpiryField] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate XP based on difficulty
  const getXPReward = (difficulty) => {
    const xpMap = { easy: 10, medium: 25, hard: 50 };
    return xpMap[difficulty] || 10;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Mission name is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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
        xpReward: getXPReward(formData.difficulty),
        dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
        skill: formData.skill.trim() || null,
        expiryDate: formData.hasExpiryDate ? new Date(formData.expiryDate) : null,
        category: 'personal', // You can expand this later
        isDailyMission: false
      };

      const missionId = await createMission(currentUser.uid, missionData);
      
      // Call the parent component's callback with the new mission ID
      onAddMission({
        id: missionId,
        ...missionData,
        status: 'active',
        completed: false,
        createdAt: new Date()
      });

    } catch (error) {
      console.error('Error creating mission:', error);
      setErrors({ submit: 'Failed to create mission. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const difficultyOptions = ['easy', 'medium', 'hard'];

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
              {difficultyOptions.map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => handleDifficultySelect(difficulty)}
                  className={`difficulty-badge-button ${formData.difficulty === difficulty ? 'selected' : 'unselected'}`}
                  disabled={isSubmitting}
                >
                  <DifficultyBadge difficulty={difficulty} />
                  <span className="xp-indicator">+{getXPReward(difficulty)} XP</span>
                </button>
              ))}
            </div>
          </div>

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

          {/* Error Display */}
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