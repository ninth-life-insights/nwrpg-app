// src/components/missions/EditDailyMissions.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import './EditDailyMissions.css';
import { 
  getDailyMissionsConfig, 
  getActiveMissions,
  checkAndHandleDailyMissionReset 
} from '../../services/missionService';

const EditDailyMissions = ({ currentDailyMissions, onClose, onSave }) => {
  const { currentUser } = useAuth();
  // const [missions, setMissions] = useState(currentDailyMissions || []);
  const [newMissionTitle, setNewMissionTitle] = useState('');
  // const [isLoading, setIsLoading] = useState(false);
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
        const result = await checkAndHandleDailyMissionReset(currentUser.uid);
        if (result.wasReset) {
          console.log(`Daily missions reset. Archived ${result.archivedCount} missions`);
          await loadDailyMissions(); // Refresh our own data
        }
      }
    };
    
    handleDailyReset();
  }, [currentUser]);

  //   // reset daily missions if expired
  //   useEffect(() => {
  //   const handleDailyReset = async () => {
  //     if (currentUser) {
  //       const result = await checkAndHandleDailyMissionReset(currentUser.uid);
  //       if (result.wasReset) {
  //         // Optionally show user notification
  //         console.log(`Daily missions reset. Archived ${result.archivedCount} missions from ${result.archivedDate}`);
  //         // Refresh your daily missions data
  //         await fetchDailyMissions();
  //       }
  //     }
  //   };
    
  //   handleDailyReset();
  // }, [currentUser]);

  const handleAddMission = async () => {
    if (!newMissionTitle.trim()) {
      setErrors({ add: 'Please enter a mission title' });
      return;
    }

    setLoading(true);
    try {
      const missionData = {
        title: newMissionTitle.trim(),
        description: '',
        difficulty: 'medium',
        isDailyMission: true,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(
        collection(db, 'users', currentUser.uid, 'missions'), 
        missionData
      );

      const newMission = {
        id: docRef.id,
        ...missionData,
        completed: false
      };

      setMissions(prev => [...prev, newMission]);
      setNewMissionTitle('');
      setErrors({});
    } catch (error) {
      console.error('Error adding daily mission:', error);
      setErrors({ add: 'Failed to add mission. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMission = async (missionId) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'missions', missionId));
      setMissions(prev => prev.filter(mission => mission.id !== missionId));
    } catch (error) {
      console.error('Error deleting daily mission:', error);
      setErrors({ delete: 'Failed to delete mission' });
    } finally {
      setLoading(false);
    }
  };

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

  const handleSave = () => {
    onSave(missions);
  };

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
            <h3 className="section-heading">Your Daily Missions</h3>
            
            {missions.length > 0 ? (
              <div className="missions-list">
                {missions.map((mission) => (
                  <div key={mission.id} className="mission-item-edit">
                    <span className="mission-title-edit">{mission.title}</span>
                    <button 
                      className="delete-mission-button"
                      onClick={() => handleDeleteMission(mission.id)}
                      disabled={loading}
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
                Add
              </button>
            </div>
            
            {errors.add && (
              <div className="error-message">{errors.add}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="edit-daily-missions-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="save-button" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDailyMissions;