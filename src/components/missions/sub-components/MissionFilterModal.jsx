// src/components/missions/MissionFilterModal.js
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MissionFilterModal.css';
import { AVAILABLE_SKILLS } from '../../../data/Skills';
import { useModalBackButton } from '../../../hooks/useModalBackButton';

// Helper function to check if a mission's completion date falls within the specified range
export const isWithinCompletedDateRange = (mission, dateRange) => {
  // If mission isn't completed or has no completedAt timestamp, return false
  if (mission.status !== 'completed' || !mission.completedAt) {
    return false;
  }

  // Convert Firestore timestamp to JavaScript Date
  const completedDate = mission.completedAt.toDate ? mission.completedAt.toDate() : new Date(mission.completedAt);
  const now = new Date();

  switch (dateRange) {
    case 'today':
      // Check if completed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return completedDate >= today && completedDate < tomorrow;

    case 'last7days':
      // Check if completed in last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= sevenDaysAgo && completedDate <= now;

    case 'last30days':
      // Check if completed in last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= thirtyDaysAgo && completedDate <= now;

    case 'alltime':
      // Include all completed missions regardless of date
      return true;

    default:
      // Default to last 7 days if invalid range provided
      const defaultSevenDaysAgo = new Date();
      defaultSevenDaysAgo.setDate(defaultSevenDaysAgo.getDate() - 7);
      defaultSevenDaysAgo.setHours(0, 0, 0, 0);
      return completedDate >= defaultSevenDaysAgo && completedDate <= now;
  }
};

const FILTER_DEFAULTS = {
  sortBy: 'custom',
  sortOrder: 'asc',
  skillFilter: '',
  includeCompleted: false,
  showArchive: false,
  completedDateRange: 'last7days',
  roomFilter: '',
  taskTypeFilter: '',
  questFilter: ''
};

const MissionFilterModal = ({
  isOpen,
  onClose,
  currentFilters,
  onApplyFilters,
  rooms = [],
  quests = [],
  showArchiveToggle = true
}) => {
  const [filters, setFilters] = useState({
    ...FILTER_DEFAULTS,
    ...currentFilters
  });

  useModalBackButton(isOpen, onClose);

  // Update local state when currentFilters prop changes
  useEffect(() => {
    setFilters({
      ...FILTER_DEFAULTS,
      ...currentFilters
    });
  }, [currentFilters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Archive view and include-completed are mutually exclusive
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
    setFilters(FILTER_DEFAULTS);
    onApplyFilters(FILTER_DEFAULTS);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="filter-modal-header">
          <h3>Filter & Sort Missions</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Filter Content */}
        <div className="filter-modal-content">

          {/* Sort — one row of two */}
          <div className="filter-group">
            <h3 className="filter-group-header">
              Sort
              {(filters.sortBy !== 'custom' || filters.sortOrder !== 'asc') && (
                <span className="filter-active-dot-inline" />
              )}
            </h3>
            <div className="filter-pair-row">
              <div className="filter-section">
                <h4>
                  Sort by
                  {filters.sortBy !== 'custom' && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="custom">Custom Order</option>
                  <option value="dueDate">Due Date</option>
                  <option value="createdAt">Created Date</option>
                  <option value="difficulty">Difficulty</option>
                  <option value="title">Alphabetical</option>
                </select>
              </div>

              <div className="filter-section">
                <h4>
                  Order
                  {filters.sortOrder !== 'asc' && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Filter — 2×2 grid */}
          <div className="filter-group">
            <h3 className="filter-group-header">
              Filter
              {(filters.taskTypeFilter || filters.skillFilter || filters.roomFilter || filters.questFilter || filters.includeCompleted) && (
                <span className="filter-active-dot-inline" />
              )}
            </h3>
            <div className="filter-grid">
              <div className="filter-section">
                <h4>
                  Task type
                  {filters.taskTypeFilter && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.taskTypeFilter}
                  onChange={(e) => handleFilterChange('taskTypeFilter', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="">Any</option>
                  <option value="unique">Standard</option>
                  <option value="recurring">Recurring</option>
                  <option value="evergreen">Evergreen</option>
                </select>
              </div>

              <div className="filter-section">
                <h4>
                  Skill
                  {filters.skillFilter && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.skillFilter}
                  onChange={(e) => handleFilterChange('skillFilter', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="">Any</option>
                  <option value="__has_skill__">All skills</option>
                  {AVAILABLE_SKILLS.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
              </div>

              {rooms.length > 0 && (
                <div className="filter-section">
                  <h4>
                    Room
                    {filters.roomFilter && <span className="filter-active-dot-inline" />}
                  </h4>
                  <select
                    value={filters.roomFilter}
                    onChange={(e) => handleFilterChange('roomFilter', e.target.value)}
                    className="filter-select full-width"
                  >
                    <option value="">Any</option>
                    <option value="__has_room__">All rooms</option>
                    {rooms.map(room => (
                      <option key={room.id} value={room.id}>{room.name}</option>
                    ))}
                    <option value="__unassigned__">Unassigned</option>
                  </select>
                </div>
              )}

              <div className="filter-section">
                <h4>
                  Quest
                  {filters.questFilter && <span className="filter-active-dot-inline" />}
                </h4>
                <select
                  value={filters.questFilter}
                  onChange={(e) => handleFilterChange('questFilter', e.target.value)}
                  className="filter-select full-width"
                >
                  <option value="">Any</option>
                  <option value="__has_quest__">All quests</option>
                  <option value="__none__">No quest</option>
                  {quests
                    .filter(q => q.status !== 'deleted')
                    .map(q => (
                      <option key={q.id} value={q.id}>{q.title}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Completed — full width below the grid */}
            <div className="filter-section filter-section-completed">
              <h4>
                Completed
                {filters.includeCompleted && <span className="filter-active-dot-inline" />}
              </h4>
              <div className="checkbox-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={filters.includeCompleted}
                    onChange={(e) => handleFilterChange('includeCompleted', e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Include completed
                </label>

                {filters.includeCompleted && (
                  <div className="date-range-section">
                    <label className="date-range-label">Within:</label>
                    <select
                      value={filters.completedDateRange}
                      onChange={(e) => handleFilterChange('completedDateRange', e.target.value)}
                      className="filter-select date-range-select"
                    >
                      <option value="today">Today</option>
                      <option value="last7days">Last 7 days</option>
                      <option value="last30days">Last 30 days</option>
                      <option value="alltime">All time</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="filter-modal-footer">
          <div className="filter-modal-footer-buttons">
            <button
              onClick={handleReset}
              className="filter-btn secondary"
            >
              Reset to Default
            </button>
            <button
              onClick={handleApply}
              className="filter-btn primary"
            >
              Apply Filters
            </button>
          </div>
          {showArchiveToggle && (
            <button
              className={`archive-link-btn ${filters.showArchive ? 'active' : ''}`}
              onClick={() => {
                const next = { ...filters, showArchive: !filters.showArchive, includeCompleted: false };
                onApplyFilters(next);
                onClose();
              }}
            >
              {filters.showArchive ? 'Back to missions →' : 'View archive →'}
            </button>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};

export default MissionFilterModal;