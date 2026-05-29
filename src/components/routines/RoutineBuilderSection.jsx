// src/components/routines/RoutineBuilderSection.jsx
import { useMemo } from 'react';
import MissionCardCondensed from '../missions/MissionCardCondensed';
import {
  isMissionInRoutineSet,
  groupRoutineMissionsByFrequency,
} from '../../utils/routineHelpers';
import './RoutineBuilderSection.css';

// Bird's-eye view of all routine missions, grouped by recurrence pattern.
// Phase 2: read-only — no add CTAs, no inline edit. Tap behavior on the card
// is suppressed via readOnly. Add CTAs and tap-to-edit come in later phases.
const RoutineBuilderSection = ({ missions, routineRootSet }) => {
  const grouped = useMemo(() => {
    const routineMissions = (missions || []).filter((m) =>
      isMissionInRoutineSet(m, routineRootSet)
    );
    return groupRoutineMissionsByFrequency(routineMissions);
  }, [missions, routineRootSet]);

  const total =
    grouped.daily.length +
    grouped.weekly.length +
    grouped.monthly.length +
    grouped.yearly.length;

  if (total === 0) {
    return (
      <section className="routine-builder">
        <h2 className="routine-builder-title">Builder</h2>
        <div className="routine-builder-empty">
          Your routine is empty.
          <div className="routine-builder-empty-sub">
            Add recurring missions in a later step.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="routine-builder">
      <h2 className="routine-builder-title">Builder</h2>
      <FrequencyGroup label="Daily" missions={grouped.daily} />
      <FrequencyGroup label="Weekly" missions={grouped.weekly} />
      <FrequencyGroup label="Monthly" missions={grouped.monthly} />
      <FrequencyGroup label="Yearly" missions={grouped.yearly} />
    </section>
  );
};

const FrequencyGroup = ({ label, missions }) => {
  if (!missions || missions.length === 0) return null;
  return (
    <div className="routine-builder-group">
      <h3 className="routine-builder-group-label">
        {label}
        <span className="routine-builder-group-count">{missions.length}</span>
      </h3>
      <div className="routine-builder-group-list">
        {missions.map((mission) => (
          <MissionCardCondensed
            key={mission.id}
            mission={mission}
            readOnly={true}
          />
        ))}
      </div>
    </div>
  );
};

export default RoutineBuilderSection;
