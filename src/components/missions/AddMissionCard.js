// src/components/missions/AddMissionCard.js
import React, { useState } from 'react';
import './AddMissionCard.css';

const AddMissionCard = ({ onAddMission, onCancel }) => {
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

  const handleRemoveExpiryDate = () => {
    setFormData(prev => ({
      ...prev,
      expiryDate: '',
      hasExpiryDate: false
    }));
  };

  const handleAddExpiryDate = () => {
    setFormData(prev => ({
      ...prev,
      expiryDate: getDefaultExpiryDate(),
      hasExpiryDate: true
    }));
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Mission name is required';
    }
    
    if (!formData.difficulty) {
      newErrors.difficulty = 'Difficulty is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    const newMission = {
      id: Date.now(), // Simple ID generation
      title: formData.title.trim(),
      description: formData.description.trim(),
      difficulty: formData.difficulty,
      dueDate: formData.dueDate || null,
      skill: formData.skill.trim() || null,
      expiryDate: formData.hasExpiryDate ? formData.expiryDate : null,
      completed: false,
      isDailyMission: false
    };

    onAddMission(newMission);
  };

  return (
    <div className="add-mission-overlay" onClick={onCancel}>
      <div className="add-mission-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="add-mission-header">
          <h2 className="add-mission-title">Add New Mission</h2>
          <button className="close-button" onClick={onCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="add-mission-form">
          
          {/* Required Fields Section */}
          <div className="form-section">
            <h3 className="section-title">Required Information</h3>
            
            <div className="form-group">
              <label htmlFor="title" className="form-label">
                Mission Name *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`form-input ${errors.title ? 'error' : ''}`}
                placeholder="Enter mission name..."
              />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="difficulty" className="form-label">
                Difficulty *
              </label>
              <select
                id="difficulty"
                name="difficulty"
                value={formData.difficulty}
                onChange={handleInputChange}
                className={`form-select ${errors.difficulty ? 'error' : ''}`}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
                <option value="expert">Expert</option>
              </select>
              {errors.difficulty && <span className="error-message">{errors.difficulty}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Mission Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-textarea"
                placeholder="Describe the mission..."
                rows="3"
              />
            </div>
          </div>

          {/* Optional Fields Section */}
          <div className="form-section">
            <h3 className="section-title">Optional Information</h3>
            
            <div className="form-group">
              <label htmlFor="dueDate" className="form-label">
                Due Date
              </label>
              <input
                type="date"
                id="dueDate"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleInputChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="skill" className="form-label">
                Skill
              </label>
              <input
                type="text"
                id="skill"
                name="skill"
                value={formData.skill}
                onChange={handleInputChange}
                className="form-input"
                placeholder="e.g., Cleaning & Organizing"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Expiration Date
              </label>
              {formData.hasExpiryDate ? (
                <div className="expiry-date-input">
                  <input
                    type="date"
                    name="expiryDate"
                    value={formData.expiryDate}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveExpiryDate}
                    className="remove-expiry-button"
                    title="Remove expiration date"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleAddExpiryDate}
                  className="add-expiry-button"
                >
                  + Add expiration date
                </button>
              )}
              <span className="form-help">Defaults to 30 days from creation</span>
            </div>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="submit-button"
            >
              Add Mission
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMissionCard;