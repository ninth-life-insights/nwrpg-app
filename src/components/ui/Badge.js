// src/components/ui/Badge.jsx
import React from 'react';
import './Badge.css';

const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px">
    <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z" />
  </svg>
);

const Badge = ({ 
  variant = 'default',
  icon,
  difficulty, // For difficulty variants
  children 
}) => {
  let defaultIcon = icon;
  
  // Handle recurrence icon
  if (!icon && variant === 'recurrence') {
    defaultIcon = (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.5 0 4.74 1.02 6.36 2.68l1.39-1.39"/>
        <path d="M17 8l4 4-4 4"/>
      </svg>
    );
  }
  
  // Handle difficulty stars
  if (!icon && variant === 'difficulty' && difficulty) {
    const numStars = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const stars = Array(numStars).fill(null).map((_, i) => <StarIcon key={i} />);
    defaultIcon = <>{stars}</>;
  }
  
  // Determine the actual variant class
  const variantClass = variant === 'difficulty' && difficulty 
    ? `difficulty-${difficulty}` 
    : variant;
  
  return (
    <span className={`badge badge-${variantClass}`}>
      {defaultIcon && (
        <span className="badge-icon">{defaultIcon}</span>
      )}
      <span className="badge-text">{children}</span>
    </span>
  );
};

export default Badge;