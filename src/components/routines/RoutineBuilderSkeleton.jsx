import Skeleton from '../ui/Skeleton';
import MissionCardCondensedSkeleton from '../missions/MissionCardCondensedSkeleton';
import './RoutineBuilderSkeleton.css';

// Mirrors RoutineBuilderSection: a series of bucket sections (Daily / Weekly
// / Monthly / Yearly) each with a title row and a few mission placeholders.
const RoutineBuilderSkeleton = () => {
  const buckets = [
    { titleWidth: '18%', cards: 4 },
    { titleWidth: '22%', cards: 3 },
    { titleWidth: '26%', cards: 2 },
    { titleWidth: '20%', cards: 1 },
  ];

  return (
    <div className="routine-builder-skeleton" aria-hidden="true">
      {buckets.map((bucket, i) => (
        <section key={i} className="rbs-bucket">
          <div className="rbs-bucket-header">
            <Skeleton height="14px" width={bucket.titleWidth} />
            <Skeleton height="20px" width="32px" radius="999px" />
          </div>
          {Array.from({ length: bucket.cards }).map((_, j) => (
            <MissionCardCondensedSkeleton
              key={j}
              titleWidth={['60%', '50%', '65%', '55%', '70%'][(i + j) % 5]}
            />
          ))}
        </section>
      ))}
    </div>
  );
};

export default RoutineBuilderSkeleton;
