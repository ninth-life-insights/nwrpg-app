import Skeleton from '../../components/ui/Skeleton';
import QuestCardSkeleton from '../../components/quests/QuestCardSkeleton';
import './QuestBankPageSkeleton.css';

const QuestBankPageSkeleton = () => {
  return (
    <div className="quest-bank-page quest-bank-page-skeleton" aria-hidden="true">
      <div className="qbps-top-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="40%" />
      </div>

      <div className="qbps-search-row">
        <Skeleton height="40px" radius="var(--radius-md)" />
        <Skeleton height="40px" width="40px" radius="var(--radius-md)" />
      </div>

      <div className="qbps-list">
        <QuestCardSkeleton titleWidth="60%" />
        <QuestCardSkeleton titleWidth="50%" />
        <QuestCardSkeleton titleWidth="65%" />
      </div>
    </div>
  );
};

export default QuestBankPageSkeleton;
