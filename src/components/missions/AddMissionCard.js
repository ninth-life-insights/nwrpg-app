// src/components/missions/AddMissionCard.js
import React, { useState, useCallback } from 'react';
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

  const handleCompletionTypeSelect = useCallback((completionType) => {
    setFormData(prev => ({
      ...prev,
      completionType: completionType,
      // Reset completion-specific fields when changing types
      timerDurationMinutes: completionType === COMPLETION_TYPES.TIMER ? prev.timerDurationMinutes : null,
      targetCount: completionType === COMPLETION_TYPES.COUNT ? prev.targetCount : null,
    }));
  }, []);

  const handleTimerDurationChange = useCallback((minutes) => {
    setFormData(prev => ({ ...prev, timerDurationMinutes: minutes }));
  }, []);

  const handleTargetCountChange = useCallback((count) => {
    setFormData(prev => ({ ...prev, targetCount: count }));
  }, []);

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
    // FIXED: Use the schema template function to create properly structured mission data
    const missionData = createMissionTemplate({
      title: formData.title.trim(),
      description: formData.description.trim(),
      difficulty: formData.difficulty,
      completionType: formData.completionType,
      dueType: formData.dueType,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : null,
      expiryDate: formData.hasExpiryDate ? new Date(formData.expiryDate) : null,
      skill: formData.skill.trim() || null,
      // Timer-specific fields
      timerDurationMinutes: formData.completionType === COMPLETION_TYPES.TIMER 
        ? parseInt(formData.timerDurationMinutes) || null 
        : null,
      // Count-specific fields  
      targetCount: formData.completionType === COMPLETION_TYPES.COUNT 
        ? parseInt(formData.targetCount) || null 
        : null,
      currentCount: formData.completionType === COMPLETION_TYPES.COUNT ? 0 : null,
      // Other fields
      priority: formData.priority,
      pinned: formData.pinned,
      isDailyMission: formData.isDailyMission,
      // Status will be set by createMission service
      status: MISSION_STATUS.ACTIVE
    });

    const missionId = await createMission(currentUser.uid, missionData);
    
    // Validate that we got a valid mission ID back
    if (!missionId) {
      throw new Error('Failed to create mission: No ID returned');
    }
    
    // Call the parent component's callback with the new mission
    onAddMission({
      id: missionId,
      ...missionData,
      createdAt: new Date() // This will be overridden by server timestamp in Firestore
    });

    // Reset form
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
      priority: 'normal',
      pinned: false,
      isDailyMission: false
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

    console.log('=== AddMissionCard RENDER ===');
console.log('formData:', formData);
console.log('showDueDateField:', showDueDateField);
console.log('showSkillField:', showSkillField); 
console.log('showExpiryField:', showExpiryField);

// Step 2: Check your data sources
console.log('DIFFICULTY_LEVELS:', DIFFICULTY_LEVELS);
console.log('COMPLETION_TYPES:', COMPLETION_TYPES);
console.log('AVAILABLE_SKILLS (first 10):', AVAILABLE_SKILLS?.slice(0, 10));

  return (
  <div className="add-mission-overlay" onClick={onCancel}>
    <div className="add-mission-card" onClick={(e) => e.stopPropagation()}>
      <form onSubmit={handleSubmit}>
        <div className="add-mission-title-section">
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Mission Name *"
          />
        </div>
        <div className="add-mission-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit">Add Mission</button>
        </div>
      </form>
    </div>
  </div>
);
};

export default AddMissionCard;