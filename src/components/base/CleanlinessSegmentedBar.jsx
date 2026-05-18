// src/components/base/CleanlinessSegmentedBar.jsx
import { CLEANLINESS_COLORS, CLEANLINESS_STALE_COLOR } from '../../utils/cleanlinessHelpers';
import './CleanlinessSegmentedBar.css';

const CleanlinessSegmentedBar = ({ segments, className = '' }) => {
  return (
    <div className={`cleanliness-segmented-bar${className ? ' ' + className : ''}`}>
      {segments.length > 0 ? segments.map(seg => (
        <div
          key={seg.id}
          className="cleanliness-segmented-bar-segment"
          style={{
            backgroundColor: seg.stale ? CLEANLINESS_STALE_COLOR : CLEANLINESS_COLORS[seg.cleanliness],
          }}
        />
      )) : (
        <div className="cleanliness-segmented-bar-segment cleanliness-segmented-bar-segment--empty" />
      )}
    </div>
  );
};

export default CleanlinessSegmentedBar;
