// src/components/missions/EditDailyMissionsModal.js
import React from 'react';
import EditDailyMissionsPage from '../../pages/EditDailyMissionsPage';
import './EditDailyMissionsModal.css';

const EditDailyMissionsModal = ({ 
  currentDailyMissions, 
  onClose, 
  onSave 
}) => {
  const handleComplete = async () => {
    // Call the parent's onSave callback to refresh data
    if (onSave) {
      await onSave();
    }
    // Modal will close automatically via onSave callback
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="edit-daily-missions-modal-overlay" onClick={handleBackdropClick}>
      <div className="edit-daily-missions-modal-container">
        
        {/* Modal Header */}
        <div className="edit-daily-missions-modal-header">
          <h2 className="modal-title">Daily Mission Planning</h2>
          <button className="modal-close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Modal Content - Embedded EditDailyMissionsPage */}
        <div className="edit-daily-missions-modal-content">
          <EditDailyMissionsPage 
            isModal={true}
            onComplete={handleComplete}
            showNavigation={false}
          />
        </div>
      </div>
    </div>
  );
};

export default EditDailyMissionsModal;