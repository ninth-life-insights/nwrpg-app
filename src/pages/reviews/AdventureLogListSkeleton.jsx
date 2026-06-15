import Skeleton from '../../components/ui/Skeleton';
import './AdventureLogListSkeleton.css';

// Just the inner content — AdventureLogPage's header and filter button stay
// visible during load, so the skeleton only covers the list area.
const AdventureLogListSkeleton = () => {
  const months = [
    { titleWidth: '40%', entries: 3 },
    { titleWidth: '30%', entries: 4 },
  ];

  return (
    <div className="adventure-log-list-skeleton" aria-hidden="true">
      {months.map((month, i) => (
        <section key={i} className="alls-month">
          <Skeleton height="14px" width={month.titleWidth} />
          {Array.from({ length: month.entries }).map((_, j) => (
            <div key={j} className="alls-entry">
              <Skeleton height="14px" width="35%" />
              <Skeleton height="12px" width="80%" />
              <Skeleton height="12px" width="60%" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
};

export default AdventureLogListSkeleton;
