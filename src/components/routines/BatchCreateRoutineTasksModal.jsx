// src/components/routines/BatchCreateRoutineTasksModal.jsx
import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import { useRooms } from '../../contexts/RoomsContext';
import { useRoutines } from '../../contexts/RoutineContext';
import { batchCreateRoutineMissions } from '../../services/missionService';
import { createMissionTemplate, DUE_TYPES } from '../../types/Mission';
import { RECURRENCE_PATTERNS } from '../../utils/recurrenceHelpers';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import ErrorMessage from '../ui/ErrorMessage';
import './BatchCreateRoutineTasksModal.css';

const FREQUENCY_OPTIONS = [
  { value: RECURRENCE_PATTERNS.DAILY,   label: 'Daily' },
  { value: RECURRENCE_PATTERNS.WEEKLY,  label: 'Weekly' },
  { value: RECURRENCE_PATTERNS.MONTHLY, label: 'Monthly' },
  { value: RECURRENCE_PATTERNS.YEARLY,  label: 'Yearly' },
];

const emptyRow = (id) => ({
  id,
  title: '',
  pattern: RECURRENCE_PATTERNS.DAILY,
  baseLocation: '',
});

// Build a recurring mission template from a single row. Sensible defaults:
// dueDate = today, monthly uses today's day-of-month, weekly leaves weekdays
// empty (interpreted as "every N weeks" cadence). User can refine via the
// existing mission edit flow.
const buildMissionFromRow = (row, todayString, dayOfMonth) => {
  return createMissionTemplate({
    title: row.title.trim(),
    dueType: DUE_TYPES.RECURRING,
    dueDate: todayString,
    baseLocation: row.baseLocation || null,
    recurrence: {
      pattern: row.pattern,
      interval: 1,
      weekdays: [],
      monthlyMode: 'dayOfMonth',
      dayOfMonth: row.pattern === RECURRENCE_PATTERNS.MONTHLY ? dayOfMonth : null,
      weekOfMonth: null,
      weekdayOfMonth: null,
      endDate: null,
      maxOccurrences: null,
      parentMissionId: null,
      nextDueDate: null,
    },
  });
};

const BatchCreateRoutineTasksModal = ({ routineId, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const { rooms } = useRooms();
  const { refreshRoutines } = useRoutines();

  const [rows, setRows] = useState([emptyRow(1)]);
  const [nextRowId, setNextRowId] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useModalBackButton(true, onClose);

  const validRowCount = useMemo(
    () => rows.filter((r) => r.title.trim().length > 0).length,
    [rows]
  );

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const updateRow = (id, partial) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow(nextRowId)]);
    setNextRowId((n) => n + 1);
  };

  const removeRow = (id) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleSave = async () => {
    if (saving) return;
    const usableRows = rows.filter((r) => r.title.trim().length > 0);
    if (usableRows.length === 0) return;

    setSaving(true);
    setSaveError(null);

    const today = dayjs();
    const todayString = today.format('YYYY-MM-DD');
    const dayOfMonth = today.date();

    try {
      const missions = usableRows.map((r) =>
        buildMissionFromRow(r, todayString, dayOfMonth)
      );
      await batchCreateRoutineMissions(currentUser.uid, missions, routineId);
      await refreshRoutines();
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Batch routine creation failed:', err);
      setSaveError("Those routine tasks didn't save. Try again.");
      setSaving(false);
    }
  };

  const content = (
    <div className="batch-routine-overlay" onClick={handleBackdropClick}>
      <div className="batch-routine-modal" role="dialog" aria-modal="true">
        <div className="batch-routine-header">
          <h2 className="batch-routine-title">Add to your routine</h2>
          <button
            className="batch-routine-close"
            onClick={onClose}
            aria-label="Close"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="batch-routine-body">
          <p className="batch-routine-intro">
            Add as many tasks as you like. You can fine-tune the details later.
          </p>

          <div className="batch-routine-rows">
            {rows.map((row, index) => (
              <div key={row.id} className="batch-routine-row">
                <div className="batch-routine-row-head">
                  <span className="batch-routine-row-number">{index + 1}</span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="batch-routine-row-remove"
                      onClick={() => removeRow(row.id)}
                      aria-label="Remove this row"
                    >
                      <span className="material-icons">close</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  className="batch-routine-input"
                  placeholder="Task name"
                  value={row.title}
                  onChange={(e) => updateRow(row.id, { title: e.target.value })}
                  maxLength={100}
                />

                <div className="batch-routine-row-controls">
                  <label className="batch-routine-control">
                    <span className="batch-routine-control-label">Frequency</span>
                    <select
                      className="batch-routine-select"
                      value={row.pattern}
                      onChange={(e) => updateRow(row.id, { pattern: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="batch-routine-control">
                    <span className="batch-routine-control-label">Room</span>
                    <select
                      className="batch-routine-select"
                      value={row.baseLocation}
                      onChange={(e) =>
                        updateRow(row.id, { baseLocation: e.target.value })
                      }
                    >
                      <option value="">Unassigned</option>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="batch-routine-add-row"
            onClick={addRow}
          >
            <span className="material-icons">add</span>
            Add another
          </button>

          {saveError && <ErrorMessage message={saveError} />}
        </div>

        <div className="batch-routine-footer">
          <button
            type="button"
            className="batch-routine-cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="batch-routine-save"
            onClick={handleSave}
            disabled={saving || validRowCount === 0}
          >
            {saving
              ? 'Adding…'
              : validRowCount === 0
              ? 'Add tasks'
              : `Add ${validRowCount} task${validRowCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default BatchCreateRoutineTasksModal;
