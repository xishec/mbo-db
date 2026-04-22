import { useState, useEffect, useCallback, type RefObject } from "react";

export function useRemainingHeight(ref: RefObject<HTMLElement | null>, padding = 40): number {
  const [height, setHeight] = useState(600);

  const measure = useCallback(() => {
    if (ref.current) {
      const top = ref.current.getBoundingClientRect().top;
      setHeight(Math.max(200, window.innerHeight - top - padding));
    }
  }, [ref, padding]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return height;
}
