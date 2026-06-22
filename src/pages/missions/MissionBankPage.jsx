// src/pages/MissionBank.js - UPDATED FOR SIMPLIFIED DAILY MISSIONS
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../contexts/TutorialContext';
import MissionList from '../../components/missions/MissionList';
import MissionFilterModal from '../../components/missions/sub-components/MissionFilterModal';
import EditDailyMissionsModal from '../../components/missions/EditDailyMissionsModal';
import { getUserProfile } from '../../services/userService';
import { getRooms } from '../../services/roomService';
import { getAllQuests } from '../../services/questService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AchievementToast from '../../components/achievements/AchievementToast';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './MissionBankPage.css';

const MissionBank = () => {
  const { currentUser } = useAuth();
  const { triggerStep } = useTutorial();
  useEffect(() => {
    triggerStep('mission-bank');
    return () => triggerStep(null);
  }, [triggerStep]);
  const [userProfile, setUserProfile] = useState(null);
  const [showAddMission, setShowAddMission] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDailyPlanning, setShowDailyPlanning] = useState(false);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    sortBy: searchParams.get('sort') || 'custom',
    sortOrder: 'asc',
    skillFilter: '',
    includeCompleted: false,
    showArchive: false,
    completedDateRange: 'last7days',
    roomFilter: '',
    taskTypeFilter: '',
    questFilter: '',
    priorityFilter: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [rooms, setRooms] = useState([]);
  const [quests, setQuests] = useState([]);

  // State to track recently completed missions
  const [recentlyCompletedMissions, setRecentlyCompletedMissions] = useState([]);
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const navigate = useNavigate();

  const HomeButtonClick = () => {
    navigate('/home');
  };
  useAndroidBackButton(HomeButtonClick);

  // Load user profile, rooms, and quests when component mounts or user changes
  useEffect(() => {
    if (currentUser) {
      loadUserProfile();
      loadFilterData();
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

  const loadFilterData = async () => {
    try {
      const [roomData, questData] = await Promise.all([
        getRooms(currentUser.uid),
        getAllQuests(currentUser.uid)
      ]);
      setRooms(roomData || []);
      setQuests(questData || []);
    } catch (err) {
      console.error('Error loading filter data:', err);
      // Quiet failure — filters just won't populate
    }
  };

  const handleMissionUpdate = () => {
    // Reload user profile to get updated XP/level
    loadUserProfile();
  };

  // Handle mission completion updates
  const handleMissionCompletion = (completedMission, levelUpData, skillLevelUpData) => {
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

  // Patch a recently-completed mission's cached fields when something edits
  // them post-completion (e.g. backdating completedAt). Without this, the
  // snapshot captured at completion time would mask the new value because
  // getActiveMissions doesn't return completed missions on reload.
  const handleRecentlyCompletedUpdated = (missionId, partialUpdate) => {
    setRecentlyCompletedMissions(prev =>
      prev.map(m => m.id === missionId ? { ...m, ...partialUpdate } : m)
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

  const handleResetFilters = () => {
    setRecentlyCompletedMissions([]);
    setFilters({
      sortBy: 'custom',
      sortOrder: 'asc',
      skillFilter: '',
      includeCompleted: false,
      showArchive: false,
      completedDateRange: 'last7days',
      roomFilter: '',
      taskTypeFilter: '',
      questFilter: '',
      priorityFilter: ''
    });
    setSearchQuery('');
  };

  const getMissionType = () => {
    if (filters.showArchive) return 'expired';
    if (filters.includeCompleted) return 'active_completed';
    return 'active';
  };

  const hasActiveFilters =
    filters.sortBy !== 'custom' ||
    filters.sortOrder !== 'asc' ||
    filters.skillFilter !== '' ||
    filters.includeCompleted !== false ||
    filters.showArchive !== false ||
    filters.roomFilter !== '' ||
    filters.taskTypeFilter !== '' ||
    filters.questFilter !== '' ||
    filters.priorityFilter !== '' ||
    searchQuery !== '';

  return (
    <div className="mission-bank-page">
      {/* Page Header */}
      <div className="mission-bank-header">
        <div className="top-header">
          <button className="home-button" onClick={HomeButtonClick} aria-label="Back to home">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1>Mission Bank</h1>
          <button
            onClick={() => setShowDailyPlanning(true)}
            className="filter-btn-header"
            title="Plan today's missions"
            aria-label="Plan today's missions"
          >
            <span className="material-icons">sunny</span>
          </button>
        </div>
      </div>

      {/* Search + filter row */}
      <div className="mission-bank-search-row">
        <div className="mission-bank-search">
          <span className="material-icons search-icon">search</span>
          <input
            type="text"
            className="mission-bank-search-input"
            placeholder="Search missions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>

        <button
          onClick={handleShowFilters}
          className={`filter-btn-header${hasActiveFilters ? ' filter-btn-active' : ''}`}
          title="Filter & Sort"
          aria-label="Filter & Sort"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
          </svg>
          {hasActiveFilters && <span className="filter-active-dot" />}
        </button>
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
        searchQuery={searchQuery}
        onApplyFilters={handleApplyFilters}
        onResetFilters={handleResetFilters}
        recentlyCompletedMissions={recentlyCompletedMissions}
        onMissionCompletion={handleMissionCompletion}
        onMissionUncompletion={handleMissionUncompletion}
        onRecentlyCompletedUpdated={handleRecentlyCompletedUpdated}
        onAchievementsUnlocked={(achievements) => setNewAchievements(achievements)}
      />

      {/* Filter Modal */}
      <MissionFilterModal
        isOpen={showFilterModal}
        onClose={handleHideFilters}
        currentFilters={filters}
        onApplyFilters={handleApplyFilters}
        rooms={rooms}
        quests={quests}
        baseName={userProfile?.baseName || ''}
      />

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />

      {/* Floating "Add Mission" — primary create action lives in the thumb zone */}
      <button
        type="button"
        className="add-mission-fab"
        onClick={handleShowAddMission}
        aria-label="Add Mission"
      >
        <span className="material-icons">add</span>
        Add Mission
      </button>

      {/* Daily planning modal */}
      {showDailyPlanning && (
        <EditDailyMissionsModal
          onClose={() => setShowDailyPlanning(false)}
        />
      )}
    </div>
  );
};

export default MissionBank;