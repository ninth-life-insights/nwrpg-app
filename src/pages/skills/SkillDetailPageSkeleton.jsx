import Skeleton from '../../components/ui/Skeleton';
import MissionCardSkeleton from '../../components/missions/MissionCardSkeleton';
import './SkillDetailPageSkeleton.css';

const SkillDetailPageSkeleton = () => {
  return (
    <div className="skill-detail-page skill-detail-page-skeleton" aria-hidden="true">
      <header className="sdps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="55%" />
        <div />
      </header>

      <div className="sdps-progress-card">
        <div className="sdps-progress-row">
          <Skeleton height="14px" width="20%" />
          <Skeleton height="12px" width="25%" />
        </div>
        <Skeleton height="8px" width="100%" radius="4px" />
      </div>

      <div className="sdps-list">
        <MissionCardSkeleton titleWidth="55%" />
        <MissionCardSkeleton titleWidth="65%" />
        <MissionCardSkeleton titleWidth="50%" />
      </div>
    </div>
  );
};

export default SkillDetailPageSkeleton;
