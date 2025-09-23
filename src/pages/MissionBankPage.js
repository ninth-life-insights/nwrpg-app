// src/pages/MissionBank.js (or src/components/pages/MissionBank.js)
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MissionList from '../components/missions/MissionList';
import MissionFilterModal from '../components/missions/sub-components/MissionFilterModal';
import { getUserProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import './MissionBankPage.css';

const MissionBank = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('active');
  const [userProfile, setUserProfile] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'dueDate',
    sortOrder: 'asc',
    skillFilter: '',
    includeCompleted: false,
    includeExpired: false
  });

  // State to track recently completed missions
  const [recentlyCompletedMissions, setRecentlyCompletedMissions] = useState([]);


  const navigate = useNavigate('/home');

  const HomeButtonClick = () => {
    navigate('/home');
  };

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

  // Handle mission completion updates
  const handleMissionCompletion = (completedMission) => {
    // Add to recently completed missions if not already there
    setRecentlyCompletedMissions(prev => {
      const existingIndex = prev.findIndex(mission => mission.id === completedMission.id);
      if (existingIndex >= 0) {
        // Mission already in list, don't add duplicate
        return prev;
      }
      // Add to the beginning of the array
      return [completedMission, ...prev];
    });
  };

  // Handle mission un-completion
  const handleMissionUncompletion = (uncompletedMissionId) => {
    // Remove from recently completed missions
    setRecentlyCompletedMissions(prev => 
      prev.filter(mission => mission.id !== uncompletedMissionId)
    );
  };

  const handleShowAddMission = () => {
    setShowAddMission(true);
  };

  const handleHideAddMission = () => {
    setShowAddMission(false);
  };

  const handleShowFilters = () => {
    setShowFilterModal(true);
  };

  const handleHideFilters = () => {
    setShowFilterModal(false);
  };

  const handleApplyFilters = (newFilters) => {
    // Clear recently completed missions when filters change
    setRecentlyCompletedMissions([]);
    
    setFilters(newFilters);
    
    // Update activeTab based on include options
    if (newFilters.includeCompleted && newFilters.includeExpired) {
      setActiveTab('all');
    } else if (newFilters.includeCompleted) {
      setActiveTab('completed');
    } else if (newFilters.includeExpired) {
      setActiveTab('expired');
    } else {
      setActiveTab('active');
    }
  };

  const getMissionType = () => {
    if (filters.includeCompleted && filters.includeExpired) {
      return 'all';
    } else if (filters.includeCompleted) {
      return 'completed';
    } else if (filters.includeExpired) {
      return 'expired';
    } else {
      return activeTab;
    }
  };

  return (
    <div className="mission-bank-page">
      {/* Page Header */}
      <div className="mission-bank-header">
        <div className="top-header">
          <button className="home-button" onClick={HomeButtonClick}>
            Home
          </button>
          <h1>Mission Bank</h1>
        </div>
        
        <div className="header-actions">
          {/* Filter Button */}
          <button
            onClick={handleShowFilters}
            className="filter-btn-header"
            title="Filter & Sort"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
            </svg>
          </button>
          
          {/* Add Mission Button */}
          <button
            onClick={handleShowAddMission}
            className="add-mission-btn"
          >
            + Add Mission
          </button>
        </div>
      </div>

      {/* Mission List Component */}
      <MissionList 
        missionType={getMissionType()}
        onMissionUpdate={handleMissionUpdate}
        showAddMission={showAddMission}
        onShowAddMission={handleShowAddMission}
        onHideAddMission={handleHideAddMission}
        filters={filters}
        recentlyCompletedMissions={recentlyCompletedMissions}
        onMissionCompletion={handleMissionCompletion}
        onMissionUncompletion={handleMissionUncompletion}
      />

      {/* Filter Modal */}
      <MissionFilterModal
        isOpen={showFilterModal}
        onClose={handleHideFilters}
        currentFilters={filters}
        onApplyFilters={handleApplyFilters}
      />
    </div>
  );
};

export default MissionBank;