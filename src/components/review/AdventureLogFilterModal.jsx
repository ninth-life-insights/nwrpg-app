// src/components/review/AdventureLogFilterModal.jsx
import { useState, useEffect } from 'react';
import '../missions/sub-components/MissionFilterModal.css';

const DEFAULT_FILTERS = {
  entryStatus: 'all',    // 'all' | 'reviews-only'
  dateRange: 'alltime',  // 'alltime' | 'this-week' | 'this-month' | 'last-30'
  highlightsOnly: false,
};

const AdventureLogFilterModal = ({ isOpen, onClose, currentFilters, onApplyFilters }) => {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...currentFilters });

  useEffect(() => {
    setFilters({ ...DEFAULT_FILTERS, ...currentFilters });
  }, [currentFilters]);

  const set = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    onApplyFilters(DEFAULT_FILTERS);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={e => e.stopPropagation()}>

        <div className="filter-modal-header">
          <h3>Filter Log</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="filter-modal-content">

          <div className="filter-section">
            <h4>Show</h4>
            <select
              value={filters.entryStatus}
              onChange={e => set('entryStatus', e.target.value)}
              className="filter-select full-width"
            >
              <option value="all">All days with activity</option>
              <option value="reviews-only">Daily reviews only</option>
              <option value="weekly-only">Weekly reviews only</option>
            </select>
          </div>

          <div className="filter-section">
            <h4>Date Range</h4>
            <select
              value={filters.dateRange}
              onChange={e => set('dateRange', e.target.value)}
              className="filter-select full-width"
            >
              <option value="alltime">All time</option>
              <option value="this-week">This week</option>
              <option value="this-month">This month</option>
              <option value="last-30">Last 30 days</option>
            </select>
          </div>

          <div className="filter-section">
            <h4>Highlights</h4>
            <div className="checkbox-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.highlightsOnly}
                  onChange={e => set('highlightsOnly', e.target.checked)}
                />
                <span className="checkmark"></span>
                Only show notable days (level-ups, quest completions)
              </label>
            </div>
          </div>

        </div>

        <div className="filter-modal-footer">
          <button onClick={handleReset} className="filter-btn secondary">
            Reset to Default
          </button>
          <button onClick={handleApply} className="filter-btn primary">
            Apply Filters
          </button>
        </div>

      </div>
    </div>
  );
};

export { DEFAULT_FILTERS };
export default AdventureLogFilterModal;
