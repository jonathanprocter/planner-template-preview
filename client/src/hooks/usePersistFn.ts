import { useRef } from "react";

type noop = (...args: any[]) => any;

/**
 * usePersistFn can replace useCallback to reduce mental overhead.
 * It ensures the function reference remains stable across renders.
 */
export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T | undefined>(undefined);
  if (!persistFn.current) {
    persistFn.current = function (this: unknown, ...args) {
      return fnRef.current!.apply(this, args);
    } as T;
  }

  return persistFn.current!;
}
