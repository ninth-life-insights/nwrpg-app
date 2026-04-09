// src/components/review/EncountersStep.jsx
import { useState } from 'react';
import { addEncounter, removeEncounter } from '../../services/reviewService';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase/config';
import { toDateString } from '../../utils/dateHelpers';

const EncountersStep = ({
  userId,
  encounters,
  setEncounters,
  onNext,
  onBack,
  onSkipToSummary,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Track which encounter id is being edited (null = none)
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const today = toDateString(new Date());

  const handleAdd = async () => {
    if (!newTitle.trim() || saving) return;
    setSaving(true);
    try {
      const id = await addEncounter(userId, {
        title: newTitle.trim(),
        notes: newNotes.trim(),
        date: today,
      });
      setEncounters(prev => [...prev, { id, title: newTitle.trim(), notes: newNotes.trim(), date: today }]);
      setNewTitle('');
      setNewNotes('');
      setShowForm(false);
    } catch (err) {
      console.error('Error adding encounter:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (encounterId) => {
    try {
      await removeEncounter(userId, encounterId);
      setEncounters(prev => prev.filter(e => e.id !== encounterId));
    } catch (err) {
      console.error('Error removing encounter:', err);
    }
  };

  const startEdit = (encounter) => {
    setEditingId(encounter.id);
    setEditTitle(encounter.title);
    setEditNotes(encounter.notes || '');
    setShowForm(false); // close add form if open
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || savingEdit) return;
    setSavingEdit(true);
    try {
      const ref = doc(db, 'users', userId, 'encounters', editingId);
      await updateDoc(ref, { title: editTitle.trim(), notes: editNotes.trim() });
      setEncounters(prev => prev.map(e =>
        e.id === editingId ? { ...e, title: editTitle.trim(), notes: editNotes.trim() } : e
      ));
      setEditingId(null);
    } catch (err) {
      console.error('Error updating encounter:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditNotes('');
  };

  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">What happened off-script?</h2>
        <p className="review-step-subtext">
          The stuff that wasn't in the mission briefing — interruptions, surprise wins, plot twists.
        </p>

        {encounters.length > 0 && (
          <div className="encounter-list">
            {encounters.map(e => (
              <div key={e.id} className="encounter-card">
                {editingId === e.id ? (
                  <div className="encounter-edit-form">
                    <input
                      className="encounter-form-input"
                      type="text"
                      value={editTitle}
                      onChange={ev => setEditTitle(ev.target.value)}
                      onKeyDown={ev => ev.key === 'Enter' && !ev.shiftKey && handleSaveEdit()}
                      autoFocus
                    />
                    <textarea
                      className="encounter-form-textarea"
                      value={editNotes}
                      onChange={ev => setEditNotes(ev.target.value)}
                      placeholder="A bit more detail... (optional)"
                      rows={2}
                    />
                    <div className="review-add-mission-actions">
                      <button
                        className="story-action-btn story-action-btn--save"
                        onClick={handleSaveEdit}
                        disabled={!editTitle.trim() || savingEdit}
                      >
                        {savingEdit ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="story-action-btn story-action-btn--cancel"
                        onClick={cancelEdit}
                        disabled={savingEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="encounter-card-content">
                      <span className="encounter-card-title">{e.title}</span>
                      {e.notes && <span className="encounter-card-notes">{e.notes}</span>}
                    </div>
                    <button
                      className="encounter-card-action"
                      onClick={() => startEdit(e)}
                      aria-label="Edit encounter"
                    >
                      <span className="material-icons">edit</span>
                    </button>
                    <button
                      className="encounter-card-action encounter-card-action--delete"
                      onClick={() => handleRemove(e.id)}
                      aria-label="Remove encounter"
                    >
                      <span className="material-icons">close</span>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm ? (
          <div className="encounter-form">
            <input
              className="encounter-form-input"
              type="text"
              placeholder="What happened?"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAdd()}
              autoFocus
            />
            <textarea
              className="encounter-form-textarea"
              placeholder="A bit more detail... (optional)"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              rows={3}
            />
            <div className="review-add-mission-actions">
              <button
                className="story-action-btn story-action-btn--save"
                onClick={handleAdd}
                disabled={!newTitle.trim() || saving}
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
              <button
                className="story-action-btn story-action-btn--cancel"
                onClick={() => { setShowForm(false); setNewTitle(''); setNewNotes(''); }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="review-add-encounter-btn"
            onClick={() => { setShowForm(true); setEditingId(null); }}
          >
            <span className="material-icons">add</span>
            Add encounter
          </button>
        )}
      </div>

      <div className="review-step-footer">
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Just show me my summary
        </button>
      </div>
    </div>
  );
};

export default EncountersStep;
