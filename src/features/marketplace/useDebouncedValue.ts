import { useEffect, useState } from 'react';

/** Settles `value` after `delayMs` of no further changes — used to turn a
 * search field's keystrokes into a `?search=` query without firing one
 * request per character. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
