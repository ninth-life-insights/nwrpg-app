// src/components/review/BaseCheckinStep.jsx
import React from 'react';
import StickyFooter from '../ui/StickyFooter';

const BaseCheckinStep = ({ onNext, onBack }) => {
  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Base Check-in</h2>
        <p className="review-step-subtext">
          How's your home base looking this week?
        </p>

        {/* Base feature coming soon */}
        {/* <BaseRoomsOverview /> */}

        <p className="review-step-empty">
          Base management is coming soon. Check back in a future update.
        </p>
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next
        </button>
        <button className="review-skip-link" onClick={onBack}>
          Back
        </button>
      </StickyFooter>
    </div>
  );
};

export default BaseCheckinStep;
