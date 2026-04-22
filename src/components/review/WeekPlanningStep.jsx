// src/components/review/WeekPlanningStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getDailyMissionsForDate,
  planDailyMissionsForDate,
  syncScheduledDatesOnMissions,
} from '../../services/dailyMissionService';
import { getActiveMissions } from '../../services/missionService';
import MissionList from '../missions/MissionList';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import { getWeekDates } from '../../utils/weeklyReviewHelpers';
import { toDateString } from '../../utils/dateHelpers';
import { withTimeout } from '../../utils/fetchWithTimeout';
import './WeekPlanningStep.css';

// ─── Day accordion panel ─────────────────────────────────────────────────────

const DayPanel = ({
  date,         // dayjs object
  allMissions,  // full mission bank (active missions)
  initialPlanned, // array of mission IDs already planned for this day
  isToday,
  onSaveError,
}) => {
  const { currentUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [plannedIds, setPlannedIds] = useState(initialPlanned || []);
  const [savedIds, setSavedIds] = useState(initialPlanned || []);
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const dateStr = date.format('YYYY-MM-DD');
  const dayLabel = isToday
    ? `Today — ${date.format('ddd, MMM D')}`
    : date.format('dddd, MMM D');

  // Resolve planned mission objects from IDs
  const plannedMissions = plannedIds
    .map(id => allMissions.find(m => m.id === id))
    .filter(Boolean);

  const savePlan = async (newIds) => {
    setSaving(true);
    onSaveError(dateStr, null);
    try {
      await Promise.all([
        planDailyMissionsForDate(currentUser.uid, newIds, dateStr),
        syncScheduledDatesOnMissions(currentUser.uid, savedIds, newIds, dateStr),
      ]);
      setSavedIds(newIds);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      console.error('Error saving plan for', dateStr, err);
      onSaveError(dateStr, `That day's plan didn't save. Try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (missionId) => {
    const newIds = plannedIds.filter(id => id !== missionId);
    setPlannedIds(newIds);
    savePlan(newIds);
  };

  const handleSelectFromPicker = (mission) => {
    if (plannedIds.includes(mission.id)) return;
    const newIds = [...plannedIds, mission.id];
    setPlannedIds(newIds);
    savePlan(newIds);
    setShowPicker(false);
  };

  return (
    <div className={`wp-day-panel ${expanded ? 'wp-day-panel--open' : ''} ${isToday ? 'wp-day-panel--today' : ''}`}>
      <button
        className="wp-day-header"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded}
      >
        <span className="wp-day-label">{dayLabel}</span>
        <span className="wp-day-count">
          {plannedIds.length > 0
            ? `${plannedIds.length} planned`
            : 'none yet'}
        </span>
        {saving && <span className="wp-day-saving">Saving...</span>}
        {justSaved && !saving && <span className="wp-day-saved">Saved</span>}
        <span className="material-icons wp-chevron">
          {expanded ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {expanded && (
        <div className="wp-day-body">
          {plannedMissions.length > 0 ? (
            <div className="wp-planned-list">
              {plannedMissions.map(m => (
                <div key={m.id} className="wp-planned-row">
                  <span className="wp-planned-title">{m.title}</span>
                  <button
                    className="wp-remove-btn"
                    onClick={() => handleRemove(m.id)}
                    aria-label={`Remove ${m.title}`}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="wp-empty">No missions planned yet.</p>
          )}

          {showPicker ? (
            <div className="wp-picker">
              <div className="wp-picker-header">
                <span className="wp-picker-title">Choose from mission bank</span>
                <button className="wp-picker-close" onClick={() => setShowPicker(false)}>
                  <span className="material-icons">close</span>
                </button>
              </div>
              <MissionList
                userId={currentUser.uid}
                missions={allMissions.filter(m => !plannedIds.includes(m.id))}
                selectionMode
                onMissionSelect={handleSelectFromPicker}
                selectedMissions={[]}
                showFilters={false}
                showAddMission={false}
              />
            </div>
          ) : (
            <button className="wp-add-btn" onClick={() => setShowPicker(true)}>
              <span className="material-icons">add</span>
              Add from mission bank
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main step ────────────────────────────────────────────────────────────────

const WeekPlanningStep = ({ weekInfo, onNext, onSkipToSummary }) => {
  const { currentUser } = useAuth();
  const [allMissions, setAllMissions] = useState([]);
  const [plannedByDate, setPlannedByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dayErrors, setDayErrors] = useState({});

  const today = toDateString(new Date());
  const weekDates = weekInfo ? getWeekDates(weekInfo.nextWeekStart) : [];

  const handleDayError = (dateStr, msg) => {
    setDayErrors(prev => ({ ...prev, [dateStr]: msg }));
  };

  useEffect(() => {
    if (!currentUser || weekDates.length === 0) return;
    const load = async () => {
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
    load();
  }, [currentUser]);

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Plan the Week Ahead</h2>
        <p className="review-step-subtext">
          Set your daily priorities for the coming week. You can plan as many or as few missions per day as you like.
        </p>

        {loadError && (
          <ErrorMessage
            message={loadError}
            onRetry={() => { setLoadError(null); setLoading(true); }}
          />
        )}

        {loading && !loadError && (
          <p className="review-step-loading">Loading missions...</p>
        )}

        {!loading && !loadError && weekDates.map(date => {
          const dateStr = date.format('YYYY-MM-DD');
          return (
            <div key={dateStr}>
              <DayPanel
                date={date}
                allMissions={allMissions}
                initialPlanned={plannedByDate[dateStr] || []}
                isToday={dateStr === today}
                onSaveError={handleDayError}
              />
              {dayErrors[dateStr] && (
                <ErrorMessage message={dayErrors[dateStr]} className="wp-day-error" />
              )}
            </div>
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
