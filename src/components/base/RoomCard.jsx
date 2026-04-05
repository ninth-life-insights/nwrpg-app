// src/components/base/RoomCard.js
import React from 'react';
import './RoomCard.css';

const RoomCard = ({ room, stats, onClick }) => {
  // Calculate cleanliness color (1=red, 5=green)
  const getCleanlinessColor = (cleanliness) => {
    const colors = {
      1: '#ef4444', // red
      2: '#f97316', // orange
      3: '#eab308', // yellow
      4: '#84cc16', // lime
      5: '#10b981'  // green
    };
    return colors[cleanliness] || colors[3];
  };

  const cleanlinessColor = getCleanlinessColor(room.cleanliness);
  const cleanlinessPercentage = (room.cleanliness / 5) * 100;

  return (
    <div className="room-card" onClick={onClick}>
      <div className="room-card-header">
        <div className="room-icon">
          <span className="material-icons">{room.icon}</span>
        </div>
        <h3 className="room-name">{room.name}</h3>
      </div>

      <div className="room-stats-grid">
        <div className="stat-item">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">All Tasks</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.dueThisWeek}</div>
          <div className="stat-label">Due This Week</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.overdue}</div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="cleanliness-section">
        <div className="cleanliness-bar-container">
          <div 
            className="cleanliness-bar-fill"
            style={{ 
              width: `${cleanlinessPercentage}%`,
              backgroundColor: cleanlinessColor
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default RoomCard;