// src/components/review/TaskArchivingStep.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getActiveMissions, expireMission } from '../../services/missionService';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import MissionDetailView from '../missions/MissionCardFull';
import StickyFooter from '../ui/StickyFooter';
import ErrorMessage from '../ui/ErrorMessage';
import { withTimeout, getLoadErrorMessage } from '../../utils/fetchWithTimeout';
import { toDateString } from '../../utils/dateHelpers';
import './TaskArchivingStep.css';

const TaskArchivingStep = ({ onNext, onSkipToSummary }) => {
  const { currentUser } = useAuth();
  const [expiredMissions, setExpiredMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [archivingIds, setArchivingIds] = useState(new Set());
  const [selectedMission, setSelectedMission] = useState(null);

  const today = toDateString(new Date());

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const missions = await withTimeout(getActiveMissions(currentUser.uid));
      const expired = missions.filter(m => m.expiryDate && m.expiryDate < today);
      setExpiredMissions(expired);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error loading missions for archiving:', err);
      setLoadError(getLoadErrorMessage(err, 'missions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) loadData();
  }, [currentUser]);

  const handleArchive = async (missionId) => {
    setActionError(null);
    setArchivingIds(prev => new Set([...prev, missionId]));
    try {
      await expireMission(currentUser.uid, missionId);
      setExpiredMissions(prev => prev.filter(m => m.id !== missionId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(missionId); return n; });
    } catch (err) {
      console.error('Error archiving mission:', err);
      setActionError("That mission didn't archive. Try again.");
    } finally {
      setArchivingIds(prev => { const n = new Set(prev); n.delete(missionId); return n; });
    }
  };

  const handleArchiveSelected = async () => {
    setActionError(null);
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => handleArchive(id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === expiredMissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expiredMissions.map(m => m.id)));
    }
  };

  const allSelected = expiredMissions.length > 0 && selectedIds.size === expiredMissions.length;

  return (
    <>
      <div className="review-step">
        <div className="review-step-body">
          <h2 className="review-step-heading">How About a Reset?</h2>
          <p className="review-step-subtext">
            Even the best laid plans expire. Archive to make room, or leave them to tackle later.
          </p>

          {loadError && (
            <ErrorMessage message={loadError} onRetry={loadData} />
          )}

          {loading && !loadError && (
            <p className="review-step-loading">Checking for expired missions...</p>
          )}

          {!loading && !loadError && expiredMissions.length === 0 && (
            <p className="review-step-empty">No expired missions — you're all clear.</p>
          )}

          {!loading && !loadError && expiredMissions.length > 0 && (
            <>
              {/* Bulk action bar */}
              <div className="ta-bulk-bar">
                <button className="ta-select-all-btn" onClick={toggleSelectAll}>
                  <span className={`ta-checkbox ${allSelected ? 'ta-checkbox--checked' : ''}`}>
                    {allSelected && <span className="material-icons">check</span>}
                  </span>
                  {allSelected ? 'Deselect all' : 'Select all'}
                </button>
                {selectedIds.size > 0 && (
                  <button
                    className="ta-archive-selected-btn"
                    onClick={handleArchiveSelected}
                    disabled={archivingIds.size > 0}
                  >
                    <span className="material-icons">archive</span>
                    Archive selected ({selectedIds.size})
                  </button>
                )}
              </div>

              {actionError && <ErrorMessage message={actionError} />}

              {/* Mission list */}
              <div className="ta-mission-list">
                {expiredMissions.map(mission => (
                  <div key={mission.id} className="ta-mission-item">
                    <button
                      className={`ta-checkbox-btn ${selectedIds.has(mission.id) ? 'ta-checkbox-btn--checked' : ''}`}
                      onClick={() => toggleSelect(mission.id)}
                      aria-label={selectedIds.has(mission.id) ? 'Deselect' : 'Select'}
                    >
                      <span className={`ta-checkbox ${selectedIds.has(mission.id) ? 'ta-checkbox--checked' : ''}`}>
                        {selectedIds.has(mission.id) && <span className="material-icons">check</span>}
                      </span>
                    </button>
                    <div className="ta-mission-card-wrap">
                      <MissionCardCondensed
                        mission={mission}
                        onToggleComplete={() => {}}
                        onViewDetails={() => setSelectedMission(mission)}
                      />
                    </div>
                    <button
                      className="ta-archive-btn"
                      onClick={() => handleArchive(mission.id)}
                      disabled={archivingIds.has(mission.id)}
                      title="Archive"
                      aria-label="Archive mission"
                    >
                      <span className="material-icons">archive</span>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
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

      {selectedMission && (
        <MissionDetailView
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
          onToggleComplete={() => {}}
          onDeleteMission={() => {}}
          onArchiveMission={(id) => {
            setSelectedMission(null);
            handleArchive(id);
          }}
          onUpdateMission={() => {}}
        />
      )}
    </>
  );
};

export default TaskArchivingStep;
