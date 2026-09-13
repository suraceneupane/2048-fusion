import { cn } from "../utils/cn";
import { type Tile, tileClass } from "../game";

const PAD = 2.6;
const CELL = 21.75;
const GAP = 2.6;
const pos = (i: number) => PAD + i * (CELL + GAP);

interface BoardProps {
  tiles: Tile[];
  targeting?: boolean;
  onTileClick?: (id: number) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onTouchCancel?: (e: React.TouchEvent) => void;
  className?: string;
  children?: React.ReactNode;
}

export default function Board({
  tiles,
  targeting,
  onTileClick,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  className,
  children,
}: BoardProps) {
  const sorted = [...tiles].sort((a, b) => {
    const rank = (t: Tile) => (t.state === "dying" ? 0 : t.state === "merged" ? 2 : 1);
    return rank(a) - rank(b);
  });

  return (
    <div
      className={cn(
        "board-surface relative aspect-square w-full touch-none select-none rounded-[16px]",
        "shadow-[0_16px_36px_-16px_rgba(96,80,58,0.55)]",
        targeting && "targeting-pulse",
        className
      )}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      role="grid"
      aria-label="2048 board"
    >
      {Array.from({ length: 16 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="cell-bg absolute rounded-[3cqw]"
          style={{
            width: `${CELL}%`,
            height: `${CELL}%`,
            left: `${pos(i % 4)}%`,
            top: `${pos(Math.floor(i / 4))}%`,
          }}
        />
      ))}

      {sorted.map((t) => (
        <div
          key={t.id}
          onClick={() => targeting && onTileClick?.(t.id)}
          onKeyDown={(e) => {
            if (!targeting) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onTileClick?.(t.id);
            }
          }}
          role={targeting ? "button" : "gridcell"}
          tabIndex={targeting && t.state !== "dying" ? 0 : -1}
          aria-label={targeting ? `Break the ${t.value} tile` : String(t.value)}
          className={cn(
            "tile rounded-[3cqw]",
            tileClass(t.value),
            t.state === "new" && "tile-new",
            t.state === "merged" && "tile-merged",
            t.state === "dying" && "tile-dying",
            targeting && "tile-target"
          )}
          style={{
            width: `${CELL}%`,
            height: `${CELL}%`,
            left: `${pos(t.col)}%`,
            top: `${pos(t.row)}%`,
            zIndex: t.state === "merged" ? 3 : t.state === "dying" ? 1 : 2,
          }}
        >
          {t.value}
        </div>
      ))}

      {children}
    </div>
  );
}
