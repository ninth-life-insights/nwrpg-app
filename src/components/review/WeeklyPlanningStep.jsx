// src/components/review/WeeklyPlanningStep.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions } from '../../services/missionService';
import {
  getDailyMissionsForDate,
  planDailyMissionsForDate,
  syncScheduledDatesOnMissions,
} from '../../services/dailyMissionService';
import { getUpcomingWeekDays } from '../../utils/dateHelpers';
import { withTimeout, isDefinitelyOffline } from '../../utils/fetchWithTimeout';
import { toDateString } from '../../utils/dateHelpers';
import ErrorMessage from '../ui/ErrorMessage';
import StickyFooter from '../ui/StickyFooter';
import dayjs from 'dayjs';
import './WeeklyPlanningStep.css';

const MAX_PRIORITIES = 3;

const WeeklyPlanningStep = ({ weekStartDate, weekEndDate, weekLabel, onNext, onBack }) => {
  const { currentUser } = useAuth();

  const today = toDateString(new Date());
  // Upcoming week = the 7 days of the next week (starts after weekEndDate)
  // But also useful to allow planning days in the current week that haven't passed
  const upcomingDays = getUpcomingWeekDays(weekStartDate);

  const [allMissions, setAllMissions] = useState([]);
  // dayPlans: { [date]: { prev: string[], current: string[] } }
  const [dayPlans, setDayPlans] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);
  const [pickerDay, setPickerDay] = useState(null); // which day's picker is open
  const [savingDay, setSavingDay] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your missions didn't load. Check your connection and try again.");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const missions = await withTimeout(getActiveMissions(currentUser.uid));
      setAllMissions(missions);

      // Load existing plans for each upcoming day
      const planEntries = await withTimeout(
        Promise.all(
          upcomingDays.map(date =>
            getDailyMissionsForDate(currentUser.uid, date).then(history => ({
              date,
              ids: history?.selectedMissionIds ?? [],
            }))
          )
        )
      );
      const plans = {};
      planEntries.forEach(({ date, ids }) => {
        plans[date] = { prev: ids, current: ids };
      });
      setDayPlans(plans);
    } catch (err) {
      setLoadError("Your plans didn't load.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, weekStartDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveDayPlan = async (date, newIds) => {
    const prev = dayPlans[date]?.prev ?? [];
    setSavingDay(date);
    setSaveError(null);
    try {
      await planDailyMissionsForDate(currentUser.uid, newIds, date);
      await syncScheduledDatesOnMissions(currentUser.uid, prev, newIds, date);
      setDayPlans(plans => ({
        ...plans,
        [date]: { prev: newIds, current: newIds },
      }));
    } catch {
      setSaveError("That plan didn't save. Try again.");
      // Revert local state
      setDayPlans(plans => ({
        ...plans,
        [date]: { ...plans[date], current: prev },
      }));
    } finally {
      setSavingDay(null);
    }
  };

  const handleAddMission = async (date, missionId) => {
    const current = dayPlans[date]?.current ?? [];
    if (current.length >= MAX_PRIORITIES || current.includes(missionId)) return;
    const newIds = [...current, missionId];
    setDayPlans(plans => ({
      ...plans,
      [date]: { ...plans[date], current: newIds },
    }));
    setPickerDay(null);
    await saveDayPlan(date, newIds);
  };

  const handleRemoveMission = async (date, missionId) => {
    const current = dayPlans[date]?.current ?? [];
    const newIds = current.filter(id => id !== missionId);
    setDayPlans(plans => ({
      ...plans,
      [date]: { ...plans[date], current: newIds },
    }));
    await saveDayPlan(date, newIds);
  };

  const getMissionById = (id) => allMissions.find(m => m.id === id);

  const getDueMissionsForDay = (date) =>
    allMissions.filter(m => m.dueDate === date);

  const getAvailableMissions = (date) => {
    const current = dayPlans[date]?.current ?? [];
    return allMissions
      .filter(m => !current.includes(m.id))
      .sort((a, b) => {
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return 0;
      });
  };

  const formatDayHeader = (date) => {
    const d = dayjs(date);
    if (date === today) return 'Today';
    if (date === dayjs().add(1, 'day').format('YYYY-MM-DD')) return 'Tomorrow';
    return d.format('ddd, MMM D');
  };

  return (
    <>
      <div className="review-step">
        <div className="review-step-body">
          <h2 className="review-step-heading">Plan the Week</h2>
          <p className="review-step-subtext">
            Set up to {MAX_PRIORITIES} priorities per day for the upcoming week.
          </p>

          {loadError && <ErrorMessage message={loadError} onRetry={loadData} />}
          {saveError && <ErrorMessage message={saveError} />}

          {loading && <p className="review-step-loading">Loading…</p>}

          {!loading && !loadError && (
            <div className="weekly-planning-days">
              {upcomingDays.map(date => {
                const current = dayPlans[date]?.current ?? [];
                const dueMissions = getDueMissionsForDay(date);
                const isExpanded = expandedDay === date;
                const isSaving = savingDay === date;

                return (
                  <div key={date} className={`weekly-day-row ${isExpanded ? 'weekly-day-row--open' : ''}`}>
                    {/* Collapsed header */}
                    <button
                      className="weekly-day-header"
                      onClick={() => setExpandedDay(isExpanded ? null : date)}
                    >
                      <span className="weekly-day-label">{formatDayHeader(date)}</span>
                      <div className="weekly-day-summary">
                        {dueMissions.length > 0 && (
                          <span className="weekly-day-due-badge">
                            {dueMissions.length} due
                          </span>
                        )}
                        <span className="weekly-day-priorities-badge">
                          {current.length}/{MAX_PRIORITIES} priorities
                        </span>
                        <span className="material-icons weekly-day-chevron">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="weekly-day-body">
                        {/* Due missions for this day */}
                        {dueMissions.length > 0 && (
                          <div className="weekly-day-section">
                            <p className="weekly-day-section-label">Due this day</p>
                            {dueMissions.map(m => {
                              const isSelected = current.includes(m.id);
                              return (
                                <div key={m.id} className="weekly-due-mission-row">
                                  <span className="weekly-due-mission-title">{m.title}</span>
                                  {isSelected ? (
                                    <span className="weekly-due-mission-added">Added</span>
                                  ) : (
                                    <button
                                      className="weekly-due-mission-add-btn"
                                      onClick={() => handleAddMission(date, m.id)}
                                      disabled={current.length >= MAX_PRIORITIES || isSaving}
                                    >
                                      + Priority
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Current priorities */}
                        <div className="weekly-day-section">
                          <p className="weekly-day-section-label">
                            Priorities {isSaving ? <span className="weekly-day-saving">Saving…</span> : null}
                          </p>
                          {current.length === 0 && (
                            <p className="weekly-day-no-priorities">None set</p>
                          )}
                          {current.map(id => {
                            const mission = getMissionById(id);
                            if (!mission) return null;
                            return (
                              <div key={id} className="weekly-priority-row">
                                <span className="weekly-priority-title">{mission.title}</span>
                                <button
                                  className="weekly-priority-remove"
                                  onClick={() => handleRemoveMission(date, id)}
                                  disabled={isSaving}
                                  aria-label="Remove priority"
                                >
                                  <span className="material-icons">close</span>
                                </button>
                              </div>
                            );
                          })}
                          {current.length < MAX_PRIORITIES && (
                            <button
                              className="weekly-add-priority-btn"
                              onClick={() => setPickerDay(date)}
                              disabled={isSaving}
                            >
                              <span className="material-icons">add</span>
                              Add priority
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <StickyFooter>
          <button className="review-next-btn" onClick={onNext}>
            Next
          </button>
          <button className="review-skip-link" onClick={onBack}>
            Back
          </button>
        </StickyFooter>
      </div>

      {/* Mission picker modal */}
      {pickerDay && (
        <div className="quest-modal-overlay" onClick={() => setPickerDay(null)}>
          <div className="quest-modal" onClick={e => e.stopPropagation()}>
            <div className="quest-modal-header">
              <h3 className="quest-modal-title">Pick a Priority</h3>
              <button className="quest-modal-close" onClick={() => setPickerDay(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div className="quest-modal-body">
              {getAvailableMissions(pickerDay).length === 0 ? (
                <p className="review-step-empty">No more missions to add.</p>
              ) : (
                <ul className="quest-modal-mission-list">
                  {getAvailableMissions(pickerDay).map(m => (
                    <li key={m.id} className="quest-modal-mission-row">
                      <button
                        className="weekly-picker-mission-btn"
                        onClick={() => handleAddMission(pickerDay, m.id)}
                      >
                        <span className="weekly-picker-mission-title">{m.title}</span>
                        {m.dueDate && (
                          <span className="weekly-picker-mission-due">
                            {dayjs(m.dueDate).format('MMM D')}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WeeklyPlanningStep;
