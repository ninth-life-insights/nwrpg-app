// src/components/review/DailyMissionsStep.jsx
import { useState } from 'react';
import MissionCard from '../missions/MissionCard';
import EditDailyMissionsModal from '../missions/EditDailyMissionsModal';

const DailyMissionsStep = ({
  dailyMissions,
  onToggleComplete,
  onMissionsUpdated,
  onNext,
  onSkipToSummary,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);

  const completed = dailyMissions.filter(m => m.status === 'completed').length;
  const total = dailyMissions.length;

  const handleModalSave = async () => {
    await onMissionsUpdated();
    setShowEditModal(false);
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">How'd your missions go today?</h2>

        {total === 0 ? (
          <p className="review-step-empty">No daily missions were set for today.</p>
        ) : (
          <div className="review-missions-list">
            {dailyMissions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onToggleComplete={onToggleComplete}
                onViewDetails={() => {}}
                hideDailyBadge={true}
              />
            ))}
          </div>
        )}

        {total > 0 && (
          <p className="review-mission-count">
            {completed} of {total} mission{total !== 1 ? 's' : ''} completed
          </p>
        )}

        <button
          className="review-edit-missions-link"
          onClick={() => setShowEditModal(true)}
        >
          It's never too late to pivot — edit your priorities?
        </button>
      </div>

      <div className="review-step-footer">
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Just show me my summary
        </button>
      </div>

      {showEditModal && (
        <EditDailyMissionsModal
          currentDailyMissions={dailyMissions}
          onClose={() => setShowEditModal(false)}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default DailyMissionsStep;
