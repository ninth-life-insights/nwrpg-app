// Difficulty-weighted load scoring for the routine workload heatmap.
//
// Weights mirror the XP / SP reward ratios on Mission (easy:medium:hard
// = 1:2:4) so the visual intensity tracks effort, not raw count. A day
// with one hard task ends up the same heat as a day with four easy
// tasks, which matches how the days actually feel.
//
// Count and score then communicate different things: count = volume,
// score = effort. The count badge keeps showing the raw task count
// (intuitive at-a-glance), heat reflects the score (informative).
// Mismatches between the two become a useful signal — e.g. "few tasks
// but they're effortful."
const DIFFICULTY_WEIGHTS = {
  easy: 1,
  medium: 2,
  hard: 4,
};

export const getDifficultyWeight = (difficulty) =>
  DIFFICULTY_WEIGHTS[difficulty] ?? 1;

export const computeLoadScore = (missions) => {
  if (!Array.isArray(missions)) return 0;
  return missions.reduce(
    (acc, m) => acc + getDifficultyWeight(m?.difficulty),
    0
  );
};

// Map a per-cell load score to a heatmap tier label, relative to the
// busiest day in the same view. Self-calibrating: a lightly loaded
// routine still shows variation across its days, a heavily loaded
// routine still shows variation across its days. The user's intuition
// is "this day is heavier than my other days," not "this day exceeds
// some absolute threshold."
//
// Sparse-week floor: if the busiest day has very little load, the
// relative scale doesn't promote a one-task day to "heavy." Cap
// intensity until the routine carries enough weight for the upper
// tiers to mean something.
//
// Thresholds (ratio = score / maxScore):
//   ratio < 0.34          → light
//   0.34 ≤ ratio < 0.67   → medium
//   ratio ≥ 0.67, max ≥ 4 → heavy
//   ratio ≥ 0.67, max < 4 → medium (sparse week never hits heavy)
export const getHeatmapTier = (score, maxScore) => {
  if (!score || score <= 0) return 'empty';
  if (!maxScore || maxScore <= 0) return 'light';

  const ratio = score / maxScore;
  if (ratio >= 0.67 && maxScore >= 4) return 'heavy';
  if (ratio >= 0.34) return 'medium';
  return 'light';
};
