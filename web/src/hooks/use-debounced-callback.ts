import { useEffect, useMemo, useRef } from 'react';

/**
 * Returns a debounced version of `callback` that is safe to use as an event
 * handler prop — the debounce timer is torn down on unmount so it never fires
 * a state update on an unmounted component, and the latest `callback` is
 * always the one that eventually runs even though the returned function
 * identity stays stable.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  const callbackRef = useRef(callback);

  // Ref writes must happen outside render (react-hooks/refs). An effect that
  // runs on every render keeps callbackRef current without ever touching it
  // during render itself.
  useEffect(() => {
    callbackRef.current = callback;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return useMemo(
    () =>
      (...args: Args) => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
      },
    [delayMs],
  );
}
