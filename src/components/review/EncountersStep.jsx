// src/components/review/EncountersStep.jsx
import React, { useState } from 'react';
import { addEncounter, removeEncounter } from '../../services/reviewService';
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
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const today = toDateString(new Date());

  const handleAdd = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const id = await addEncounter(userId, {
        title: title.trim(),
        notes: notes.trim(),
        date: today,
      });
      setEncounters(prev => [...prev, { id, title: title.trim(), notes: notes.trim(), date: today }]);
      setTitle('');
      setNotes('');
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
                <div className="encounter-card-content">
                  <span className="encounter-card-title">{e.title}</span>
                  {e.notes && <span className="encounter-card-notes">{e.notes}</span>}
                </div>
                <button
                  className="encounter-card-delete"
                  onClick={() => handleRemove(e.id)}
                  aria-label="Remove encounter"
                >
                  <span className="material-icons">close</span>
                </button>
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
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAdd()}
              autoFocus
            />
            <textarea
              className="encounter-form-textarea"
              placeholder="A bit more detail... (optional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
            <div className="review-add-mission-actions">
              <button
                className="story-action-btn story-action-btn--save"
                onClick={handleAdd}
                disabled={!title.trim() || saving}
              >
                {saving ? 'Adding...' : 'Add'}
              </button>
              <button
                className="story-action-btn story-action-btn--cancel"
                onClick={() => { setShowForm(false); setTitle(''); setNotes(''); }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="review-add-encounter-btn"
            onClick={() => setShowForm(true)}
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
