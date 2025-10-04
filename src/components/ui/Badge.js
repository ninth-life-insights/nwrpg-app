// src/components/ui/Badge.jsx
import React from 'react';
import './Badge.css';

const Badge = ({ 
  variant = 'default',
  icon, // Can be a string (material icon name) or JSX element
  difficulty, // For difficulty variants
  children 
}) => {
  let defaultIcon = icon;
  
  // Handle recurrence icon
  if (!icon && variant === 'recurrence') {
    defaultIcon = 'refresh';
  }
  
  // Handle difficulty stars
  if (!icon && variant === 'difficulty' && difficulty) {
    const numStars = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const stars = Array(numStars).fill(null).map((_, i) => (
      <span key={i} className="material-icons">star</span>
    ));
    defaultIcon = <>{stars}</>;
  }
  
  // Determine the actual variant class
  const variantClass = variant === 'difficulty' && difficulty 
    ? `difficulty-${difficulty}` 
    : variant;
  
  return (
    <span className={`badge badge-${variantClass}`}>
      {defaultIcon && (
        <span className="badge-icon">
          {typeof defaultIcon === 'string' ? (
            <span className="material-icons">{defaultIcon}</span>
          ) : (
            defaultIcon
          )}
        </span>
      )}
      <span className="badge-text">{children}</span>
    </span>
  );
};

export default Badge;