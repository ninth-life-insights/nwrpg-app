import Skeleton from '../ui/Skeleton';
import './MissionCardSkeleton.css';

// Layout-matched placeholder for MissionCard. Keeps the same outer
// dimensions, padding, and inner shape so swapping to the real card
// doesn't cause any layout shift.
const MissionCardSkeleton = ({ titleWidth = '60%' }) => {
  return (
    <div className="mission-card-skeleton" aria-hidden="true">
      <div className="mission-card-skeleton-content">
        <Skeleton height="18px" width={titleWidth} radius="var(--radius-sm)" />
        <div className="mission-card-skeleton-badges">
          <Skeleton height="20px" width="56px" radius="999px" />
          <Skeleton height="20px" width="72px" radius="999px" />
        </div>
      </div>
      <Skeleton height="32px" width="32px" radius="999px" />
    </div>
  );
};

export default MissionCardSkeleton;
