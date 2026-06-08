import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getDeletedQuests, restoreQuest } from '../../services/questService';
import Badge from '../../components/ui/Badge';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './DeletedQuestsPage.css';

const scrollPageToTop = () => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
};

const DeletedQuestsPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [restoringIds, setRestoringIds] = useState(new Set());

  useEffect(() => {
    scrollPageToTop();
  }, []);

  const loadDeletedQuests = async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getDeletedQuests(currentUser.uid);
      setQuests(data);
      setSelectedIds(new Set());
    } catch {
      setLoadError("Your deleted quests didn't load. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletedQuests();
  }, [currentUser]);

  const handleRestore = async (questId) => {
    setActionError(null);
    setRestoringIds(prev => new Set([...prev, questId]));
    try {
      await restoreQuest(currentUser.uid, questId);
      setQuests(prev => prev.filter(q => q.id !== questId));
      setSelectedIds(prev => { const n = new Set(prev); n.delete(questId); return n; });
    } catch {
      setActionError("That quest didn't restore. Try again.");
    } finally {
      setRestoringIds(prev => { const n = new Set(prev); n.delete(questId); return n; });
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
    if (selectedIds.size === quests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quests.map(q => q.id)));
    }
  };

  const allSelected = quests.length > 0 && selectedIds.size === quests.length;

  return (
    <div className="deleted-quests-page">
      <header className="deleted-quests-header">
        <button
          className="deleted-quests-back"
          onClick={() => navigate('/settings')}
          aria-label="Back to settings"
        >
          <span className="material-icons-outlined">arrow_back</span>
        </button>
        <h1 className="deleted-quests-title">Deleted Quests</h1>
      </header>

      <p className="deleted-quests-intro">
        Restore a quest to bring it back to your active list. Any linked achievement reward is restored too.
      </p>

      {loadError && (
        <ErrorMessage message={loadError} onRetry={loadDeletedQuests} />
      )}

      {loading && !loadError && (
        <p className="deleted-quests-empty">Loading...</p>
      )}

      {!loading && !loadError && quests.length === 0 && (
        <p className="deleted-quests-empty">No deleted quests.</p>
      )}

      {!loading && !loadError && quests.length > 0 && (
        <>
          <div className="dq-bulk-bar">
            <button className="dq-select-all-btn" onClick={toggleSelectAll}>
              <span className={`dq-checkbox ${allSelected ? 'dq-checkbox--checked' : ''}`}>
                {allSelected && <span className="material-icons">check</span>}
              </span>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {selectedIds.size > 0 && (
              <button
                className="dq-restore-selected-btn"
                onClick={handleRestoreSelected}
                disabled={restoringIds.size > 0}
              >
                <span className="material-icons">restore</span>
                Restore selected ({selectedIds.size})
              </button>
            )}
          </div>

          {actionError && <ErrorMessage message={actionError} />}

          <div className="deleted-quest-list">
            {quests.map(q => (
              <div key={q.id} className="dq-quest-item">
                <button
                  className="dq-checkbox-btn"
                  onClick={() => toggleSelect(q.id)}
                  aria-label={selectedIds.has(q.id) ? 'Deselect' : 'Select'}
                >
                  <span className={`dq-checkbox ${selectedIds.has(q.id) ? 'dq-checkbox--checked' : ''}`}>
                    {selectedIds.has(q.id) && <span className="material-icons">check</span>}
                  </span>
                </button>
                <div className="dq-quest-card">
                  <span className="dq-quest-title">{q.title}</span>
                  <Badge variant="difficulty" difficulty={q.difficulty}>
                    {q.difficulty}
                  </Badge>
                </div>
                <button
                  className="dq-restore-btn"
                  onClick={() => handleRestore(q.id)}
                  disabled={restoringIds.has(q.id)}
                  title="Restore"
                  aria-label="Restore quest"
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

export default DeletedQuestsPage;
