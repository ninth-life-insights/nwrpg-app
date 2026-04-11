// src/components/review/AdventureLogCard.jsx
import { useNavigate } from 'react-router-dom';
import './AdventureLogCard.css';

// Format "2026-04-09" → "Wednesday, Apr 9"
const formatDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
};

// Full card — snapshot exists
const FullCard = ({ snapshot }) => {
  const navigate = useNavigate();
  const story = snapshot.userEditedStory ?? snapshot.aiStory ?? null;

  const hasLevelUp = snapshot.levelUps?.length > 0;
  const hasSkillLevelUp = snapshot.skillLevelUps?.length > 0;
  const hasQuestComplete = snapshot.questsCompleted?.length > 0;

  return (
    <button
      className="adventure-log-card adventure-log-card--full"
      onClick={() => navigate(`/adventure-log/${snapshot.date}`)}
    >
      <div className="alc-header">
        <span className="alc-date">{formatDate(snapshot.date)}</span>
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
          {hasQuestComplete && (
            <span className="alc-badge alc-badge--quest" title="Quest completed">
              <span className="material-icons">flag</span>
            </span>
          )}
        </div>
      </div>

      {story ? (
        <p className="alc-story">{story}</p>
      ) : (
        <p className="alc-story alc-story--empty">No chronicle for this day.</p>
      )}

      <div className="alc-stats">
        <span className="alc-stat">
          <span className="material-icons">check_circle</span>
          {snapshot.missionsCompleted} mission{snapshot.missionsCompleted !== 1 ? 's' : ''}
        </span>
        <span className="alc-stat">
          <span className="material-icons">bolt</span>
          +{snapshot.xpEarned} XP
        </span>
      </div>
    </button>
  );
};

// Placeholder card — activity exists but no snapshot
const PlaceholderCard = ({ date, missionCount, onGenerate, generating }) => (
  <div className="adventure-log-card adventure-log-card--placeholder">
    <div className="alc-header">
      <span className="alc-date alc-date--muted">{formatDate(date)}</span>
    </div>
    <p className="alc-placeholder-text">
      {missionCount} mission{missionCount !== 1 ? 's' : ''} completed
    </p>
    <button
      className="alc-generate-btn"
      onClick={() => onGenerate(date)}
      disabled={generating}
    >
      <span className="material-icons">auto_stories</span>
      {generating ? 'Generating...' : 'Generate entry'}
    </button>
  </div>
);

const AdventureLogCard = ({ entry, onGenerate, generatingDate }) => {
  if (entry.type === 'placeholder') {
    return (
      <PlaceholderCard
        date={entry.date}
        missionCount={entry.missionCount}
        onGenerate={onGenerate}
        generating={generatingDate === entry.date}
      />
    );
  }
  return <FullCard snapshot={entry} />;
};

export default AdventureLogCard;
