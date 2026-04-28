// src/components/review/WeekPlanningStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDailyMissionsForDate,
} from '../../services/dailyMissionService';
import { getActiveMissions } from '../../services/missionService';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import EditDailyMissionsModal from '../missions/EditDailyMissionsModal';
import DayLookAheadModal from './DayLookAheadModal';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import dayjs from 'dayjs';
import { toDateString } from '../../utils/dateHelpers';
import { withTimeout } from '../../utils/fetchWithTimeout';
import './WeekPlanningStep.css';

// ─── Day card ─────────────────────────────────────────────────────────────────

const DayCard = ({
  date,             // dayjs
  missionsDue,      // missions with dueDate === dateStr
  plannedMissions,  // full mission objects that are planned for this day
  isToday,
  onPlanSaved,      // () => void — parent reloads after save
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showLookAheadModal, setShowLookAheadModal] = useState(false);

  const dateStr = date.format('YYYY-MM-DD');
  const dayAbbr = date.format('ddd');
  const dayDate = date.format('MMM D');
  const plannedCount = plannedMissions.length;
  const dueCount = missionsDue.length;

  return (
    <>
      <div className={`wp-day-card ${isToday ? 'wp-day-card--today' : ''} ${isOpen ? 'wp-day-card--open' : ''}`}>
        {/* Clickable header row */}
        <button className="wp-day-card-header" onClick={() => setIsOpen(o => !o)}>
          <div className="wp-day-name-group">
            <span className="wp-day-abbr">{dayAbbr}</span>
            <span className="wp-day-fulldate">{dayDate}</span>
          </div>
          <div className="wp-badges-row">
            {dueCount > 0 && (
              <span className="wp-due-badge">{dueCount} due</span>
            )}
            <span className={`wp-planned-badge ${plannedCount > 0 ? 'wp-planned-badge--set' : ''}`}>
              {plannedCount}/3 daily
            </span>
            <span className="material-icons wp-day-chevron">
              {isOpen ? 'expand_less' : 'expand_more'}
            </span>
          </div>
        </button>

        {/* Expanded body */}
        {isOpen && (
          <div className="wp-day-card-body">
            {plannedMissions.length > 0 && (
              <div className="wp-planned-missions">
                {plannedMissions.map(m => (
                  <MissionCardCondensed
                    key={m.id}
                    mission={m}
                    onToggleComplete={() => {}}
                    onViewDetails={() => {}}
                  />
                ))}
              </div>
            )}

            <div className="wp-day-card-actions">
              <button
                className="wp-plan-btn"
                onClick={() => setShowPlanModal(true)}
              >
                Plan Priorities
              </button>
              <button
                className="wp-lookahead-btn"
                onClick={() => setShowLookAheadModal(true)}
              >
                Look Ahead &rsaquo;
              </button>
            </div>
          </div>
        )}
      </div>

      {showPlanModal && (
        <EditDailyMissionsModal
          initialTargetDate={dateStr}
          allowPartialSave
          onClose={() => {
            setShowPlanModal(false);
            onPlanSaved?.();
          }}
        />
      )}

      {showLookAheadModal && (
        <DayLookAheadModal
          date={date}
          missions={missionsDue}
          onClose={() => setShowLookAheadModal(false)}
          onUpdate={onPlanSaved}
        />
      )}
    </>
  );
};

// ─── Main step ────────────────────────────────────────────────────────────────

const WeekPlanningStep = ({ weekInfo, onNext, onSkipToSummary }) => {
  const { currentUser } = useAuth();
  const [allMissions, setAllMissions] = useState([]);
  const [plannedByDate, setPlannedByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const today = toDateString(new Date());
  const weekDates = weekInfo?.nextWeekStart
    ? Array.from({ length: 7 }, (_, i) => dayjs(weekInfo.nextWeekStart).add(i, 'day'))
    : [];

  const load = async () => {
    if (!currentUser || weekDates.length === 0) return;
    setLoadError(null);
    setLoading(true);
    try {
      const dateStrings = weekDates.map(d => d.format('YYYY-MM-DD'));
      const [missions, ...historyResults] = await withTimeout(
        Promise.all([
          getActiveMissions(currentUser.uid),
          ...dateStrings.map(ds => getDailyMissionsForDate(currentUser.uid, ds)),
        ])
      );
      setAllMissions(missions);
      const planned = {};
      dateStrings.forEach((ds, i) => {
        planned[ds] = historyResults[i]?.selectedMissionIds || [];
      });
      setPlannedByDate(planned);
    } catch (err) {
      console.error('Error loading week planning data:', err);
      setLoadError("Your mission bank didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [currentUser, weekInfo]);

  // Group missions by due date for the look-ahead modals
  const missionsDueByDate = {};
  weekDates.forEach(d => {
    const ds = d.format('YYYY-MM-DD');
    missionsDueByDate[ds] = allMissions.filter(m => m.dueDate === ds);
  });

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Plan the Week Ahead</h2>
        <p className="review-step-subtext">
          Set your daily priorities for the coming week from a bird's eye view. 
        </p>

        {loadError && (
          <ErrorMessage
            message={loadError}
            onRetry={load}
          />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Loading missions...</p>
        )}

        {!loading && !loadError && weekDates.map(date => {
          const dateStr = date.format('YYYY-MM-DD');
          const plannedIds = plannedByDate[dateStr] || [];
          const plannedMissions = plannedIds
            .map(id => allMissions.find(m => m.id === id))
            .filter(Boolean);
          return (
            <DayCard
              key={dateStr}
              date={date}
              missionsDue={missionsDueByDate[dateStr] || []}
              plannedMissions={plannedMissions}
              isToday={dateStr === today}
              onPlanSaved={load}
            />
          );
        })}
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Skip to summary
        </button>
      </StickyFooter>
    </div>
  );
};

export default WeekPlanningStep;
