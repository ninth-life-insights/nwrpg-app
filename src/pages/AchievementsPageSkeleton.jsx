import Skeleton from '../components/ui/Skeleton';
import './AchievementsPageSkeleton.css';

// 2-col grid of achievement placeholders matching the real page's layout.
const AchievementsPageSkeleton = () => {
  const tiles = Array.from({ length: 8 });
  return (
    <div className="achievements-page achievements-page-skeleton" aria-hidden="true">
      <header className="aps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="45%" />
        <div />
      </header>

      <div className="aps-grid">
        {tiles.map((_, i) => (
          <div key={i} className="aps-tile">
            <Skeleton height="48px" width="48px" radius="999px" />
            <Skeleton height="13px" width="80%" />
            <Skeleton height="11px" width="55%" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementsPageSkeleton;
