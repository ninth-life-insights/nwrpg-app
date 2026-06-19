import Skeleton from '../components/ui/Skeleton';
import './SettingsPageSkeleton.css';

const SettingsPageSkeleton = () => {
  const sections = [
    { titleWidth: '25%', rows: 1 },
    { titleWidth: '40%', rows: 4 },
    { titleWidth: '30%', rows: 3 },
    { titleWidth: '35%', rows: 2 },
  ];

  return (
    <div className="settings-container settings-page-skeleton" aria-hidden="true">
      <header className="sps2-header">
        <Skeleton height="32px" width="32px" radius="var(--radius-md)" />
        <Skeleton height="22px" width="35%" />
      </header>

      {sections.map((section, sIdx) => (
        <section key={sIdx} className="sps2-section">
          <Skeleton height="14px" width={section.titleWidth} />
          {Array.from({ length: section.rows }).map((_, rIdx) => (
            <div key={rIdx} className="sps2-row">
              <Skeleton height="14px" width="45%" />
              <Skeleton height="20px" width="44px" radius="999px" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
};

export default SettingsPageSkeleton;
