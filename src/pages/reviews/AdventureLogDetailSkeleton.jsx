import Skeleton from '../../components/ui/Skeleton';
import './AdventureLogDetailSkeleton.css';

const AdventureLogDetailSkeleton = () => {
  return (
    <div className="adventure-log-detail-skeleton" aria-hidden="true">
      <div className="aldds-summary">
        <div className="aldds-summary-row">
          <Skeleton height="32px" width="32px" radius="999px" />
          <Skeleton height="14px" width="30%" />
        </div>
        <div className="aldds-summary-row">
          <Skeleton height="32px" width="32px" radius="999px" />
          <Skeleton height="14px" width="40%" />
        </div>
        <div className="aldds-summary-row">
          <Skeleton height="32px" width="32px" radius="999px" />
          <Skeleton height="14px" width="35%" />
        </div>
      </div>

      <div className="aldds-story">
        <Skeleton height="14px" width="90%" />
        <Skeleton height="14px" width="100%" />
        <Skeleton height="14px" width="85%" />
        <Skeleton height="14px" width="95%" />
        <Skeleton height="14px" width="60%" />
      </div>
    </div>
  );
};

export default AdventureLogDetailSkeleton;
