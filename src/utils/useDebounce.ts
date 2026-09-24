import { useState, useEffect } from "react";

/**
 * Custom hook to debounce fast-changing state values (e.g. search queries)
 * to avoid excessive filtering, layout re-calculations, and unnecessary re-renders.
 */
export function useDebounce<T>(value: T, delay: number = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
