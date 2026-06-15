import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDeletedMissions, restoreMission } from '../../services/missionService';
import MissionCardCondensed from '../../components/missions/MissionCardCondensed';
import MissionCardCondensedSkeleton from '../../components/missions/MissionCardCondensedSkeleton';
import LoadingTransition from '../../components/ui/LoadingTransition';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { useAndroidBackButton } from '../../hooks/useAndroidBackButton';
import './DeletedMissionsPage.css';

const scrollPageToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
};

const DeletedMissionsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [restoringIds, setRestoringIds] = useState(new Set());

  const handleBack = () => navigate('/settings');
  useAndroidBackButton(handleBack);

  useEffect(() => {
    scrollPageToTop();
  }, []);

  const loadDeletedMissions = async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDeletedMissions(currentUser.uid);
      setMissions(data);
      setSelectedIds(new Set());
    } catch {
      setLoadError("Your deleted missions didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedMissions();
  }, [currentUser]);

  const handleRestore = async (missionId) => {
    setActionError(null);
    setRestoringIds(prev => new Set([...prev, missionId]));
    try {
      await restoreMission(currentUser.uid, missionId);
      setMissions(prev => prev.filter(m => m.id !== missionId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(missionId); return n; });
    } catch {
      setActionError("That mission didn't restore. Try again.");
    } finally {
      setRestoringIds(prev => { const n = new Set(prev); n.delete(missionId); return n; });
    }
  };

  const handleRestoreSelected = async () => {
    setActionError(null);
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => handleRestore(id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === missions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(missions.map(m => m.id)));
    }
  };

  const allSelected = missions.length > 0 && selectedIds.size === missions.length;

  return (
    <div className="deleted-missions-page">
      <header className="deleted-missions-header">
        <button
          className="deleted-missions-back"
          onClick={handleBack}
          aria-label="Back to settings"
        >
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="deleted-missions-title">Deleted Missions</h1>
      </header>

      <p className="deleted-missions-intro">
        Restore a mission to bring it back to your active list.
      </p>

      {loadError && (
        <ErrorMessage message={loadError} onRetry={loadDeletedMissions} />
      )}

      {loading && !loadError && (
        <LoadingTransition
          loading={loading}
          skeleton={
            <div className="deleted-mission-list">
              <MissionCardCondensedSkeleton titleWidth="60%" />
              <MissionCardCondensedSkeleton titleWidth="55%" />
              <MissionCardCondensedSkeleton titleWidth="65%" />
            </div>
          }
        >
          <div />
        </LoadingTransition>
      )}

      {!loading && !loadError && missions.length === 0 && (
        <p className="deleted-missions-empty">No deleted missions.</p>
      )}

      {!loading && !loadError && missions.length > 0 && (
        <>
          <div className="dm-bulk-bar">
            <button className="dm-select-all-btn" onClick={toggleSelectAll}>
              <span className={`dm-checkbox ${allSelected ? 'dm-checkbox--checked' : ''}`}>
                {allSelected && <span className="material-icons">check</span>}
              </span>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <button
                className="dm-restore-selected-btn"
                onClick={handleRestoreSelected}
                disabled={restoringIds.size > 0}
              >
                <span className="material-icons">restore</span>
                Restore selected ({selectedIds.size})
              </button>
            )}
          </div>

          {actionError && <ErrorMessage message={actionError} />}

          <div className="deleted-mission-list">
            {missions.map(m => (
              <div key={m.id} className="dm-mission-item">
                <button
                  className="dm-checkbox-btn"
                  onClick={() => toggleSelect(m.id)}
                  aria-label={selectedIds.has(m.id) ? 'Deselect' : 'Select'}
                >
                  <span className={`dm-checkbox ${selectedIds.has(m.id) ? 'dm-checkbox--checked' : ''}`}>
                    {selectedIds.has(m.id) && <span className="material-icons">check</span>}
                  </span>
                </button>
                <div className="dm-mission-card-wrap">
                  <MissionCardCondensed mission={m} readOnly />
                </div>
                <button
                  className="dm-restore-btn"
                  onClick={() => handleRestore(m.id)}
                  disabled={restoringIds.has(m.id)}
                  title="Restore"
                  aria-label="Restore mission"
                >
                  <span className="material-icons">restore</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DeletedMissionsPage;
