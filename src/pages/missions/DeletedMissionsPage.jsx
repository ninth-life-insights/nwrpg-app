import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDeletedMissions, restoreMission } from '../../services/missionService';
import { formatForUserLong } from '../../utils/dateHelpers';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './DeletedMissionsPage.css';

const DeletedMissionsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [pendingMissionId, setPendingMissionId] = useState(null);

  const loadDeletedMissions = async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDeletedMissions(currentUser.uid);
      setMissions(data);
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
    if (!currentUser || pendingMissionId) return;
    setActionError(null);
    setPendingMissionId(missionId);
    try {
      await restoreMission(currentUser.uid, missionId);
      setMissions(prev => prev.filter(m => m.id !== missionId));
    } catch {
      setActionError("That mission didn't restore. Try again.");
    } finally {
      setPendingMissionId(null);
    }
  };

  return (
    <div className="deleted-missions-page">
      <header className="deleted-missions-header">
        <button
          className="deleted-missions-back"
          onClick={() => navigate('/settings')}
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

      {actionError && <ErrorMessage message={actionError} />}

      {loading && !loadError && (
        <p className="deleted-missions-empty">Loading...</p>
      )}

      {!loading && !loadError && missions.length === 0 && (
        <p className="deleted-missions-empty">No deleted missions.</p>
      )}

      {missions.length > 0 && (
        <ul className="deleted-mission-list">
          {missions.map(m => (
            <li key={m.id} className="deleted-mission-item">
              <div className="deleted-mission-info">
                <span className="deleted-mission-title">{m.title}</span>
                {m.deletedAt && (
                  <span className="deleted-mission-meta">
                    Deleted {formatForUserLong(m.deletedAt)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="deleted-mission-restore"
                onClick={() => handleRestore(m.id)}
                disabled={pendingMissionId === m.id}
              >
                {pendingMissionId === m.id ? 'Restoring...' : 'Restore'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default DeletedMissionsPage;
