import Skeleton from '../../components/ui/Skeleton';
import './SkillsPageSkeleton.css';

const SkillsPageSkeleton = () => {
  const rows = Array.from({ length: 8 });
  return (
    <div className="skills-page skills-page-skeleton" aria-hidden="true">
      <header className="sps-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="35%" />
        <div />
      </header>

      <div className="sps-list">
        {rows.map((_, i) => (
          <div key={i} className="sps-row">
            <div className="sps-row-top">
              <Skeleton height="14px" width="40%" />
              <Skeleton height="12px" width="20%" />
            </div>
            <Skeleton height="6px" width="100%" radius="3px" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillsPageSkeleton;
