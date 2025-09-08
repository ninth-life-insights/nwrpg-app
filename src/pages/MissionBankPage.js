// src/pages/MissionBank.js (or src/components/pages/MissionBank.js)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MissionList from '../components/missions/MissionList';
import { getUserProfile } from '../services/userService';
import './MissionBankPage.css';

const MissionBank = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [userProfile, setUserProfile] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);

  // Load user profile when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
    }
  }, [currentUser]);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile(currentUser.uid);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  };

  const handleMissionUpdate = () => {
    // Reload user profile to get updated XP/level
    loadUserProfile();
  };

  const handleShowAddMission = () => {
    setShowAddMission(true);
  };

  const handleHideAddMission = () => {
    setShowAddMission(false);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'active':
        return 'Active Missions';
      case 'completed':
        return 'Completed Missions';
      default:
        return 'Missions';
    }
  };

  return (
    <div className="mission-bank-page">
      {/* Page Header */}
      <div className="mission-bank-header">
        <h1>{getPageTitle()}</h1>
        
        {/* Add Mission Button - Only show for active missions */}
        {activeTab === 'active' && (
          <button
            onClick={handleShowAddMission}
            className="add-mission-btn"
          >
            + Add Mission
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="mission-tabs">
        <button
          onClick={() => setActiveTab('active')}
          className={`mission-tab-btn ${activeTab === 'active' ? 'active' : 'inactive'}`}
        >
          Active
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`mission-tab-btn ${activeTab === 'completed' ? 'active' : 'inactive'}`}
        >
          Completed
        </button>
      </div>

      {/* User Profile Info */}
      {userProfile && (
        <div className="user-info">
          <div className="user-info-content">
            <span className="user-level">Level {userProfile.level}</span>
            <span className="user-xp">{userProfile.xp} XP</span>
          </div>
        </div>
      )}

      {/* Mission List Component */}
      <MissionList 
        missionType={activeTab}
        onMissionUpdate={handleMissionUpdate}
        showAddMission={showAddMission}
        onShowAddMission={handleShowAddMission}
        onHideAddMission={handleHideAddMission}
      />
    </div>
  );
};

export default MissionBank;