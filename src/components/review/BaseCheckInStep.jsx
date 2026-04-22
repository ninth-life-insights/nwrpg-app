// src/components/review/BaseCheckInStep.jsx
import StickyFooter from '../ui/StickyFooter';

const BaseCheckInStep = ({ onNext, onSkipToSummary }) => {
  return (
    <div className="review-step">
      <div className="review-step-body">
        <h2 className="review-step-heading">Base Check-In</h2>
        {/* TODO: Base check-in feature — not yet implemented */}
        <p className="review-step-subtext">
          Base management coming soon. Skip ahead to get started.
        </p>
      </div>

      <StickyFooter>
        <button className="review-next-btn" onClick={onNext}>
          Next →
        </button>
        <button className="review-skip-link" onClick={onSkipToSummary}>
          Skip to summary
        </button>
      </StickyFooter>
    </div>
  );
};

export default BaseCheckInStep;
