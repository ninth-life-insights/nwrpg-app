// src/pages/AdventureLogPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile } from '../services/userService';
import {
  getAllDailySnapshots,
  getDatesWithActivity,
  generateDailySnapshot,
} from '../services/reviewService';
import AdventureLogCard from '../components/review/AdventureLogCard';
import WeeklyAdventureLogCard from '../components/review/WeeklyAdventureLogCard';
import AdventureLogFilterModal, { DEFAULT_FILTERS } from '../components/review/AdventureLogFilterModal';
import { getAllWeeklySnapshots } from '../services/weeklyReviewService';
import ErrorMessage from '../components/ui/ErrorMessage';
import { withTimeout, isDefinitelyOffline, getLoadErrorMessage } from '../utils/fetchWithTimeout';
import './AdventureLogPage.css';

// Format "2026-04" → "April 2026"
const formatMonthHeader = (yearMonth) => {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// Returns YYYY-MM-DD for start of this week (Monday)
const getWeekStart = () => {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
};

// Returns YYYY-MM-DD for start of this month
const getMonthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// Returns YYYY-MM-DD for 30 days ago
const get30DaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const applyDateRange = (date, dateRange) => {
  if (dateRange === 'alltime') return true;
  if (dateRange === 'this-week') return date >= getWeekStart();
  if (dateRange === 'this-month') return date >= getMonthStart();
  if (dateRange === 'last-30') return date >= get30DaysAgo();
  return true;
};

const isHighlight = (entry) => {
  if (entry.type === 'placeholder') return false;
  return (
    entry.levelUps?.length > 0 ||
    entry.skillLevelUps?.length > 0 ||
    entry.questsCompleted?.length > 0
  );
};

const AdventureLogPage = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [snapshots, setSnapshots] = useState([]);
  const [weeklySnapshots, setWeeklySnapshots] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoadingSlow, setIsLoadingSlow] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [generatingDate, setGeneratingDate] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const loadData = async () => {
    if (!currentUser) return;
    if (isDefinitelyOffline()) {
      setLoadError("Your adventure log didn't load. Check your connection and try again.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setIsLoadingSlow(false);
    const slowTimer = setTimeout(() => setIsLoadingSlow(true), 3000);
    try {
      const [snaps, holes, weeklies] = await withTimeout(
        Promise.all([
          getAllDailySnapshots(currentUser.uid),
          getDatesWithActivity(currentUser.uid),
          getAllWeeklySnapshots(currentUser.uid),
        ])
      );
      setSnapshots(snaps);
      setPlaceholders(holes);
      setWeeklySnapshots(weeklies);
    } catch (err) {
      console.error('Error loading adventure log:', err);
      setLoadError(getLoadErrorMessage(err, 'adventure log'));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setIsLoadingSlow(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser, reloadTrigger]);

  const handleGenerate = async (date) => {
    if (generatingDate) return;
    setGeneratingDate(date);
    try {
      const profile = await getUserProfile(currentUser.uid);
      const displayName = profile?.displayName || 'You';
      const newSnapshot = await generateDailySnapshot(currentUser.uid, date, displayName);
      // Move from placeholders to snapshots
      setPlaceholders(prev => prev.filter(p => p.date !== date));
      setSnapshots(prev => [newSnapshot, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      console.error('Error generating entry:', err);
    } finally {
      setGeneratingDate(null);
    }
  };

  // Merge snapshots + placeholders + weekly into a unified sorted list
  const allEntries = useMemo(() => {
    const snapshotEntries = snapshots.map(s => ({ ...s, type: 'snapshot' }));
    const placeholderEntries = placeholders.map(p => ({ ...p, type: 'placeholder' }));
    const weeklyEntries = weeklySnapshots.map(w => ({ ...w, type: 'weekly', date: w.weekStart }));
    return [...snapshotEntries, ...placeholderEntries, ...weeklyEntries]
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshots, placeholders, weeklySnapshots]);

  // Apply filters
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      if (!applyDateRange(entry.date, filters.dateRange)) return false;
      if (filters.entryStatus === 'reviews-only' && entry.type !== 'snapshot') return false;
      if (filters.entryStatus === 'weekly-only' && entry.type !== 'weekly') return false;
      if (filters.highlightsOnly && !isHighlight(entry)) return false;
      return true;
    });
  }, [allEntries, filters]);

  // Group by month (YYYY-MM)
  const grouped = useMemo(() => {
    const groups = {};
    filteredEntries.forEach(entry => {
      const month = entry.date.slice(0, 7);
      if (!groups[month]) groups[month] = [];
      groups[month].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEntries]);

  const activeFilterCount = [
    filters.entryStatus !== DEFAULT_FILTERS.entryStatus,
    filters.dateRange !== DEFAULT_FILTERS.dateRange,
    filters.highlightsOnly,
  ].filter(Boolean).length;

  return (
    <div className="adventure-log-page">
      <header className="adventure-log-header">
        <button className="adventure-log-back-btn" onClick={() => navigate('/home')}>
          <span className="material-icons">arrow_back</span>
        </button>
        <h1 className="adventure-log-title">Adventure Log</h1>
        <button
          className={`adventure-log-filter-btn ${activeFilterCount > 0 ? 'adventure-log-filter-btn--active' : ''}`}
          onClick={() => setFilterOpen(true)}
        >
          <span className="material-icons">tune</span>
          {activeFilterCount > 0 && (
            <span className="adventure-log-filter-count">{activeFilterCount}</span>
          )}
        </button>
      </header>

      {loadError && (
        <ErrorMessage
          message={loadError}
          onRetry={() => { setLoadError(null); setReloadTrigger(t => t + 1); }}
        />
      )}

      <div className="adventure-log-content">
        {loading ? (
          <p className="adventure-log-loading">
            Loading your chronicle...
            {isLoadingSlow && <span className="loading-slow-hint"> The quest board is being restocked...</span>}
          </p>
        ) : loadError ? null : grouped.length === 0 ? (
          <div className="adventure-log-empty">
            <span className="material-icons">auto_stories</span>
            <p>No entries yet. Complete some missions and do your first daily review to start your log.</p>
          </div>
        ) : (
          grouped.map(([month, entries]) => (
            <div key={month} className="adventure-log-month-group">
              <h2 className="adventure-log-month-header">{formatMonthHeader(month)}</h2>
              <div className="adventure-log-entries">
                {entries.map(entry => (
                  entry.type === 'weekly' ? (
                    <WeeklyAdventureLogCard
                      key={`weekly-${entry.date}`}
                      snapshot={entry}
                    />
                  ) : (
                    <AdventureLogCard
                      key={`daily-${entry.date}`}
                      entry={entry}
                      onGenerate={handleGenerate}
                      generatingDate={generatingDate}
                    />
                  )
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <AdventureLogFilterModal
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        currentFilters={filters}
        onApplyFilters={setFilters}
      />
    </div>
  );
};

export default AdventureLogPage;
