// src/components/routines/QuickAddRoutineSheet.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { createMission, deleteMission } from '../../services/missionService';
import { removeMissionFromRoutine } from '../../services/routineService';
import { createMissionTemplate, DUE_TYPES } from '../../types/Mission';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import { AVAILABLE_SKILLS } from '../../data/Skills';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import ErrorMessage from '../ui/ErrorMessage';
import './QuickAddRoutineSheet.css';

const FREQUENCY_LABELS = {
  [RECURRENCE_PATTERNS.DAILY]:   'Daily',
  [RECURRENCE_PATTERNS.WEEKLY]:  'Weekly',
  [RECURRENCE_PATTERNS.MONTHLY]: 'Monthly',
  [RECURRENCE_PATTERNS.YEARLY]:  'Yearly',
};

// Frequency-scaled "start when" offsets for staggering the first due date when
// bulk-adding. Each offset is session-level — pick once, applies to every task
// added until changed. Daily has no offsets (we picked Daily for "every day",
// no point starting it tomorrow).
const START_OFFSETS = {
  // Offsets stay within each frequency's window so staggering actually spreads
  // tasks across the cycle (different weekdays for weekly, different weeks for
  // monthly). Going beyond the window — e.g. "+2 weeks" on a weekly cadence —
  // just delays the start without changing which day of the cycle the task
  // lands on, which is the wrong tool for "don't pile up Tuesday."
  [RECURRENCE_PATTERNS.WEEKLY]: [
    { value: 'today',    label: 'Today',     add: () => dayjs() },
    { value: 'tomorrow', label: 'Tomorrow',  add: () => dayjs().add(1, 'day') },
    { value: '2d',       label: '+2 days',   add: () => dayjs().add(2, 'day') },
    { value: '3d',       label: '+3 days',   add: () => dayjs().add(3, 'day') },
  ],
  [RECURRENCE_PATTERNS.MONTHLY]: [
    { value: 'today', label: 'Today',    add: () => dayjs() },
    { value: '1w',    label: '+1 week',  add: () => dayjs().add(1, 'week') },
    { value: '2w',    label: '+2 weeks', add: () => dayjs().add(2, 'week') },
    { value: '3w',    label: '+3 weeks', add: () => dayjs().add(3, 'week') },
  ],
  [RECURRENCE_PATTERNS.YEARLY]: [
    { value: 'today', label: 'Today',      add: () => dayjs() },
    { value: '1m',    label: 'Next month', add: () => dayjs().add(1, 'month') },
    { value: '6m',    label: '+6 months',  add: () => dayjs().add(6, 'month') },
    { value: '1y',    label: '+1 year',    add: () => dayjs().add(1, 'year') },
  ],
};

const resolveStartDate = (frequency, offsetValue) => {
  const options = START_OFFSETS[frequency];
  if (!options) return dayjs();
  const match = options.find((o) => o.value === offsetValue);
  return match ? match.add() : dayjs();
};

// Build a recurrence shape from a frequency + interval. Monthly captures the
// start-date's day-of-month so the cadence stays stable against the chosen
// start, even when staggered (e.g. "+1 month" lands on the same day-of-month
// as today). Interval defaults to 1; for weekly/monthly the quick-add sheet
// surfaces a stepper so the user can capture "every 2 weeks" / "every 3
// months" inline without dropping into the edit flow.
const buildRecurrence = (frequency, startDate, interval = 1) => ({
  pattern: frequency,
  interval: Math.max(1, interval || 1),
  weekdays: [],
  monthlyMode: 'dayOfMonth',
  dayOfMonth: frequency === RECURRENCE_PATTERNS.MONTHLY ? startDate.date() : null,
  weekOfMonth: null,
  weekdayOfMonth: null,
  endDate: null,
  maxOccurrences: null,
  parentMissionId: null,
  nextDueDate: null,
});

// Which frequencies surface an interval stepper in the sheet. Yearly skips —
// yearly almost always means interval=1.
const INTERVAL_UNITS = {
  [RECURRENCE_PATTERNS.DAILY]: 'days',
  [RECURRENCE_PATTERNS.WEEKLY]: 'weeks',
  [RECURRENCE_PATTERNS.MONTHLY]: 'months',
};

