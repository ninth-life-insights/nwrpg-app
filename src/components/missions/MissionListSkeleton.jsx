import MissionCardSkeleton from './MissionCardSkeleton';
import './MissionListSkeleton.css';

// Placeholder list of mission cards. Default 5 — long enough to feel like
// content is loading, short enough to render quickly.
const MissionListSkeleton = ({ count = 5 }) => {
  // Slightly vary title widths so the placeholders don't read as a strict
  // repeating pattern.
  const titleWidths = ['65%', '55%', '70%', '45%', '60%', '52%', '68%', '50%'];

  return (
    <div className="mission-list-skeleton" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <MissionCardSkeleton key={i} titleWidth={titleWidths[i % titleWidths.length]} />
      ))}
    </div>
  );
};

export default MissionListSkeleton;
