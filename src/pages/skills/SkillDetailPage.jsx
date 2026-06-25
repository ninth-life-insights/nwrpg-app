// src/pages/SkillDetailPage.js
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUserProfile, getSPProgressInLevel } from '../../services/userService';
import MissionCard from '../../components/missions/MissionCard';
import { uncompleteMission } from '../../services/missionService';
import { useMissionCompletion } from '../../contexts/MissionCompletionContext';
import { useMissions } from '../../contexts/MissionsContext';
import LoadingTransition from '../../components/ui/LoadingTransition';
import SkillDetailPageSkeleton from './SkillDetailPageSkeleton';
import { useNotifications } from '../../contexts/NotificationContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './SkillDetailPage.css';

const SKILL_HINTS = {
  'Caregiving': 'And yes, self-care counts too.',
  'Healing Arts': 'Boo-boo kisser, fever checker, mystery rash diagnoser. WebMD wishes it were you.',
  'Cleaning & Organizing': 'You clear the dungeon. The dungeon resets overnight. You clear it again.',
  'Crafting (DIY, Repairs, etc.)': 'Half skill, half YouTube tutorial, half sheer stubbornness.',
  'Foraging (Shopping, Deals, etc.)': 'The ancient art of coupon lore and clearance rack divination.',
  'Strategy & Tactics': 'Planning is your superpower. Flexibility is your backup superpower.',
  'Diplomacy & Negotiation': "Your thank-you notes could mend nations.",
  'Culinary Arts': 'Feeding a family three times a day, every day, forever. No big deal.',
  'Finances': 'Mastering the way of the budget.',
  'Fitness': 'Toddler to carry around not included.',
};

const SkillDetailPage = () => {
  const { skillName } = useParams();
  const decodedSkillName = decodeURIComponent(skillName);
  const { currentUser } = useAuth();
  const { completeMission: completeMissionOptimistic } = useMissionCompletion();
  const {
    missions: allMissions,
    isInitialLoading: missionsCacheLoading,
    refresh: refreshMissionsCache,
  } = useMissions();
  const navigate = useNavigate();

  const [skillData, setSkillData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { notifyAchievementsUnlocked } = useNotifications();
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Skill-scoped mission list: active first, then completed, both filtered to
  // this skill. Derived synchronously from the shared cache.
  const missions = useMemo(() => {
    if (allMissions == null) return [];
    const filterBySkill = (m) => m.skill === decodedSkillName;
    const active = allMissions.filter((m) => m.status === 'active' && filterBySkill(m));
    const completed = allMissions.filter((m) => m.status === 'completed' && filterBySkill(m));
    return [...active, ...completed];
  }, [allMissions, decodedSkillName]);

  const handleBack = () => navigate('/skills');
  useAndroidBackButton(handleBack);

  const fetchData = async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your skill details didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const profile = await withTimeout(getUserProfile(currentUser.uid));
      const saved = profile?.skills?.[decodedSkillName] || { totalSP: 0, level: 1 };
      const progress = getSPProgressInLevel(saved.totalSP);
      setSkillData({ ...saved, progress });
    } catch (error) {
      console.error('Error fetching skill detail data:', error);
      setLoadError(getLoadErrorMessage(error, 'skill details'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, decodedSkillName]);

  const handleToggleComplete = async (missionId, isCurrentlyCompleted) => {
    setActionError(null);

    if (isCurrentlyCompleted) {
      try {
        await uncompleteMission(currentUser.uid, missionId);
        await refreshMissionsCache();
        // Also re-fetch the profile so the SP/level display reflects the undo.
        await fetchData();
      } catch (error) {
        console.error('Error uncompleting mission:', error);
        setActionError("That undo didn't go through. Try again.");
      }
      return;
    }

    const mission = missions.find((m) => m.id === missionId);
    // MissionCompletionContext mutates the shared cache directly; the memo
    // above re-derives this skill's list on the same tick.
    completeMissionOptimistic(missionId, mission, {
      onResolved: () => {
        // Refresh the profile so the SP bar reflects the new earnings.
        fetchData();
      },
      onAchievementsResolved: (achievements) => {
        notifyAchievementsUnlocked(achievements);
      },
      onError: () => {
        setActionError("That mission didn't complete. Try again.");
      },
    });
  };

  const handleMissionChanged = () => {
    refreshMissionsCache();
  };

  const progress = skillData?.progress;
  const level = skillData?.level || 1;
  const totalSP = skillData?.totalSP || 0;

  return (
    <LoadingTransition loading={loading || missionsCacheLoading} skeleton={<SkillDetailPageSkeleton />}>
    <div className="skill-detail-page">
      <header className="skill-detail-header">
        <button className="skill-detail-back-btn" onClick={handleBack}>
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
            {totalSP > 0 ? `${progress.current} / ${progress.required} SP` : 'No SP yet'}
          </span>
        </div>
        <div className="skill-detail-track">
          <div
            className="skill-detail-fill"
            style={{ width: `${totalSP > 0 ? progress.percentage : 0}%` }}
          />
        </div>
        <p className="skill-detail-hint">
          {SKILL_HINTS[decodedSkillName] ?? 'Complete missions tagged with this skill to earn SP.'}
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
              onMissionChanged={handleMissionChanged}
            />
          ))
        )}
      </div>

    </div>
    </LoadingTransition>
  );
};

export default SkillDetailPage;
