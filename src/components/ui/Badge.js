// src/components/ui/Badge.jsx
import React from 'react';
import './Badge.css';

const Badge = ({ 
  variant = 'default',
  icon,
  iconPosition = 'left',
  children 
}) => {
  // Auto-assign icons based on variant
  let defaultIcon = icon;
  
  if (!icon && variant === 'recurrence') {
    defaultIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.5 0 4.74 1.02 6.36 2.68l1.39-1.39"/>
        <path d="M17 8l4 4-4 4"/>
      </svg>
    );
  }
  
  return (
    <span className={`badge badge-${variant}`}>
      {defaultIcon && iconPosition === 'left' && (
        <span className="badge-icon">{defaultIcon}</span>
      )}
      <span className="badge-text">{children}</span>
      {defaultIcon && iconPosition === 'right' && (
        <span className="badge-icon">{defaultIcon}</span>
      )}
    </span>
  );
};

export default Badge;