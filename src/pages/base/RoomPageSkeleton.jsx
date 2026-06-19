import Skeleton from '../../components/ui/Skeleton';
import MissionCardSkeleton from '../../components/missions/MissionCardSkeleton';
import './RoomPageSkeleton.css';

const RoomPageSkeleton = () => {
  return (
    <div className="room-page room-page-skeleton" aria-hidden="true">
      <header className="rps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="45%" />
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
      </header>

      <div className="rps-meta">
        <Skeleton height="14px" width="60%" />
        <Skeleton height="8px" width="100%" radius="4px" />
      </div>

      <div className="rps-list">
        <MissionCardSkeleton titleWidth="60%" />
        <MissionCardSkeleton titleWidth="50%" />
        <MissionCardSkeleton titleWidth="55%" />
        <MissionCardSkeleton titleWidth="65%" />
      </div>
    </div>
  );
};

export default RoomPageSkeleton;
