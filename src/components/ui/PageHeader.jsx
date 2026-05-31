// src/components/ui/PageHeader.jsx
import './PageHeader.css';

// Standard top-of-page header: back button on the left, centered title,
// optional right-side action slot. Matches the visual treatment used by
// MissionBank / QuestBank / etc. so pages feel like siblings instead of
// each rolling their own header style.
//
// Props:
//   title     — string heading
//   onBack    — optional back-button click handler. When omitted, a spacer
//               occupies the left slot so the title stays centered.
//   action    — optional JSX for the right side (e.g. a "Filter" or
//               "Edit routine" button). When omitted, a spacer occupies
//               the right slot for symmetry.
const PageHeader = ({ title, onBack, action }) => {
  return (
    <div className="page-header">
      {onBack ? (
        <button
          type="button"
          className="page-header-back"
          onClick={onBack}
          aria-label="Back"
        >
          <span className="material-icons">arrow_back</span>
        </button>
      ) : (
        <div className="page-header-spacer" />
      )}
      <h1 className="page-header-title">{title}</h1>
      {action ? (
        <div className="page-header-action">{action}</div>
      ) : (
        <div className="page-header-spacer" />
      )}
    </div>
  );
};

export default PageHeader;
