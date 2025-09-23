// src/components/missions/EditDailyMissions.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './EditDailyMissions.css';

// FIXED: Use services instead of direct Firestore
import { 
  getDailyMissionsConfig, 
  getActiveMissions,
  checkAndHandleDailyMissionReset,
  createMission,
  deleteMission,
  setDailyMissions
} from '../../services/missionService';

// FIXED: Use your type system
import { 
  createMissionTemplate,
  DIFFICULTY_LEVELS,
  MISSION_STATUS 
} from '../../types/Mission';

// FIXED: Use helpers for validation and status checking
import { 
  validateMissionData,
  isMissionCompleted 
} from '../../utils/missionHelpers';

const EditDailyMissions = ({ currentDailyMissions, onClose, onSave }) => {
  const { currentUser } = useAuth();
  const [newMissionTitle, setNewMissionTitle] = useState('');
  const [errors, setErrors] = useState({});
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load data independently
  const loadDailyMissions = async () => {
    try {
      setLoading(true);
      const config = await getDailyMissionsConfig(currentUser.uid);
      
      if (config && config.selectedMissionIds && config.isActive) {
        const allMissions = await getActiveMissions(currentUser.uid);
        const dailyMissions = config.selectedMissionIds
          .map(id => allMissions.find(m => m.id === id))
          .filter(Boolean);
        setMissions(dailyMissions);
      } else {
        setMissions([]);
      }
    } catch (error) {
      console.error('Error loading daily missions:', error);
      setMissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDailyMissions();
    }
  }, [currentUser]);

  // Handle daily reset independently
  useEffect(() => {
    const handleDailyReset = async () => {
      if (currentUser) {
        try {
          const result = await checkAndHandleDailyMissionReset(currentUser.uid);
          if (result.wasReset) {
            console.log(`Daily missions reset. Archived ${result.archivedCount} missions`);
            await loadDailyMissions(); // Refresh our own data
          }
        } catch (error) {
          console.error('Error checking daily mission reset:', error);
        }
      }
    };
    
    handleDailyReset();
  }, [currentUser]);

  // FIXED: Use createMissionTemplate and missionService
  const handleAddMission = async () => {
    if (!newMissionTitle.trim()) {
      setErrors({ add: 'Please enter a mission title' });
      return;
    }

    setLoading(true);
    try {
      // FIXED: Use your type system to create mission
      const missionData = createMissionTemplate({
        title: newMissionTitle.trim(),
        description: '',
        difficulty: DIFFICULTY_LEVELS.MEDIUM,
        status: MISSION_STATUS.ACTIVE,
        isDailyMission: true,
        category: 'daily',
        priority: 'normal'
      });

      // FIXED: Validate using helper
      const validation = validateMissionData(missionData);
      if (!validation.isValid) {
        setErrors({ add: validation.errors[0] || 'Invalid mission data' });
        return;
      }

      // FIXED: Use missionService instead of direct Firestore
      const missionId = await createMission(currentUser.uid, missionData);

      if (!missionId) {
        throw new Error('Failed to create mission: No ID returned');
      }

      const newMission = {
        id: missionId,
        ...missionData,
        createdAt: new Date() // For local state
      };

      setMissions(prev => [...prev, newMission]);
      setNewMissionTitle('');
      setErrors({});
      
      // Update daily missions config to include this new mission
      const updatedMissionIds = [...missions.map(m => m.id), missionId];
      await setDailyMissions(currentUser.uid, updatedMissionIds);
      
    } catch (error) {
      console.error('Error adding daily mission:', error);
      setErrors({ add: 'Failed to add mission. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Use missionService instead of direct Firestore
  const handleDeleteMission = async (missionId) => {
    setLoading(true);
    try {
      // FIXED: Use service function
      await deleteMission(currentUser.uid, missionId);
      
      const updatedMissions = missions.filter(mission => mission.id !== missionId);
      setMissions(updatedMissions);
      
      // Update daily missions config to remove this mission
      const updatedMissionIds = updatedMissions.map(m => m.id);
      await setDailyMissions(currentUser.uid, updatedMissionIds);
      
    } catch (error) {
      console.error('Error deleting daily mission:', error);
      setErrors({ delete: 'Failed to delete mission' });
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Use helper for duplicate checking
  const handleAddSuggested = async (suggestionTitle) => {
    // Check if mission already exists
    const exists = missions.some(mission => 
      mission.title.toLowerCase() === suggestionTitle.toLowerCase()
    );
    
    if (exists) {
      setErrors({ add: 'This mission already exists in your daily list' });
      return;
    }

    setNewMissionTitle(suggestionTitle);
    await handleAddMission();
  };

  // FIXED: Update daily missions config when saving
  const handleSave = async () => {
    try {
      const missionIds = missions.map(m => m.id);
      await setDailyMissions(currentUser.uid, missionIds);
      onSave(missions);
    } catch (error) {
      console.error('Error saving daily missions:', error);
      setErrors({ save: 'Failed to save changes' });
    }
  };

  // FIXED: Add loading state for better UX
  if (loading && missions.length === 0) {
    return (
      <div className="edit-daily-missions-overlay">
        <div className="edit-daily-missions-modal">
          <div className="loading-state">
            <p>Loading daily missions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-daily-missions-overlay" onClick={onClose}>
      <div className="edit-daily-missions-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="edit-daily-missions-header">
          <h2 className="modal-title">Edit Daily Missions</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="edit-daily-missions-content">
          
          {/* Current Daily Missions */}
          <div className="current-missions-section">
            <h3 className="section-heading">Your Daily Missions ({missions.length})</h3>
            
            {missions.length > 0 ? (
              <div className="missions-list">
                {missions.map((mission) => (
                  <div key={mission.id} className="mission-item-edit">
                    <div className="mission-info">
                      <span className="mission-title-edit">{mission.title}</span>
                      {/* FIXED: Use helper to check status */}
                      {isMissionCompleted(mission) && (
                        <span className="completed-badge">✓ Completed</span>
                      )}
                    </div>
                    <button 
                      className="delete-mission-button"
                      onClick={() => handleDeleteMission(mission.id)}
                      disabled={loading}
                      aria-label={`Delete mission: ${mission.title}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19,6v14a2,2 0,0 1,-2,2H7a2,2 0,0 1,-2,-2V6m3,0V4a2,2 0,0 1,2,-2h4a2,2 0,0 1,2,2v2"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-missions-placeholder">
                <p>No daily missions set up yet.</p>
                <p>Add your first one below!</p>
              </div>
            )}
          </div>

          {/* Add New Mission */}
          <div className="add-mission-section">
            <h3 className="section-heading">Add New Mission</h3>
            
            <div className="add-mission-form">
              <input
                type="text"
                value={newMissionTitle}
                onChange={(e) => setNewMissionTitle(e.target.value)}
                className={`mission-input ${errors.add ? 'error' : ''}`}
                placeholder="Enter your daily mission..."
                disabled={loading}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddMission();
                  }
                }}
              />
              <button 
                className="add-mission-button"
                onClick={handleAddMission}
                disabled={loading || !newMissionTitle.trim()}
              >
                {loading ? 'Adding...' : 'Add'}
              </button>
            </div>
            
            {errors.add && (
              <div className="error-message">{errors.add}</div>
            )}
          </div>
        </div>

        {/* FIXED: Show errors in footer */}
        <div className="edit-daily-missions-footer">
          {errors.save && (
            <div className="error-message">{errors.save}</div>
          )}
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="save-button" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDailyMissions;