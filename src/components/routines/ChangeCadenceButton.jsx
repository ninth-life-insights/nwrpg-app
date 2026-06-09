// src/components/routines/ChangeCadenceButton.jsx
import { useState } from 'react';
import ChangeCadenceSheet from './ChangeCadenceSheet';
import './ChangeCadenceButton.css';

// Single icon button that opens the cadence-change sheet for a routine
// mission. Self-contained: surfaces just drop this into an actionSlot
// (or anywhere they want) without managing modal state themselves.
const ChangeCadenceButton = ({ mission, onChanged }) => {
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      <button
        type="button"
        className="change-cadence-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setShowSheet(true);
        }}
        title="Change cadence"
        aria-label="Change cadence"
      >
        <span className="material-icons">swap_horiz</span>
      </button>

      {showSheet && (
        <ChangeCadenceSheet
          mission={mission}
          onClose={() => setShowSheet(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
};

export default ChangeCadenceButton;
