import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalBackButton } from '../../hooks/useModalBackButton';
import { QUEST_DIFFICULTY } from '../../types/Quests';
import '../missions/sub-components/MissionFilterModal.css';

export const QUEST_FILTER_DEFAULTS = {
  difficulty: '',
  includeCompleted: false,
  showArchive: false,
};

const QuestFilterModal = ({
  isOpen,
  onClose,
  currentFilters,
  onApplyFilters,
}) => {
  const [filters, setFilters] = useState({
    ...QUEST_FILTER_DEFAULTS,
    ...currentFilters,
  });

  useModalBackButton(isOpen, onClose);

  useEffect(() => {
    setFilters({
      ...QUEST_FILTER_DEFAULTS,
      ...currentFilters,
    });
  }, [currentFilters]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'showArchive' && value) next.includeCompleted = false;
      if (key === 'includeCompleted' && value) next.showArchive = false;
      return next;
    });
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters(QUEST_FILTER_DEFAULTS);
    onApplyFilters(QUEST_FILTER_DEFAULTS);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
        <div className="filter-modal-header">
          <h3>Filter Quests</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="filter-modal-content">
          <div className="filter-group">
            <h3 className="filter-group-header">
              Filter
              {(filters.difficulty || filters.includeCompleted) && (
                <span className="filter-active-dot-inline" />
              )}
            </h3>

            <div className="filter-pair-row">
              <div className="filter-section">
                <h4>
                  Difficulty
                  {filters.difficulty && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.difficulty}
                  onChange={(e) => handleFilterChange('difficulty', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="">Any</option>
                  {Object.values(QUEST_DIFFICULTY).map((d) => (
                    <option key={d} value={d}>
                      {d.charAt(0).toUpperCase() + d.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="filter-section filter-section-completed">
              <h4>
                Completed
                {filters.includeCompleted && <span className="filter-active-dot-inline" />}
              </h4>
              <div className="completed-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.includeCompleted}
                    onChange={(e) => handleFilterChange('includeCompleted', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Include completed
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="filter-modal-footer">
          <div className="filter-modal-footer-buttons">
            <button onClick={handleReset} className="filter-btn secondary">
              Reset to Default
            </button>
            <button onClick={handleApply} className="filter-btn primary">
              Apply Filters
            </button>
          </div>
          <button
            className={`archive-link-btn ${filters.showArchive ? 'active' : ''}`}
            onClick={() => {
              const next = { ...filters, showArchive: !filters.showArchive, includeCompleted: false };
              onApplyFilters(next);
              onClose();
            }}
          >
            {filters.showArchive ? 'Back to quests →' : 'View archive →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuestFilterModal;
