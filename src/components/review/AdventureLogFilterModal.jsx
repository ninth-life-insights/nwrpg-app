// src/components/review/AdventureLogFilterModal.jsx
import { useState, useEffect } from 'react';
import './AdventureLogFilterModal.css';

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
    <div className="al-filter-overlay" onClick={onClose}>
      <div className="al-filter-modal" onClick={e => e.stopPropagation()}>

        <div className="al-filter-header">
          <h3>Filter Log</h3>
          <button className="al-filter-close" onClick={onClose}>
            <span className="material-icons">close</span>
          </button>
        </div>

        <div className="al-filter-content">

          <div className="al-filter-section">
            <h4>Show</h4>
            <div className="al-filter-options">
              <label className={`al-filter-option ${filters.entryStatus === 'all' ? 'al-filter-option--active' : ''}`}>
                <input
                  type="radio"
                  name="entryStatus"
                  value="all"
                  checked={filters.entryStatus === 'all'}
                  onChange={() => set('entryStatus', 'all')}
                />
                All days with activity
              </label>
              <label className={`al-filter-option ${filters.entryStatus === 'reviews-only' ? 'al-filter-option--active' : ''}`}>
                <input
                  type="radio"
                  name="entryStatus"
                  value="reviews-only"
                  checked={filters.entryStatus === 'reviews-only'}
                  onChange={() => set('entryStatus', 'reviews-only')}
                />
                Reviews only
              </label>
            </div>
          </div>

          <div className="al-filter-section">
            <h4>Date range</h4>
            <div className="al-filter-options">
              {[
                { value: 'alltime', label: 'All time' },
                { value: 'this-week', label: 'This week' },
                { value: 'this-month', label: 'This month' },
                { value: 'last-30', label: 'Last 30 days' },
              ].map(({ value, label }) => (
                <label
                  key={value}
                  className={`al-filter-option ${filters.dateRange === value ? 'al-filter-option--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="dateRange"
                    value={value}
                    checked={filters.dateRange === value}
                    onChange={() => set('dateRange', value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="al-filter-section">
            <h4>Highlights</h4>
            <label className="al-filter-toggle">
              <input
                type="checkbox"
                checked={filters.highlightsOnly}
                onChange={e => set('highlightsOnly', e.target.checked)}
              />
              <span className="al-filter-toggle-track" />
              Only show notable days (level-ups, quest completions)
            </label>
          </div>

        </div>

        <div className="al-filter-footer">
          <button className="al-filter-btn al-filter-btn--secondary" onClick={handleReset}>
            Reset
          </button>
          <button className="al-filter-btn al-filter-btn--primary" onClick={handleApply}>
            Apply
          </button>
        </div>

      </div>
    </div>
  );
};

export { DEFAULT_FILTERS };
export default AdventureLogFilterModal;
