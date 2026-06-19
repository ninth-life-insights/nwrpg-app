import Skeleton from '../components/ui/Skeleton';
import MissionCardCondensedSkeleton from '../components/missions/MissionCardCondensedSkeleton';
import './HomePageSkeleton.css';

// Layout-matched skeleton for HomePage. Mirrors the real page's outer
// container so the swap into live content doesn't shift anything.
// Three condensed-card placeholders is the typical daily-mission count.
const HomePageSkeleton = () => {
  return (
    <div className="homepage-container homepage-skeleton" aria-hidden="true">
      {/* Header — 4 buttons (2 wide, 2 square 44x44) */}
      <header className="homepage-header">
        <Skeleton height="44px" radius="var(--radius-md)" />
        <Skeleton height="44px" radius="var(--radius-md)" />
        <Skeleton height="44px" width="44px" radius="var(--radius-md)" />
        <Skeleton height="44px" width="44px" radius="var(--radius-md)" />
      </header>

      {/* Profile section */}
      <section className="homepage-skeleton-profile">
        <Skeleton width="120px" height="130px" radius="var(--radius-md)" />
        <div className="homepage-skeleton-profile-info">
          <Skeleton height="18px" width="65%" />
          <Skeleton height="13px" width="80%" />
          <Skeleton height="13px" width="30%" />
          <Skeleton height="8px" width="100%" radius="4px" />
          <Skeleton height="11px" width="40%" />
        </div>
      </section>

      {/* Daily missions */}
      <section className="homepage-skeleton-daily">
        <div className="homepage-skeleton-section-header">
          <Skeleton height="18px" width="40%" />
          <Skeleton height="24px" width="24px" radius="999px" />
        </div>

        <MissionCardCondensedSkeleton titleWidth="65%" />
        <MissionCardCondensedSkeleton titleWidth="50%" />
        <MissionCardCondensedSkeleton titleWidth="58%" />

        {/* Routine "Up Next" preview */}
        <div className="homepage-skeleton-up-next">
          <Skeleton height="11px" width="25%" />
          <MissionCardCondensedSkeleton titleWidth="60%" />
        </div>

        {/* Quests / Mission Bank action buttons */}
        <div className="homepage-skeleton-action-buttons">
          <Skeleton height="44px" radius="var(--radius-md)" />
          <Skeleton height="44px" radius="var(--radius-md)" />
        </div>
      </section>

      {/* Shortcuts (skills/achievements column + base widget) */}
      <section className="homepage-skeleton-shortcuts">
        <div className="homepage-skeleton-shortcut-col">
          <Skeleton height="60px" radius="var(--radius-lg)" />
          <Skeleton height="60px" radius="var(--radius-lg)" />
        </div>
        <Skeleton height="130px" radius="var(--radius-lg)" />
      </section>
    </div>
  );
};

export default HomePageSkeleton;
