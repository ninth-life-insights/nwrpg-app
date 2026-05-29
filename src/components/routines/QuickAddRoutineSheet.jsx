// src/components/routines/QuickAddRoutineSheet.jsx
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { createMission } from '../../services/missionService';
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

// Build a v1 default recurrence shape from a frequency. Interval is always 1;
// users refine atypical cadences ("every 3 days") via the existing edit flow.
// Monthly captures today's day-of-month so the cadence is stable; everything
// else uses defaults.
const buildRecurrence = (frequency, today) => ({
  pattern: frequency,
  interval: 1,
  weekdays: [],
  monthlyMode: 'dayOfMonth',
  dayOfMonth: frequency === RECURRENCE_PATTERNS.MONTHLY ? today.date() : null,
  weekOfMonth: null,
  weekdayOfMonth: null,
  endDate: null,
  maxOccurrences: null,
  parentMissionId: null,
  nextDueDate: null,
});

// Per-bucket quick-capture sheet for adding recurring routine tasks. The
// "session" is the open lifetime of the sheet: skill and room are locked
// session-level controls, frequency is locked to the bucket. Each Enter
// instantly writes one mission + adds it to the routine (Option A from the
// design discussion — no batch buffer, no Save button). The counter is the
// visible record; "Done" just closes.
const QuickAddRoutineSheet = ({
  frequency,
  routineId,
  defaultRoomId = '',
  defaultSkill = '',
  onClose,
  onAdded,
}) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();

  const [skill, setSkill] = useState(defaultSkill || '');
  const [roomId, setRoomId] = useState(defaultRoomId || '');
  const [inputValue, setInputValue] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const inputRef = useRef(null);

  useModalBackButton(true, onClose);

  useEffect(() => {
    // Autofocus on open so the keyboard appears immediately on mobile
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

    const today = dayjs();
    const todayString = today.format('YYYY-MM-DD');

    const missionData = createMissionTemplate({
      title,
      dueType: DUE_TYPES.RECURRING,
      dueDate: todayString,
      baseLocation: roomId || null,
      skill: skill || null,
      recurrence: buildRecurrence(frequency, today),
    });

    try {
      await createMission(currentUser.uid, missionData, { routineId });
      setInputValue('');
      setAddedCount((n) => n + 1);
      onAdded?.();
    } catch (err) {
      console.error('Quick add failed:', err);
      setSaveError(err?.message || "That task didn't save. Try again.");
    } finally {
      setSaving(false);
      // Refocus so the next task can be typed immediately
      inputRef.current?.focus();
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
                onChange={(e) => setSkill(e.target.value)}
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
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">Unassigned</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>{room.name}</option>
                ))}
              </select>
            </label>
          </div>

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

          {addedCount > 0 && (
            <div className="quick-add-counter">
              {addedCount} added
            </div>
          )}
        </div>

        <div className="quick-add-routine-footer">
          <button
            type="button"
            className="quick-add-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default QuickAddRoutineSheet;
