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
import dayjs from 'dayjs';
import { toDateString } from '../../utils/dateHelpers';
import { withTimeout } from '../../utils/fetchWithTimeout';
import './WeekPlanningStep.css';

// ─── Day card ─────────────────────────────────────────────────────────────────

const DayCard = ({
  date,           // dayjs
  missionsDue,    // missions with dueDate === dateStr
  initialPlannedIds,
  isToday,
  onPlanSaved,    // () => void — parent reloads after save
  onError,        // (msg) => void
}) => {
  const [plannedIds, setPlannedIds] = useState(initialPlannedIds || []);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showLookAheadModal, setShowLookAheadModal] = useState(false);

  // Sync if parent reloads and passes new initialPlannedIds
  useEffect(() => {
    setPlannedIds(initialPlannedIds || []);
  }, [initialPlannedIds]);

  const dateStr = date.format('YYYY-MM-DD');
  const dayAbbr = date.format('ddd');   // "Mon", "Tue" …
  const dayDate = date.format('MMM D'); // "Apr 28"
  const plannedCount = plannedIds.length;
  const dueCount = missionsDue.length;

  return (
    <>
      <div
        className={`wp-day-card ${isToday ? 'wp-day-card--today' : ''}`}
        onClick={() => setShowLookAheadModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowLookAheadModal(true); }}
      >
        {/* Header row */}
        <div className="wp-day-card-header">
          <div className="wp-day-name-group">
            <span className="wp-day-abbr">{dayAbbr}</span>
            <span className="wp-day-fulldate">{dayDate}</span>
          </div>
          {dueCount > 0 && (
            <span className="wp-due-badge">
              {dueCount} due
            </span>
          )}
        </div>

        {/* Body row: plan widget (left) + look-ahead hint (right) */}
        <div className="wp-day-card-body">
          {/* Plan widget — left zone, intercepts clicks */}
          <div
            className="wp-plan-widget"
            onClick={e => { e.stopPropagation(); setShowPlanModal(true); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                setShowPlanModal(true);
              }
            }}
          >
            <div className="wp-plan-count-row">
              <span className={`wp-plan-count-done ${plannedCount > 0 ? 'wp-plan-count-done--set' : ''}`}>
                {plannedCount}
              </span>
              <span className="wp-plan-count-denom">/3 daily</span>
            </div>
            <div className="wp-plan-pips">
              {[0, 1, 2].map(i => (
                <div key={i} className={`wp-plan-pip ${i < plannedCount ? 'wp-plan-pip--filled' : ''}`} />
              ))}
            </div>
            <span className="wp-plan-cta">Plan priorities</span>
          </div>

          {/* Look-ahead hint — right zone (passive, whole-card click handles it) */}
          <div className="wp-lookahead-hint">
            <span className="wp-lookahead-label">Look ahead</span>
            <span className="material-icons wp-lookahead-arrow">arrow_forward</span>
          </div>
        </div>
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
          Set your daily priorities for the coming week. Tap a card to see what's due, or hit "Plan priorities" to choose your daily missions.
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
          return (
            <DayCard
              key={dateStr}
              date={date}
              missionsDue={missionsDueByDate[dateStr] || []}
              initialPlannedIds={plannedByDate[dateStr] || []}
              isToday={dateStr === today}
              onPlanSaved={load}
              onError={(msg) => console.error('Day plan error:', msg)}
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
