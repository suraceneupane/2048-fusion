import { useMemo, useRef } from "react";
import type { Dir } from "./game";

const THRESHOLD = 28;

/** Touch-swipe helper for the board. Uses refs so a touch never re-renders. */
export function useSwipe(onDir: (d: Dir) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const handler = useRef(onDir);
  handler.current = onDir;

  return useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        start.current = { x: t.clientX, y: t.clientY };
      },
      onTouchEnd: (e: React.TouchEvent) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const t = e.changedTouches[0];
        if (!t) return;
        const dx = t.clientX - from.x;
        const dy = t.clientY - from.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < THRESHOLD) return;
        handler.current(
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"
        );
      },
      onTouchCancel: () => {
        start.current = null;
      },
    }),
    []
  );
}
