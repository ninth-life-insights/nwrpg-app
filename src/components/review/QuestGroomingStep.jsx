// src/components/review/QuestGroomingStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveQuests, archiveQuest } from '../../services/questService';
import { getActiveMissions, completeMissionWithRecurrence } from '../../services/missionService';
import { getQuestActivityForWeek } from '../../services/weeklyReviewService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import QuestReviewCard from './QuestReviewCard';
import QuestMissionsModal from './QuestMissionsModal';
import { withTimeout, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import './QuestGroomingStep.css';

const QuestGroomingStep = ({
  weekInfo,        // { reviewedWeekStart, reviewedWeekEnd, nextWeekStart } — dayjs objects; may be null on first render
  onMissionComplete,
  onNext,
  onSkipToSummary,
}) => {
  const { currentUser } = useAuth();
  const [quests, setQuests] = useState([]);
  const [missionsByQuest, setMissionsByQuest] = useState({});
  const [weeklyStatsByQuest, setWeeklyStatsByQuest] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [questActionError, setQuestActionError] = useState({});
  const [openQuestId, setOpenQuestId] = useState(null);   // which quest's modal is open

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const weekStart = weekInfo?.reviewedWeekStart?.format('YYYY-MM-DD') ?? null;
      const weekEnd   = weekInfo?.reviewedWeekEnd?.format('YYYY-MM-DD') ?? null;

      const fetches = [
        getActiveQuests(currentUser.uid),
        getActiveMissions(currentUser.uid),
      ];
      if (weekStart && weekEnd) {
        fetches.push(getQuestActivityForWeek(currentUser.uid, weekStart, weekEnd));
      }

      const [activeQuests, allMissions, weeklyActivity = {}] = await withTimeout(
        Promise.all(fetches)
      );

      // Group missions by questId, sort by customSortOrder
      const byQuest = {};
      activeQuests.forEach(q => { byQuest[q.id] = []; });
      allMissions.forEach(m => {
        if (m.questId && byQuest[m.questId]) byQuest[m.questId].push(m);
      });
      Object.keys(byQuest).forEach(qId => {
        byQuest[qId].sort((a, b) => (a.customSortOrder ?? 0) - (b.customSortOrder ?? 0));
      });

      // Sort quests by weekly activity: volume desc, then recency desc, then alphabetically
      const sortedQuests = [...activeQuests].sort((a, b) => {
        const aStats = weeklyActivity[a.id] ?? { count: 0, lastTimestampMs: 0 };
        const bStats = weeklyActivity[b.id] ?? { count: 0, lastTimestampMs: 0 };
        if (bStats.count !== aStats.count) return bStats.count - aStats.count;
        if (bStats.lastTimestampMs !== aStats.lastTimestampMs) {
          return bStats.lastTimestampMs - aStats.lastTimestampMs;
        }
        return a.title.localeCompare(b.title);
      });

      setQuests(sortedQuests);
      setMissionsByQuest(byQuest);
      setWeeklyStatsByQuest(weeklyActivity);
    } catch (err) {
      console.error('Error loading quest grooming data:', err);
      setLoadError(getLoadErrorMessage(err, 'quests'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser, weekInfo]);

  const handleMissionComplete = async (missionId) => {
    try {
      const result = await completeMissionWithRecurrence(currentUser.uid, missionId);
      onMissionComplete?.(result);
      // Update local mission state
      setMissionsByQuest(prev => {
        const updated = { ...prev };
        for (const qId of Object.keys(updated)) {
          updated[qId] = updated[qId].map(m =>
            m.id === missionId ? { ...m, status: 'completed' } : m
          );
        }
        return updated;
      });
      return result;
    } catch (err) {
      console.error('Error completing mission:', err);
      return null;
    }
  };

  const handleArchiveQuest = async (questId) => {
    setQuestActionError(prev => ({ ...prev, [questId]: null }));
    try {
      await archiveQuest(currentUser.uid, questId);
      setQuests(prev => prev.filter(q => q.id !== questId));
      // Close modal if open for this quest
      if (openQuestId === questId) setOpenQuestId(null);
    } catch (err) {
      console.error('Error archiving quest:', err);
      setQuestActionError(prev => ({
        ...prev,
        [questId]: "That quest didn't archive. Try again.",
      }));
    }
  };

  const openQuest = quests.find(q => q.id === openQuestId) ?? null;
  const openMissions = openQuestId ? (missionsByQuest[openQuestId] ?? []) : [];

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Quest Check-In</h2>
        <p className="review-step-subtext">
          Review your active quests. See what moved this week, complete missions, or archive anything that's stalled.
        </p>

        {loadError && (
          <ErrorMessage message={loadError} onRetry={loadData} />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Loading your quests...</p>
        )}

        {!loading && !loadError && quests.length === 0 && (
          <p className="review-step-empty">No active quests. Head to the next step.</p>
        )}

        {!loading && !loadError && quests.map(quest => (
          <div key={quest.id}>
            <QuestReviewCard
              quest={quest}
              missions={missionsByQuest[quest.id] ?? []}
              weeklyStats={weeklyStatsByQuest[quest.id] ?? null}
              onViewMissions={(qId) => setOpenQuestId(qId)}
              onArchive={handleArchiveQuest}
            />
            {questActionError[quest.id] && (
              <ErrorMessage message={questActionError[quest.id]} />
            )}
          </div>
        ))}
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Skip to summary
        </button>
      </StickyFooter>

      {openQuest && (
        <QuestMissionsModal
          quest={openQuest}
          missions={openMissions}
          onMissionComplete={handleMissionComplete}
          onClose={() => setOpenQuestId(null)}
        />
      )}
    </div>
  );
};

export default QuestGroomingStep;
