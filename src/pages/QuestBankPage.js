// src/pages/QuestBankPage.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import QuestCard from '../components/quests/QuestCard';
import CreateQuestModal from '../components/quests/CreateQuestModal';
import { 
  getActiveQuests, 
  getCompletedQuests 
} from '../services/questService';
import { getAllMissions } from '../services/missionService';
import { getNextMission } from '../types/Quests';
import { completeMissionWithRecurrence } from '../services/missionService';
import './QuestBankPage.css';

const QuestBank = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [quests, setQuests] = useState([]);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddQuest, setShowAddQuest] = useState(false);
  const [includeCompleted, setIncludeCompleted] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadQuests();
      loadMissions();
    }
  }, [currentUser, includeCompleted]);

  const loadQuests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let questData = [];
      
      if (includeCompleted) {
        const [active, completed] = await Promise.all([
          getActiveQuests(currentUser.uid),
          getCompletedQuests(currentUser.uid)
        ]);
        questData = [...active, ...completed];
      } else {
        questData = await getActiveQuests(currentUser.uid);
      }
      
      setQuests(questData);
    } catch (err) {
      console.error('Error loading quests:', err);
      setError('Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const loadMissions = async () => {
    try {
      const missionData = await getAllMissions(currentUser.uid);
      setMissions(missionData);
    } catch (err) {
      console.error('Error loading missions:', err);
    }
  };

  const handleHomeButtonClick = () => {
    navigate('/home');
  };

  const handleShowAddQuest = () => {
    setShowAddQuest(true);
  };

  const handleCloseAddQuest = () => {
    setShowAddQuest(false);
  };

  const handleQuestCreated = async (newQuest) => {
    // Reload quests to show the new one
    await loadQuests();
  };

  const handleToggleCompleted = () => {
    setIncludeCompleted(!includeCompleted);
  };

  const handleMissionToggleComplete = async (missionId, isCurrentlyCompleted, xpReward) => {
    try {
      if (isCurrentlyCompleted) {
        // Handle uncompletion
        // TODO: Import and use uncompleteMission
      } else {
        await completeMissionWithRecurrence(currentUser.uid, missionId);
      }
      
      // Reload quests and missions to update progress
      await loadQuests();
      await loadMissions();
    } catch (err) {
      console.error('Error toggling mission completion:', err);
    }
  };

  const handleMissionViewDetails = (mission) => {
    // TODO: Open mission detail modal
    console.log('View mission details:', mission);
  };

  if (loading) {
    return (
      <div className="quest-bank-page">
        <div className="loading-state">Loading quests...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quest-bank-page">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="quest-bank-page">
      {/* Page Header */}
      <div className="quest-bank-header">
        <div className="top-header">
          <button className="home-button" onClick={handleHomeButtonClick}>
            Home
          </button>
          <h1>Quest Bank</h1>
        </div>
        
        <div className="header-actions">
          {/* Toggle Completed Filter */}
          <button
            onClick={handleToggleCompleted}
            className="filter-btn-header"
            title={includeCompleted ? "Hide Completed" : "Show Completed"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"></polygon>
            </svg>
          </button>
          
          {/* Add Quest Button */}
          <button
            onClick={handleShowAddQuest}
            className="add-quest-btn"
          >
            + Add Quest
          </button>
        </div>
      </div>

      {/* Quest List */}
      <div className="quest-list">
        {quests.length === 0 ? (
          <div className="empty-state">
            <p>No active quests. Create your first quest to get started!</p>
          </div>
        ) : (
          quests.map(quest => {
            const nextMission = getNextMission(quest, missions);
            
            return (
              <QuestCard
                key={quest.id}
                quest={quest}
                nextMission={nextMission}
                onMissionToggleComplete={handleMissionToggleComplete}
                onMissionViewDetails={handleMissionViewDetails}
              />
            );
          })
        )}
      </div>

      {/* Quest Creation Modal */}
      <CreateQuestModal
        isOpen={showAddQuest}
        onClose={handleCloseAddQuest}
        onQuestCreated={handleQuestCreated}
      />
    </div>
  );
};

export default QuestBank;