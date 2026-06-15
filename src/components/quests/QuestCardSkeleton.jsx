import Skeleton from '../ui/Skeleton';
import './QuestCardSkeleton.css';

const QuestCardSkeleton = ({ titleWidth = '55%' }) => {
  return (
    <div className="quest-card-skeleton" aria-hidden="true">
      <Skeleton height="36px" width="36px" radius="999px" />
      <div className="quest-card-skeleton-body">
        <Skeleton height="20px" width={titleWidth} />
        <Skeleton height="14px" width="80%" />
        <Skeleton height="6px" width="100%" radius="3px" />
      </div>
      <Skeleton height="40px" width="40px" radius="999px" />
    </div>
  );
};

export default QuestCardSkeleton;
