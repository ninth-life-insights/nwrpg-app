// src/pages/SkillDetailPage.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, getSPProgressInLevel } from '../services/userService';
import { getActiveMissions, getCompletedMissions } from '../services/missionService';
import MissionCard from '../components/missions/MissionCard';
import MissionDetailView from '../components/missions/MissionCardFull';
import { completeMissionWithRecurrence, uncompleteMission } from '../services/missionService';
import AchievementToast from '../components/achievements/AchievementToast';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './SkillDetailPage.css';

const SP_PER_SKILL_LEVEL = 50;

const SkillDetailPage = () => {
  const { skillName } = useParams();
  const decodedSkillName = decodeURIComponent(skillName);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [skillData, setSkillData] = useState(null);
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [selectedMission, setSelectedMission] = useState(null);
  const [newAchievements, setNewAchievements] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const fetchData = async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your skill details didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setIsLoadingSlow(false);
    const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
    try {
      const [profile, activeMissions, completedMissions] = await withTimeout(
        Promise.all([
          getUserProfile(currentUser.uid),
          getActiveMissions(currentUser.uid),
          getCompletedMissions(currentUser.uid),
        ])
      );

      // Skill progress
      const saved = profile?.skills?.[decodedSkillName] || { totalSP: 0, level: 1 };
      const progress = getSPProgressInLevel(saved.totalSP);
      setSkillData({ ...saved, progress });

      // Filter missions by skill, active first then completed
      const filterBySkill = (list) =>
        list.filter((m) => m.skill === decodedSkillName);

      const filtered = [
        ...filterBySkill(activeMissions),
        ...filterBySkill(completedMissions),
      ];
      setMissions(filtered);
    } catch (error) {
      console.error('Error fetching skill detail data:', error);
      setLoadError(getLoadErrorMessage(error, 'skill details'));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsLoadingSlow(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUser, decodedSkillName]);

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    setActionError(null);
    try {
      if (isCurrentlyCompleted) {
        await uncompleteMission(currentUser.uid, missionId);
      } else {
        const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
        if (result?.leveledUp) {
          setLevelUpInfo({ newLevel: result.newLevel });
        }
        if (result?.skillLeveledUp) {
          setSkillLevelUpInfo({ skillName: result.skillName, newLevel: result.newSkillLevel });
        }
        if (result?.newlyAwardedAchievements?.length > 0) {
          setNewAchievements(result.newlyAwardedAchievements);
        }
      }
      // Refresh everything
      await fetchData();
      setSelectedMission(null);
    } catch (error) {
      console.error('Error toggling mission completion:', error);
      setActionError(isCurrentlyCompleted ? "That undo didn't go through. Try again." : "That mission didn't complete. Try again.");
    }
  };

  const handleDeleteMission = async (missionId) => {
    setActionError(null);
    try {
      const { deleteMission } = await import('../services/missionService');
      await deleteMission(currentUser.uid, missionId);
      setSelectedMission(null);
      await fetchData();
    } catch (error) {
      console.error('Error deleting mission:', error);
      setActionError("That mission didn't delete. Try again.");
    }
  };

  const handleUpdateMission = (updatedMission) => {
    setMissions((prev) =>
      prev.map((m) => (m.id === updatedMission.id ? updatedMission : m))
    );
    if (selectedMission?.id === updatedMission.id) {
      setSelectedMission(updatedMission);
    }
  };

  if (loading) {
    return (
      <div className="skill-detail-page">
        <div className="loading">
          Loading...
          {isLoadingSlow && <p className="loading-slow-hint">Still searching the realm...</p>}
        </div>
      </div>
    );
  }

  const progress = skillData?.progress;
  const level = skillData?.level || 1;
  const totalSP = skillData?.totalSP || 0;

  return (
    <div className="skill-detail-page">
      <header className="skill-detail-header">
        <button className="skill-detail-back-btn" onClick={() => navigate('/skills')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="skill-detail-title">{decodedSkillName}</h1>
        <div className="skill-detail-header-spacer" />
      </header>

      {loadError && (
        <ErrorMessage message={loadError} onRetry={() => { setLoadError(null); fetchData(); }} />
      )}
      {actionError && <ErrorMessage message={actionError} />}

      {/* Skill progress card */}
      <div className="skill-detail-progress-card">
        <div className="skill-detail-level-row">
          <span className="skill-detail-level-label">Level {level}</span>
          <span className="skill-detail-sp-label">
            {totalSP > 0 ? `${progress.current} / ${SP_PER_SKILL_LEVEL} SP` : 'No SP yet'}
          </span>
        </div>
        <div className="skill-detail-track">
          <div
            className="skill-detail-fill"
            style={{ width: `${totalSP > 0 ? progress.percentage : 0}%` }}
          />
        </div>
        <p className="skill-detail-hint">
          Complete missions tagged with this skill to earn SP.
        </p>
      </div>

      {/* Mission list */}
      <div className="skill-detail-missions">
        <h2 className="skill-detail-missions-heading">Missions</h2>
        {missions.length === 0 ? (
          <p className="skill-detail-empty">
            No missions tagged with this skill yet.
          </p>
        ) : (
          missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onToggleComplete={handleToggleComplete}
              onViewDetails={setSelectedMission}
            />
          ))
        )}
      </div>

      {selectedMission && (
        <MissionDetailView
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onToggleComplete={handleToggleComplete}
          onDeleteMission={handleDeleteMission}
          onUpdateMission={handleUpdateMission}
        />
      )}

      <AchievementToast
        achievements={newAchievements}
        onDismiss={() => setNewAchievements([])}
      />
    </div>
  );
};

export default SkillDetailPage;