import { useEffect, useState } from 'react';

// Returns true only after `loading` has been continuously true for `delay` ms.
// Resets to false the moment `loading` flips back to false.
//
// Use to delay UI that should not flash for fast loads — e.g. skeletons
// (1000ms) or a "your raven is taking the scenic route" hint (3000ms).
export const useDelayedLoadingState = (loading, delay) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [loading, delay]);

  return show;
};
