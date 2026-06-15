import Skeleton from '../ui/Skeleton';
import './MissionCardCondensedSkeleton.css';

// Matches MissionCardCondensed's tighter shell. The HomePage daily missions
// list uses the daily tint (yellow) for live cards — the skeleton stays on
// the neutral cream so the swap doesn't briefly paint a yellow strip.
const MissionCardCondensedSkeleton = ({ titleWidth = '55%' }) => {
  return (
    <div className="mission-card-condensed-skeleton" aria-hidden="true">
      <div className="mcc-skeleton-content">
        <Skeleton height="16px" width={titleWidth} radius="var(--radius-sm)" />
        <Skeleton height="14px" width="35%" radius="var(--radius-sm)" />
      </div>
      <Skeleton height="28px" width="28px" radius="999px" />
    </div>
  );
};

export default MissionCardCondensedSkeleton;
