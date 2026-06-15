import Skeleton from '../../components/ui/Skeleton';
import MissionCardCondensedSkeleton from '../../components/missions/MissionCardCondensedSkeleton';
import './EditDailyMissionsPageSkeleton.css';

const EditDailyMissionsPageSkeleton = ({ isModal = false }) => {
  return (
    <div
      className={`daily-missions-container ${isModal ? 'modal-mode' : ''} edit-daily-missions-skeleton`}
      aria-hidden="true"
    >
      <header className="edmps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="50%" />
        <div />
      </header>

      <div className="edmps-section">
        <Skeleton height="14px" width="30%" />
        <MissionCardCondensedSkeleton titleWidth="60%" />
        <MissionCardCondensedSkeleton titleWidth="50%" />
        <MissionCardCondensedSkeleton titleWidth="55%" />
      </div>

      <div className="edmps-section">
        <Skeleton height="14px" width="40%" />
        <MissionCardCondensedSkeleton titleWidth="55%" />
        <MissionCardCondensedSkeleton titleWidth="65%" />
        <MissionCardCondensedSkeleton titleWidth="50%" />
        <MissionCardCondensedSkeleton titleWidth="60%" />
      </div>
    </div>
  );
};

export default EditDailyMissionsPageSkeleton;
