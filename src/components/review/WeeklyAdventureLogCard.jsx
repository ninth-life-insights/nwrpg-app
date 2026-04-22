// src/components/review/WeeklyAdventureLogCard.jsx
import { useNavigate } from 'react-router-dom';
import { formatWeekLabel } from '../../utils/weeklyReviewHelpers';
import dayjs from 'dayjs';
import './AdventureLogCard.css';
import './WeeklyAdventureLogCard.css';

const WeeklyAdventureLogCard = ({ snapshot }) => {
  const navigate = useNavigate();
  const story = snapshot.userEditedStory ?? snapshot.aiStory ?? null;

  const weekLabel = snapshot.weekStart && snapshot.weekEnd
    ? formatWeekLabel(dayjs(snapshot.weekStart), dayjs(snapshot.weekEnd))
    : snapshot.weekStart || '';

  const daysActive = snapshot.dailyBreakdown?.filter(d => d.missionsCompleted > 0).length ?? 0;
  const hasLevelUp = snapshot.levelUps?.length > 0;
  const hasSkillLevelUp = snapshot.skillLevelUps?.length > 0;

  return (
    <button
      className="walc-card"
      onClick={() => navigate(`/adventure-log/weekly/${snapshot.weekStart}`)}
    >
      <div className="walc-header">
        <div className="walc-header-left">
          <span className="walc-pill">Weekly Review</span>
          <span className="walc-week-label">{weekLabel}</span>
        </div>
        <div className="alc-badges">
          {hasLevelUp && (
            <span className="alc-badge alc-badge--levelup" title="Leveled up">
              <span className="material-icons">star</span>
            </span>
          )}
          {hasSkillLevelUp && (
            <span className="alc-badge alc-badge--skill" title="Skill level up">
              <span className="material-icons">trending_up</span>
            </span>
          )}
        </div>
      </div>

      {story ? (
        <p className="alc-story walc-story">{story}</p>
      ) : (
        <p className="alc-story alc-story--empty walc-story">No chronicle for this week.</p>
      )}

      <div className="alc-stats">
        <span className="alc-stat">
          <span className="material-icons">check_circle</span>
          {snapshot.totalMissionsCompleted} mission{snapshot.totalMissionsCompleted !== 1 ? 's' : ''}
        </span>
        <span className="alc-stat">
          <span className="material-icons">bolt</span>
          +{snapshot.totalXpEarned} XP
        </span>
        <span className="alc-stat">
          <span className="material-icons">calendar_today</span>
          {daysActive}/7 days
        </span>
      </div>
    </button>
  );
};

export default WeeklyAdventureLogCard;
