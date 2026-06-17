import Skeleton from '../ui/Skeleton';
import './RoutineGridSkeleton.css';

// Shared skeleton for the week-view and month-view grids. Mirrors a generic
// 7-column day grid with a few cards per cell.
const RoutineGridSkeleton = ({ rows = 1 }) => {
  const cells = Array.from({ length: 7 * rows });
  return (
    <div className="routine-grid-skeleton" aria-hidden="true">
      <div className="rgs-header-row">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} height="14px" />
        ))}
      </div>
      <div className="rgs-grid" style={{ gridTemplateRows: `repeat(${rows}, 1fr)` }}>
        {cells.map((_, i) => (
          <div key={i} className="rgs-cell">
            <Skeleton height="10px" width="60%" />
            {i % 3 === 0 && <Skeleton height="14px" width="80%" />}
            {i % 2 === 0 && <Skeleton height="14px" width="65%" />}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoutineGridSkeleton;
