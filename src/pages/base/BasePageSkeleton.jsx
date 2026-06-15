import Skeleton from '../../components/ui/Skeleton';
import './BasePageSkeleton.css';

const BasePageSkeleton = () => {
  const tiles = Array.from({ length: 6 });
  return (
    <div className="base-page-container base-page-skeleton" aria-hidden="true">
      <header className="bps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="40%" />
        <Skeleton height="32px" width="60px" radius="var(--radius-md)" />
      </header>

      <div className="bps-grid">
        {tiles.map((_, i) => (
          <div key={i} className="bps-tile">
            <Skeleton height="48px" width="48px" radius="var(--radius-sm)" />
            <Skeleton height="14px" width="70%" />
            <Skeleton height="11px" width="50%" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BasePageSkeleton;
