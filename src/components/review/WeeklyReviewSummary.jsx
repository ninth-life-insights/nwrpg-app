// src/components/review/WeeklyReviewSummary.jsx
import { useState, useEffect, useRef } from 'react';
import { getUserProfile } from '../../services/userService';
import { generateWeeklySnapshot } from '../../services/weeklyReviewService';
import { getAllMissions } from '../../services/missionService';
import { getRooms, ENTIRE_BASE_ROOM_ID } from '../../services/roomService';
import { formatWeekLabel } from '../../utils/weeklyReviewHelpers';
import dayjs from 'dayjs';
import './WeeklyReviewSummary.css';

// ─── Per-day mini grid ────────────────────────────────────────────────────────

const DayGrid = ({ dailyBreakdown }) => {
  if (!dailyBreakdown?.length) return null;

  return (
    <div className="wrs-day-grid">
      {dailyBreakdown.map(day => {
        const label = dayjs(day.date).format('dd').charAt(0);
        const count = day.missionsCompleted;
        const active = count > 0;
        return (
          <div
            key={day.date}
            className={`wrs-day-cell ${active ? 'wrs-day-cell--active' : ''} ${day.hasDailyReview ? 'wrs-day-cell--reviewed' : ''}`}
            title={`${dayjs(day.date).format('ddd MMM D')}: ${count} mission${count !== 1 ? 's' : ''}${day.hasDailyReview ? ' · daily review done' : ''}`}
          >
            <span className="wrs-day-letter">{label}</span>
            <span className="wrs-day-count">{active ? count : '·'}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const WeeklyReviewSummary = ({
  snapshot,
  loading,
  onDone,
  onUpdateStory,
  onRegenerateStory,
  userId,
  weekStart,
  weekEnd,
}) => {
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyDraft, setStoryDraft] = useState('');
  const [savingStory, setSavingStory] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [topRooms, setTopRooms] = useState([]);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!userId || !weekStart || !weekEnd) return;
    let cancelled = false;

    const loadRoomActivity = async () => {
      try {
        const [missions, rooms, profile] = await Promise.all([
          getAllMissions(userId),
          getRooms(userId),
          getUserProfile(userId),
        ]);

        const baseName = profile?.baseName || '';
        const roomNameMap = Object.fromEntries(
          rooms.map(r => [
            r.id,
            r.id === ENTIRE_BASE_ROOM_ID ? (baseName || r.name) : r.name,
          ])
        );

        const counts = {};
        missions.forEach(m => {
          if (!m.baseLocation || m.status !== 'completed' || !m.completedAt) return;
          const completedDate = m.completedAt.toDate ? m.completedAt.toDate() : new Date(m.completedAt);
          const dateStr = dayjs(completedDate).format('YYYY-MM-DD');
          if (dateStr < weekStart || dateStr > weekEnd) return;
          counts[m.baseLocation] = (counts[m.baseLocation] || 0) + 1;
        });

        const ranked = Object.entries(counts)
          .filter(([roomId]) => roomNameMap[roomId])
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([roomId, count]) => {
            const room = rooms.find(r => r.id === roomId);
            return { roomId, name: roomNameMap[roomId], icon: room?.icon ?? 'home', count };
          });

        if (!cancelled) setTopRooms(ranked);
      } catch (err) {
        console.error('Error loading room activity for summary:', err);
      }
    };

    loadRoomActivity();
    return () => { cancelled = true; };
  }, [userId, weekStart, weekEnd]);

  useEffect(() => {
    if (isEditingStory && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditingStory]);

  if (loading) {
    return (
      <div className="review-step">
        <div className="daily-review-loading">
          <p>Writing up your week...</p>
        </div>
      </div>
    );
  }

  if (!snapshot) return null;

  const displayStory = snapshot.userEditedStory ?? snapshot.aiStory ?? null;
  const daysActive = snapshot.dailyBreakdown?.filter(d => d.missionsCompleted > 0).length ?? 0;

  const weekLabel = weekStart && weekEnd
    ? formatWeekLabel(dayjs(weekStart), dayjs(weekEnd))
    : null;

  const handleEditStart = () => {
    setStoryDraft(displayStory || '');
    setIsEditingStory(true);
    setStoryExpanded(true);
  };

  const handleSaveStory = async () => {
    if (savingStory) return;
    setSavingStory(true);
    try {
      await onUpdateStory(storyDraft);
      setIsEditingStory(false);
    } catch (err) {
      console.error('Error saving story:', err);
    } finally {
      setSavingStory(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setShowRegenerateConfirm(false);
    try {
      const profile = await getUserProfile(userId);
      const displayName = profile?.displayName || 'You';
      const newSnapshot = await generateWeeklySnapshot(userId, weekStart, weekEnd, displayName, { forceNewStory: true });
      onRegenerateStory?.(newSnapshot.aiStory);
    } catch (err) {
      console.error('Error regenerating weekly story:', err);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="review-step">
      <div className="review-step-body">

        {weekLabel && (
          <p className="wrs-week-label">{weekLabel}</p>
        )}

        {/* Per-day grid */}
        <DayGrid dailyBreakdown={snapshot.dailyBreakdown} />

        {/* Stats */}
        <div className="daily-review-stats wrs-stats">
          <div className="stat-card">
            <span className="stat-number">{snapshot.totalMissionsCompleted}</span>
            <span className="stat-label">Missions Done</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">+{snapshot.totalXpEarned}</span>
            <span className="stat-label">XP Earned</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{daysActive}/7</span>
            <span className="stat-label">Days Active</span>
          </div>
        </div>

        {/* Chronicle */}
        <div className="daily-review-story">
          <div className="daily-review-story-header">
            <span className="daily-review-story-label">This Week's Chronicle</span>
            {!isEditingStory && (
              <div className="daily-review-story-actions-row">
                {onRegenerateStory !== undefined && (
                  <button
                    className="daily-review-story-edit-btn"
                    onClick={() => setShowRegenerateConfirm(true)}
                    disabled={regenerating}
                    title="Regenerate chronicle"
                  >
                    <span className="material-icons">
                      {regenerating ? 'hourglass_empty' : 'refresh'}
                    </span>
                  </button>
                )}
                <button className="daily-review-story-edit-btn" onClick={handleEditStart}>
                  <span className="material-icons">edit</span>
                </button>
              </div>
            )}
          </div>

          {showRegenerateConfirm && (
            <div className="daily-review-story-confirm">
              <p>Rewrite the chronicle? This will overwrite your current entry.</p>
              <div className="daily-review-story-actions">
                <button
                  className="story-action-btn story-action-btn--save"
                  onClick={handleRegenerate}
                >
                  Regenerate
                </button>
                <button
                  className="story-action-btn story-action-btn--cancel"
                  onClick={() => setShowRegenerateConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isEditingStory ? (
            <div className="daily-review-story-editor">
              <textarea
                ref={textareaRef}
                className="daily-review-story-textarea"
                value={storyDraft}
                onChange={e => setStoryDraft(e.target.value)}
                placeholder="Write your own notes for the week..."
                rows={7}
              />
              <div className="daily-review-story-actions">
                <button
                  className="story-action-btn story-action-btn--save"
                  onClick={handleSaveStory}
                  disabled={savingStory}
                >
                  {savingStory ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="story-action-btn story-action-btn--cancel"
                  onClick={() => setIsEditingStory(false)}
                  disabled={savingStory}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : displayStory ? (
            <>
              <div className={`daily-review-story-body ${storyExpanded ? 'daily-review-story-body--expanded' : ''}`}>
                <p>{displayStory}</p>
              </div>
              {!storyExpanded && <div className="daily-review-story-fade" />}
              <button
                className="daily-review-story-toggle"
                onClick={() => setStoryExpanded(prev => !prev)}
              >
                {storyExpanded ? 'Show less' : 'Read more'}
                <span className="material-icons">
                  {storyExpanded ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </>
          ) : (
            <p className="daily-review-story-empty">
              No chronicle generated. Add your own notes above.
            </p>
          )}
        </div>

        {/* Level ups */}
        {snapshot.levelUps?.length > 0 && (
          <div className="daily-review-section daily-review-section--highlight">
            <p className="level-up-callout">
              Reached Level {snapshot.levelUps[snapshot.levelUps.length - 1].newLevel}
            </p>
          </div>
        )}

        {/* Skills */}
        {snapshot.skillsUsed?.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Skills Practiced</h3>
            <div className="skills-practiced-list">
              {snapshot.skillsUsed.map(skill => (
                <div key={skill.name} className="skill-row">
                  <span className="skill-row-name">{skill.name}</span>
                  <span className="skill-row-sp">+{skill.spEarned} SP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quests */}
        {snapshot.questsAdvanced?.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Quests Advanced</h3>
            <div className="quests-list">
              {snapshot.questsAdvanced.map(quest => (
                <div key={quest.questId} className="quest-row">
                  <span className="quest-row-title">{quest.questTitle}</span>
                  <span className="quest-row-count">
                    {quest.missionsCompleted} mission{quest.missionsCompleted !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Base */}
        {topRooms.length > 0 && (
          <div className="daily-review-section">
            <h3 className="daily-review-section-title">Base Activity</h3>
            <div className="wrs-room-grid">
              {topRooms.map(({ roomId, name, icon, count }) => (
                <div key={roomId} className="wrs-room-cell">
                  <div className="wrs-room-icon">
                    {icon.includes('.')
                      ? <img src={`/assets/Rooms/${icon}`} alt="" className="wrs-room-img" />
                      : <span className="material-icons wrs-room-material-icon">{icon}</span>
                    }
                  </div>
                  <span className="wrs-room-name">{name}</span>
                  <span className="wrs-room-count">{count} mission{count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {onDone && (
        <div className="review-step-footer">
          <button className="daily-review-done-btn" onClick={onDone}>
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default WeeklyReviewSummary;
