// src/components/missions/AddMissionCard.js
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createMission, updateMission } from '../../services/missionService';
import { getActiveQuests, addMissionToQuest, removeMissionFromQuest } from '../../services/questService';
import { useRooms } from '../../contexts/RoomsContext';
import { ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { getUserProfile } from '../../services/userService';
import Badge from '../ui/Badge';
// import CompletionTypeSelector from './sub-components/CompletionTypeSelector'; // not yet fully implemented
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
import ErrorMessage from '../ui/ErrorMessage';
import './AddMissionCard.css';

const AddMissionCard = ({
  onAddMission,
  onCancel,
  mode = 'add',
  initialMission = null,
  initialDueDate = null,   // pre-fill dueDate in add mode (YYYY-MM-DD string)
  onUpdateMission,
  defaultRoomId = null,    // pre-assign mission to a room (silently)
  defaultQuestId = null,   // pre-assign mission to a quest (silently)
  autoOpenField = null,    // field to auto-expand on mount (e.g. 'dueDate', 'skill', 'room')
}) => {
  const { currentUser } = useAuth();

  // User's preferred default follow-up window. 'none' means no auto follow-up;
  // a positive number is days. Defaults to 30; updated from profile on mount
  // for create mode.
  const [defaultFollowUpDays, setDefaultFollowUpDays] = useState(30);

  // Format a date `days` from now as YYYY-MM-DD. Falls back to 30 for any
  // non-positive-number input (e.g. 'none' or undefined) — callers should
  // gate on the preference before calling this when 'none' is meaningful.
  const getDefaultExpiryDate = (days = 30) => {
    const numDays = typeof days === 'number' && days > 0 ? days : 30;
    const date = new Date();
    date.setDate(date.getDate() + numDays);
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
        questId: initialMission.questId || null,
        baseLocation: initialMission.baseLocation || null,
        isPriority: initialMission.isPriority === true,
      };
    }

    return {
      title: '',
      description: '',
      difficulty: DIFFICULTY_LEVELS.EASY,
      completionType: COMPLETION_TYPES.SIMPLE,
      dueType: DUE_TYPES.UNIQUE,
      dueDate: initialDueDate || '',
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
      questId: defaultQuestId || null,
      baseLocation: defaultRoomId || null,
      isPriority: false,
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState({});
  const [showDueDateField, setShowDueDateField] = useState((mode === 'edit' && !!initialMission?.dueDate) || !!initialDueDate || autoOpenField === 'dueDate');
  const [showSkillField, setShowSkillField] = useState(!!(mode === 'edit' && initialMission?.skill) || autoOpenField === 'skill');
  const [showExpiryField, setShowExpiryField] = useState(false);
  const [showQuestField, setShowQuestField] = useState((mode === 'edit' && !!initialMission?.questId) || !!defaultQuestId);
  const [skillSearch, setSkillSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quests, setQuests] = useState([]);
  const [baseName, setBaseName] = useState('');
  const { rooms } = useRooms();
  const [showRoomField, setShowRoomField] = useState(!!(mode === 'edit' && !!initialMission?.baseLocation) || autoOpenField === 'room');

  // Load active quests, base name, and default follow-up preference on mount.
  // The follow-up preference only affects create mode: if 'none', the new
  // mission opens with no follow-up date; if a number, it sets the duration.
  useEffect(() => {
    if (!currentUser) return;
    getActiveQuests(currentUser.uid)
      .then(setQuests)
      .catch(err => console.error('Could not load quests:', err));
    getUserProfile(currentUser.uid)
      .then(profile => {
        setBaseName(profile?.baseName || '');
        if (mode === 'edit') return;
        const pref = profile?.defaultFollowUpDays;
        if (pref === 'none') {
          setDefaultFollowUpDays('none');
          setFormData(prev => prev.hasExpiryDate
            ? { ...prev, expiryDate: '', hasExpiryDate: false }
            : prev);
        } else if (typeof pref === 'number' && pref > 0 && pref !== 30) {
          setDefaultFollowUpDays(pref);
          setFormData(prev => prev.hasExpiryDate
            ? { ...prev, expiryDate: getDefaultExpiryDate(pref) }
            : prev);
        }
      })
      .catch(() => {});
  }, [currentUser, mode]);

  // Update form when initialMission changes (for edit mode)
  useEffect(() => {
    if (mode === 'edit' && initialMission) {
      setFormData(getInitialFormData());
      setShowDueDateField(!!initialMission.dueDate || autoOpenField === 'dueDate');
      setShowSkillField(!!initialMission.skill || autoOpenField === 'skill');
      setShowExpiryField(false);
      setShowQuestField(!!initialMission.questId);
      setShowRoomField(!!initialMission.baseLocation || autoOpenField === 'room');
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

  // const handleCompletionTypeSelect = (completionType) => { // not yet fully implemented
  //   setFormData(prev => ({
  //     ...prev,
  //     completionType: completionType,
  //     timerDurationMinutes: completionType === COMPLETION_TYPES.TIMER ? prev.timerDurationMinutes : null,
  //     targetCount: completionType === COMPLETION_TYPES.COUNT ? prev.targetCount : null,
  //   }));
  // };

  const handleSkillSelect = (skill) => {
    setFormData(prev => ({
      ...prev,
      skill: skill
    }));
    setSkillSearch('');
  };

  const handleQuestSelect = (questId) => {
    setFormData(prev => ({ ...prev, questId }));
  };

  const handleRecurrenceChange = (newRecurrence) => {
    setFormData(prev => ({
      ...prev,
      recurrence: newRecurrence,
      dueType: newRecurrence.pattern !== RECURRENCE_PATTERNS.NONE ? DUE_TYPES.RECURRING : DUE_TYPES.UNIQUE
    }));
  };

  const handleDueTypeSelect = (dueType) => {
    if (dueType === DUE_TYPES.RECURRING) {
      setFormData(prev => ({
        ...prev,
        dueType,
        recurrence: {
          ...prev.recurrence,
          pattern: prev.recurrence.pattern === RECURRENCE_PATTERNS.NONE
            ? RECURRENCE_PATTERNS.DAILY
            : prev.recurrence.pattern
        }
      }));
      setShowDueDateField(true);
    } else {
      // UNIQUE or EVERGREEN: keep due date, reset recurrence only
      setFormData(prev => ({
        ...prev,
        dueType,
        recurrence: {
          pattern: RECURRENCE_PATTERNS.NONE,
          interval: 1,
          weekdays: [],
          dayOfMonth: null,
          endDate: null,
          maxOccurrences: null
        }
      }));
      setShowDueDateField(prev => prev || !!formData.dueDate);
    }
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
      baseLocation: formData.baseLocation || null,
      isPriority: formData.isPriority === true,
    });
  };

  const validateForm = () => {
    const missionData = createMissionDataFromForm();
    const validation = validateMission(missionData);
    
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
      questId: null,
      baseLocation: null,
      isPriority: false,
    });

    setShowDueDateField(false);
    setShowSkillField(false);
    setShowExpiryField(false);
    setShowQuestField(false);
    setShowRoomField(false);
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

        // Handle quest link changes
        const prevQuestId = initialMission.questId || null;
        const nextQuestId = formData.questId || null;
        if (prevQuestId !== nextQuestId) {
          if (prevQuestId) await removeMissionFromQuest(currentUser.uid, prevQuestId, initialMission.id);
          if (nextQuestId) await addMissionToQuest(currentUser.uid, nextQuestId, initialMission.id);
        }

        if (onUpdateMission) {
          onUpdateMission({
            ...initialMission,
            ...missionData,
            id: initialMission.id,
            questId: nextQuestId,
            updatedAt: new Date()
          });
        }
      } else {
        // Create new mission
        const missionId = await createMission(currentUser.uid, missionData);

        if (!missionId) {
          throw new Error('Failed to create mission: No ID returned');
        }

        if (formData.questId) {
          await addMissionToQuest(currentUser.uid, formData.questId, missionId);
        }

        onAddMission({
          ...missionData,
          id: missionId,
          questId: formData.questId || null,
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

  return createPortal(
    <div className="add-mission-overlay" onClick={onCancel}>
      <form className="add-mission-card" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
        <div className="add-mission-header">
          <h2>{mode === 'edit' ? 'Edit Mission' : 'Add Mission'}</h2>
          <button
            type="button"
            className={`priority-toggle-btn ${formData.isPriority ? 'active' : ''}`}
            onClick={() => setFormData(prev => ({ ...prev, isPriority: !prev.isPriority }))}
            disabled={isSubmitting}
            aria-label={formData.isPriority ? 'Remove priority' : 'Mark as priority'}
            aria-pressed={formData.isPriority === true}
            title={formData.isPriority ? 'Remove priority' : 'Mark as priority'}
          >
            <span className="material-icons">{formData.isPriority ? 'flag' : 'outlined_flag'}</span>
          </button>
        </div>
        <div className="add-mission-body">

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

          {/* Completion Type Selector — not yet fully implemented */}
          {/* <CompletionTypeSelector
            completionType={formData.completionType}
            onCompletionTypeChange={handleCompletionTypeSelect}
            timerDurationMinutes={formData.timerDurationMinutes ? parseInt(formData.timerDurationMinutes) : null}
            onTimerDurationChange={(minutes) => setFormData(prev => ({ ...prev, timerDurationMinutes: minutes }))}
            targetCount={formData.targetCount ? parseInt(formData.targetCount) : null}
            onTargetCountChange={(count) => setFormData(prev => ({ ...prev, targetCount: count }))}
            disabled={isSubmitting}
            errors={errors}
          /> */}

          {/* Due Type Selector */}
          <div className="due-type-section">
            <label className="section-label">Mission Type</label>
            <div className="due-type-selector" data-selected={formData.dueType}>
              {[
                { label: 'Standard', value: DUE_TYPES.UNIQUE },
                { label: 'Recurring', value: DUE_TYPES.RECURRING },
                { label: 'Evergreen', value: DUE_TYPES.EVERGREEN },
              ].map(({ label, value }) => (
                <label key={value} className="due-type-option">
                  <input
                    type="radio"
                    name="dueType"
                    value={value}
                    checked={formData.dueType === value}
                    onChange={() => handleDueTypeSelect(value)}
                    disabled={isSubmitting}
                  />
                  <span className="due-type-label">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Optional Field Ghost Badges */}
          <div className="ghost-badges">
            {formData.dueType === DUE_TYPES.UNIQUE && !showDueDateField && !formData.dueDate && (
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

            {!showQuestField && !formData.questId && quests.length > 0 && (
              <button
                type="button"
                onClick={() => setShowQuestField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Quest
              </button>
            )}

            {!showRoomField && !formData.baseLocation && rooms.length > 0 && (
              <button
                type="button"
                onClick={() => setShowRoomField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Room
              </button>
            )}
            
            {!showExpiryField && formData.hasExpiryDate && (
              <button
                type="button"
                onClick={() => setShowExpiryField(true)}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                Edit follow-up window
              </button>
            )}

            {!formData.hasExpiryDate && (
              <button
                type="button"
                onClick={() => {
                  // If preference is 'none', user is explicitly opting in for
                  // this mission — give them a sensible 30-day default.
                  const days = typeof defaultFollowUpDays === 'number' ? defaultFollowUpDays : 30;
                  setFormData(prev => ({ ...prev, expiryDate: getDefaultExpiryDate(days), hasExpiryDate: true }));
                  setShowExpiryField(true);
                }}
                className="ghost-badge"
                disabled={isSubmitting}
              >
                + Follow-up window
              </button>
            )}
          </div>

          {/* Due Date Field — hidden for Evergreen, required for Recurring */}
          {formData.dueType !== DUE_TYPES.EVERGREEN && (showDueDateField || formData.dueDate) && (
            <div className="optional-field-inline">
              <label>Due Date{formData.dueType === DUE_TYPES.RECURRING ? ' *' : ''}</label>
              <div className="field-with-remove">
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate}
                  onChange={handleInputChange}
                  className={`optional-input ${errors.dueDate ? 'error' : ''}`}
                  disabled={isSubmitting}
                />
                {formData.dueType === DUE_TYPES.UNIQUE && (
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
                        }
                      }));
                      setShowDueDateField(false);
                    }}
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    X
                  </button>
                )}
              </div>
              {errors.dueDate && <span className="error-text">{errors.dueDate}</span>}
            </div>
          )}

          {/* Recurrence Selector */}
          {formData.dueType === DUE_TYPES.RECURRING && (
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
                    className="mission-remove-field-btn"
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
                      className="mission-remove-field-btn"
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

          {/* Quest Field */}
          {(showQuestField || formData.questId) && quests.length > 0 && (
            <div className="skill-field-section">
              <label>Quest</label>
              {formData.questId ? (
                <div className="selected-skill-inline">
                  <button
                    type="button"
                    onClick={() => setShowQuestField(true)}
                    className="skill-badge-button"
                    disabled={isSubmitting}
                  >
                    <Badge variant="quest">{quests.find(q => q.id === formData.questId)?.title ?? 'Quest'}</Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, questId: null }));
                      setShowQuestField(false);
                    }}
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="field-with-remove">
                  <select
                    className="optional-input"
                    value=""
                    onChange={(e) => handleQuestSelect(e.target.value)}
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>Select a quest...</option>
                    {quests.map(q => (
                      <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuestField(false)}
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Room Field */}
          {(showRoomField || formData.baseLocation) && rooms.length > 0 && (
            <div className="skill-field-section">
              <label>Room</label>
              {formData.baseLocation ? (
                <div className="selected-skill-inline">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, baseLocation: null }));
                      setShowRoomField(true);
                    }}
                    className="skill-badge-button"
                    disabled={isSubmitting}
                  >
                    <Badge variant="room" icon="home">
                      {(() => {
                        const room = rooms.find(r => r.id === formData.baseLocation);
                        if (!room) return 'Room';
                        return room.id === ENTIRE_BASE_ROOM_ID ? (baseName || room.name) : room.name;
                      })()}
                    </Badge>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, baseLocation: null }));
                      setShowRoomField(false);
                    }}
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="field-with-remove">
                  <select
                    className="optional-input"
                    value=""
                    onChange={(e) => setFormData(prev => ({ ...prev, baseLocation: e.target.value }))}
                    disabled={isSubmitting}
                  >
                    <option value="" disabled>Select a room...</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.id === ENTIRE_BASE_ROOM_ID ? (baseName || r.name) : r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowRoomField(false)}
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Expiry Date Field */}
          {(showExpiryField || (!formData.hasExpiryDate && showExpiryField)) && (
            <div className="optional-field-inline">
              <label>Up for review by</label>
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
                    className="mission-remove-field-btn"
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* General Error Display */}
          {errors.general && <ErrorMessage message={errors.general} />}

          {/* Submit Error Display */}
          {errors.submit && <ErrorMessage message={errors.submit} />}

        </div>
        <div className="add-mission-footer">
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
    </div>,
    document.body
  );
};

export default AddMissionCard;