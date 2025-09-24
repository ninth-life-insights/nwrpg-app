// src/components/missions/MissionFilterModal.js
import React, { useState, useEffect } from 'react';
import './MissionFilterModal.css';
import { AVAILABLE_SKILLS } from '../../../data/Skills';

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

const MissionFilterModal = ({ 
  isOpen, 
  onClose, 
  currentFilters, 
  onApplyFilters 
}) => {
  const [filters, setFilters] = useState({
    sortBy: 'dueDate',
    sortOrder: 'asc',
    skillFilter: '',
    includeCompleted: false,
    includeExpired: false,
    completedDateRange: 'last7days', // New field for completion date range
    ...currentFilters
  });

  // Update local state when currentFilters prop changes
  useEffect(() => {
    setFilters({
      sortBy: 'dueDate',
      sortOrder: 'asc',
      skillFilter: '',
      includeCompleted: false,
      includeExpired: false,
      completedDateRange: 'last7days',
      ...currentFilters
    });
  }, [currentFilters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApply = () => {
    onApplyFilters(filters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters = {
      sortBy: 'dueDate',
      sortOrder: 'asc',
      skillFilter: '',
      includeCompleted: false,
      includeExpired: false,
      completedDateRange: 'last7days'
    };
    setFilters(defaultFilters);
    onApplyFilters(defaultFilters);
    onClose();
  };

  if (!isOpen) return null;

  return (
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
          
          {/* Sort Options */}
          <div className="filter-section">
            <h4>Sort By</h4>
            <div className="sort-options">
              <select 
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="filter-select"
              >
                <option value="dueDate">Due Date</option>
                <option value="createdAt">Created Date</option>
                <option value="difficulty">Difficulty</option>
                <option value="title">Alphabetical</option>
              </select>
              
              <select 
                value={filters.sortOrder}
                onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                className="filter-select"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          {/* Skill Filter */}
          <div className="filter-section">
            <h4>Filter by Skill</h4>
            <select 
              value={filters.skillFilter}
              onChange={(e) => handleFilterChange('skillFilter', e.target.value)}
              className="filter-select full-width"
            >
              <option value="">All Skills</option>
              {AVAILABLE_SKILLS.map(skill => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </div>

          {/* Include Options */}
          <div className="filter-section">
            <h4>Include</h4>
            <div className="checkbox-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.includeCompleted}
                  onChange={(e) => handleFilterChange('includeCompleted', e.target.checked)}
                />
                <span className="checkmark"></span>
                Include Completed Missions
              </label>
              
              {/* Completion Date Range - Only show when includeCompleted is checked */}
              {filters.includeCompleted && (
                <div className="date-range-section">
                  <label className="date-range-label">Completed within:</label>
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
              
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={filters.includeExpired}
                  onChange={(e) => handleFilterChange('includeExpired', e.target.checked)}
                />
                <span className="checkmark"></span>
                Include Expired Missions
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="filter-modal-footer">
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

      </div>
    </div>
  );
};

export default MissionFilterModal;