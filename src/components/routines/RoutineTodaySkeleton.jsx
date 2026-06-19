import Skeleton from '../ui/Skeleton';
import MissionCardCondensedSkeleton from '../missions/MissionCardCondensedSkeleton';
import './RoutineTodaySkeleton.css';

// Mirrors RoutineTodaySection: a date-picker pill, then a few labeled
// buckets (Daily/Weekly/Monthly/Yearly) each with a couple of cards.
const RoutineTodaySkeleton = () => {
  const buckets = [
    { titleWidth: '20%', cards: 3 },
    { titleWidth: '25%', cards: 2 },
    { titleWidth: '28%', cards: 1 },
  ];

  return (
    <div className="routine-today-skeleton" aria-hidden="true">
      <div className="rts-datepill">
        <Skeleton height="32px" width="60%" radius="999px" />
      </div>
      {buckets.map((bucket, i) => (
        <section key={i} className="rts-bucket">
          <Skeleton height="14px" width={bucket.titleWidth} />
          {Array.from({ length: bucket.cards }).map((_, j) => (
            <MissionCardCondensedSkeleton
              key={j}
              titleWidth={['60%', '50%', '65%', '55%'][(i + j) % 4]}
            />
          ))}
        </section>
      ))}
    </div>
  );
};

export default RoutineTodaySkeleton;
