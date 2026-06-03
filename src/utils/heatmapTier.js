// Map a per-cell count to a heatmap tier label. Used by the routine workload
// views (week/month) to tint each cell's background based on how loaded it
// is. Four tiers — empty / light / medium / heavy — keeps the visual readable
// at a glance without inviting hairline distinctions the eye won't pick up.
//
// Thresholds are intentionally conservative: most routines have a handful of
// items per cell, not dozens. If a populated routine consistently maxes the
// scale, revisit these numbers from real data.
export const getHeatmapTier = (count) => {
  if (!count || count <= 0) return 'empty';
  if (count === 1) return 'light';
  if (count <= 3) return 'medium';
  return 'heavy';
};
