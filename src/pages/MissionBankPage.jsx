// src/pages/MissionBank.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import MissionList from '../components/missions/MissionList';
import MissionFilterModal from '../components/missions/sub-components/MissionFilterModal';
import { getUserProfile } from '../services/userService';
import { useNavigate } from 'react-router-dom';
import AchievementToast from '../components/achievements/AchievementToast';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './MissionBankPage.css';

const MissionBank = () => {
  const { currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    sortBy: 'custom',
    sortOrder: 'asc',
    skillFilter: '',
    includeCompleted: false,
    showArchive: false,
    completedDateRange: 'last7days'
  });

  // State to track recently completed missions
  const [recentlyCompletedMissions, setRecentlyCompletedMissions] = useState([]);
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const navigate = useNavigate();

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
    if (isDefinitelyOffline()) {
      setLoadError("Your missions didn't load. Check your connection and try again.");
      return;
    }
    try {
      const profile = await withTimeout(getUserProfile(currentUser.uid));
      setUserProfile(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
      setLoadError(getLoadErrorMessage(err, 'missions'));
    }
  };

  const handleMissionUpdate = () => {
    // Reload user profile to get updated XP/level
    loadUserProfile();
  };

  // Handle mission completion updates
  const handleMissionCompletion = (completedMission, levelUpData, skillLevelUpData) => {
    console.log('levelUpData received:', levelUpData);
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

  };

  const getMissionType = () => {
    if (filters.showArchive) return 'expired';
    if (filters.includeCompleted) return 'active_completed';
    return 'active';
  };

  return (
    <div className="mission-bank-page">
      {/* Page Header */}
      <div className="mission-bank-header">
        <div className="top-header">
          <button className="home-button" onClick={HomeButtonClick} aria-label="Back to home">
            <span className="material-icons">arrow_back</span>
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

      {loadError && <ErrorMessage message={loadError} onRetry={() => { setLoadError(null); loadUserProfile(); }} className="mission-bank-load-error" />}

      {/* UPDATED: MissionList component now automatically computes daily mission badges */}
      <MissionList
        missionType={getMissionType()}
        onMissionUpdate={handleMissionUpdate}
        showAddMission={showAddMission}
        onShowAddMission={handleShowAddMission}
        onHideAddMission={handleHideAddMission}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        recentlyCompletedMissions={recentlyCompletedMissions}
        onMissionCompletion={handleMissionCompletion}
        onMissionUncompletion={handleMissionUncompletion}
        onAchievementsUnlocked={(achievements) => setNewAchievements(achievements)}
      />

      {/* Filter Modal */}
      <MissionFilterModal
        isOpen={showFilterModal}
        onClose={handleHideFilters}
        currentFilters={filters}
        onApplyFilters={handleApplyFilters}
      />

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />
    </div>
  );
};

export default MissionBank;