// Per-bucket quick-capture sheet for adding recurring routine tasks. The
// "session" is the open lifetime of the sheet: skill and room are locked
// session-level controls, frequency is locked to the bucket. Each Enter
// instantly writes one mission + adds it to the routine and the row appears
// in the "Added in this session" list above the input. Tapping the minus on
// any row deletes that mission entirely (soft-delete + routine removal) —
// these rows are fresh-out-of-the-oven, so removing means "undo add," not
// "remove from routine but keep mission."
const QuickAddRoutineSheet = ({
  frequency,
  routineId,
  defaultRoomId = '',
  defaultSkill = '',
  onSkillChange,
  onRoomChange,
  onClose,
  onAdded,
}) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();

  const [skill, setSkill] = useState(defaultSkill || '');
  const [roomId, setRoomId] = useState(defaultRoomId || '');
  const [startOffset, setStartOffset] = useState('today');
  const [interval, setInterval] = useState(1);
  const [inputValue, setInputValue] = useState('');
  const [addedMissions, setAddedMissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [removingIds, setRemovingIds] = useState(new Set());
  const inputRef = useRef(null);

  const offsetOptions = START_OFFSETS[frequency] || null;
  const intervalUnit = INTERVAL_UNITS[frequency] || null;

  useModalBackButton(true, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleAdd = async () => {
    const title = inputValue.trim();
    if (!title || saving) return;

    setSaving(true);
    setSaveError(null);

    const startDate = resolveStartDate(frequency, startOffset);
    const startString = startDate.format('YYYY-MM-DD');

    const missionData = createMissionTemplate({
      title,
      dueType: DUE_TYPES.RECURRING,
      dueDate: startString,
      baseLocation: roomId || null,
      skill: skill || null,
      recurrence: buildRecurrence(frequency, startDate, interval),
    });

    const offsetMatch = offsetOptions?.find((o) => o.value === startOffset);
    const startLabel = offsetMatch ? offsetMatch.label : 'Today';
    const intervalLabel = intervalUnit && interval > 1
      ? `Every ${interval} ${intervalUnit}`
      : null;

    try {
      const newId = await createMission(currentUser.uid, missionData, { routineId });
      setAddedMissions((prev) => [...prev, { id: newId, title, startLabel, intervalLabel }]);
      setInputValue('');
      onAdded?.();
    } catch (err) {
      console.error('Quick add failed:', err);
      setSaveError(err?.message || "That task didn't save. Try again.");
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  };

  const handleUndoAdd = async (missionId) => {
    if (removingIds.has(missionId)) return;
    setRemovingIds((prev) => new Set(prev).add(missionId));
    setSaveError(null);
    try {
      await removeMissionFromRoutine(currentUser.uid, routineId, missionId);
      await deleteMission(currentUser.uid, missionId);
      setAddedMissions((prev) => prev.filter((m) => m.id !== missionId));
      onAdded?.();
    } catch (err) {
      console.error('Quick add undo failed:', err);
      setSaveError("That task didn't remove. Try again.");
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(missionId);
        return next;
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const frequencyLabel = FREQUENCY_LABELS[frequency] || 'Routine';

  const content = (
    <div className="quick-add-routine-overlay" onClick={handleBackdropClick}>
      <div className="quick-add-routine-sheet" role="dialog" aria-modal="true">
        <div className="quick-add-routine-header">
          <h2 className="quick-add-routine-title">
            Add to your {frequencyLabel} routine
          </h2>
          <button
            className="quick-add-routine-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="quick-add-routine-body">
          <div className="quick-add-session-controls">
            <label className="quick-add-control">
              <span className="quick-add-control-label">Skill</span>
              <select
                className="quick-add-select"
                value={skill}
                onChange={(e) => {
                  setSkill(e.target.value);
                  onSkillChange?.(e.target.value);
                }}
              >
                <option value="">None</option>
                {AVAILABLE_SKILLS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="quick-add-control">
              <span className="quick-add-control-label">Room</span>
              <select
                className="quick-add-select"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  onRoomChange?.(e.target.value);
                }}
              >
                <option value="">Personal</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>
          </div>

          {addedMissions.length > 0 && (
            <ul className="quick-add-list" aria-label="Added in this session">
              {addedMissions.map((m) => {
                const isRemoving = removingIds.has(m.id);
                return (
                  <li key={m.id} className="quick-add-list-item">
                    <span className="quick-add-list-title">{m.title}</span>
                    {m.intervalLabel && (
                      <span className="quick-add-list-interval">{m.intervalLabel}</span>
                    )}
                    {m.startLabel && m.startLabel !== 'Today' && (
                      <span className="quick-add-list-date">{m.startLabel}</span>
                    )}
                    <button
                      type="button"
                      className="quick-add-list-remove"
                      onClick={() => handleUndoAdd(m.id)}
                      disabled={isRemoving}
                      aria-label={`Undo adding ${m.title}`}
                      title="Undo"
                    >
                      <span className="material-icons">remove_circle_outline</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {offsetOptions && (
            <div className="quick-add-offset-row">
              <span className="quick-add-offset-label">Start</span>
              <div className="quick-add-offset-chips" role="radiogroup" aria-label="Start when">
                {offsetOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={startOffset === opt.value}
                    className={`quick-add-offset-chip ${startOffset === opt.value ? 'is-active' : ''}`}
                    onClick={() => setStartOffset(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {intervalUnit && (
            <div className="quick-add-interval-row">
              <span className="quick-add-interval-label">Every</span>
              <select
                className="quick-add-interval-select"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                aria-label={`Every N ${intervalUnit}`}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="quick-add-interval-unit">{intervalUnit}</span>
            </div>
          )}

          <div className="quick-add-input-row">
            <input
              ref={inputRef}
              type="text"
              className="quick-add-input"
              placeholder="Type a task and hit enter…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={100}
              disabled={saving}
            />
            <button
              type="button"
              className="quick-add-input-btn"
              onClick={handleAdd}
              disabled={saving || !inputValue.trim()}
              aria-label="Add task"
            >
              <span className="material-icons">add</span>
            </button>
          </div>

          {saveError && <ErrorMessage message={saveError} />}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default QuickAddRoutineSheet;
