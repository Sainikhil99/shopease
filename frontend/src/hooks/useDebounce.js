import { useState, useEffect } from 'react';

// Returns a debounced version of `value` that only updates after `delay` ms of quiet.
// Use for search inputs so filtering doesn't run on every keystroke.
export function useDebounce(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
