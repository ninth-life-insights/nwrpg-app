// src/components/missions/MissionFilterModal.js
import React, { useState, useEffect } from 'react';
import './MissionFilterModal.css';

// Available skills - you can import this from a constants file
const AVAILABLE_SKILLS = [
  'Cooking', 'Cleaning', 'Organization', 'Time Management', 'Parenting',
  'Self Care', 'Exercise', 'Reading', 'Learning', 'Creativity',
  'Communication', 'Planning', 'Budgeting', 'Health', 'Productivity'
];

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
      includeExpired: false
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