import { useEffect, useState } from 'react';
import { useDelayedLoadingState } from '../../hooks/useDelayedLoadingState';
import './LoadingTransition.css';

// Short delay before the skeleton appears, just enough to suppress flash on
// near-instant cache hits. Anything longer eats too much of the skeleton's
// visible window on typical multi-second Firestore loads.
const SKELETON_DELAY_MS = 250;
const FADE_DURATION_MS = 300;

// Wraps a section that has a loading state and a skeleton placeholder.
// Behavior:
//   - During the first SKELETON_DELAY_MS of loading, nothing renders
//     (avoids skeleton flash on fast loads).
//   - If loading persists past the threshold, skeleton fades in.
//   - When loading ends, skeleton and content crossfade.
//
// The two layers stack in a single grid cell so they overlay perfectly
// during the crossfade without absolute positioning hacks.
const LoadingTransition = ({ loading, skeleton, children, className = '' }) => {
  const skeletonReady = useDelayedLoadingState(loading, SKELETON_DELAY_MS);
  const [keepSkeletonMounted, setKeepSkeletonMounted] = useState(false);

  // Mount the skeleton when it first becomes ready; unmount only after the
  // crossfade settles.
  useEffect(() => {
    if (skeletonReady) setKeepSkeletonMounted(true);
  }, [skeletonReady]);

  useEffect(() => {
    if (!loading && keepSkeletonMounted) {
      const t = setTimeout(() => setKeepSkeletonMounted(false), FADE_DURATION_MS);
      return () => clearTimeout(t);
    }
  }, [loading, keepSkeletonMounted]);

  // Nothing to show during the pre-skeleton silent window.
  if (loading && !keepSkeletonMounted) return null;

  // Fade direction class on the skeleton layer:
  //   "in"  — fresh mount during ongoing load, animate 0 → 1
  //   "out" — loading ended, animate 1 → 0 (crossfading with content)
  const skeletonDirection = loading ? 'in' : 'out';

  return (
    <div className={`loading-transition ${className}`}>
      {keepSkeletonMounted && (
        <div
          className={`loading-transition-layer loading-transition-skeleton loading-transition-skeleton-${skeletonDirection}`}
          aria-hidden="true"
        >
          {skeleton}
        </div>
      )}
      {!loading && (
        <div className="loading-transition-layer loading-transition-content">
          {children}
        </div>
      )}
    </div>
  );
};

export default LoadingTransition;
