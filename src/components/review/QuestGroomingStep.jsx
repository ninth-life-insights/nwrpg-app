// src/components/review/QuestGroomingStep.jsx
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveQuests, getCompletedQuests, archiveQuest } from '../../services/questService';
import { getActiveMissions, completeMissionWithRecurrence } from '../../services/missionService';
import { getQuestActivityForWeek } from '../../services/weeklyReviewService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import QuestReviewCard from './QuestReviewCard';
import QuestDetailView from '../quests/QuestDetailView';
import { withTimeout, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import './QuestGroomingStep.css';

const QuestGroomingStep = ({
  weekInfo,        // { reviewedWeekStart, reviewedWeekEnd, nextWeekStart } — dayjs objects; may be null on first render
  onMissionComplete,
  onNext,
  onSkipToSummary,
}) => {
  const { currentUser } = useAuth();
  const [quests, setQuests] = useState([]);
  const [recentlyCompletedQuests, setRecentlyCompletedQuests] = useState([]);
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
        getCompletedQuests(currentUser.uid),
      ];
      if (weekStart && weekEnd) {
        fetches.push(getQuestActivityForWeek(currentUser.uid, weekStart, weekEnd));
      }

      const [activeQuests, allMissions, completedQuests, weeklyActivity = {}] = await withTimeout(
        Promise.all(fetches)
      );

      // Group missions by questId, then sort each group by its quest's own
      // missionOrder. quest.missionOrder is the authoritative within-quest
      // ordering (set by reorderQuestMissions and the create-quest flow);
      // customSortOrder is a different signal (manual ordering in the
      // Mission Bank surface), so using it here would show missions in
      // bank-order rather than quest-order.
      const byQuest = {};
      const orderByQuestId = {};
      activeQuests.forEach(q => {
        byQuest[q.id] = [];
        orderByQuestId[q.id] = q.missionOrder || [];
      });
      allMissions.forEach(m => {
        if (m.questId && byQuest[m.questId]) byQuest[m.questId].push(m);
      });
      Object.keys(byQuest).forEach(qId => {
        const order = orderByQuestId[qId];
        byQuest[qId].sort((a, b) => {
          const aIdx = order.indexOf(a.id);
          const bIdx = order.indexOf(b.id);
          // Missions not in the order array (drift edge case) sort to the end.
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        });
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

      // Filter completed quests to only those completed within the reviewed week
      const recentlyDone = weekStart && weekEnd
        ? completedQuests.filter(q => {
            if (!q.completedAt) return false;
            const completedMs = q.completedAt.toMillis?.() ?? q.completedAt.seconds * 1000;
            const completedDate = new Date(completedMs).toISOString().slice(0, 10);
            return completedDate >= weekStart && completedDate <= weekEnd;
          })
        : [];

      setQuests(sortedQuests);
      setRecentlyCompletedQuests(recentlyDone);
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
      return result;
    } catch (err) {
      console.error('Error completing mission:', err);
      return null;
    }
  };

  const handleModalClose = useCallback(() => {
    setOpenQuestId(null);
    // Reload so progress bars reflect any completions made inside the modal
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useModalBackButton(!!openQuestId, handleModalClose);

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

        {!loading && !loadError && quests.length === 0 && recentlyCompletedQuests.length === 0 && (
          <p className="review-step-empty">No active quests. Head to the next step.</p>
        )}

        {!loading && !loadError && recentlyCompletedQuests.length > 0 && (
          <div className="qgs-completed-section">
            {recentlyCompletedQuests.map(quest => (
              <div key={quest.id}>
                <QuestReviewCard
                  quest={quest}
                  weeklyStats={weeklyStatsByQuest[quest.id] ?? null}
                  isRecentlyCompleted
                  onViewMissions={(qId) => setOpenQuestId(qId)}
                  onArchive={handleArchiveQuest}
                />
              </div>
            ))}
          </div>
        )}

        {!loading && !loadError && quests.map(quest => (
          <div key={quest.id}>
            <QuestReviewCard
              quest={quest}
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

      {openQuestId && createPortal(
        <div className="quest-detail-modal-overlay" onClick={handleModalClose}>
          <div className="quest-detail-modal-sheet" onClick={e => e.stopPropagation()}>
            <QuestDetailView
              questId={openQuestId}
              onClose={handleModalClose}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default QuestGroomingStep;
