export type Dir = "up" | "down" | "left" | "right";
export type TileState = "new" | "merged" | "dying";

export interface Tile {
  id: number;
  value: number;
  row: number;
  col: number;
  state?: TileState;
}

export const SIZE = 4;
/** value that counts as a win */
export const TARGET = 2048;

let nextId = 1;
export function ensureIdsAbove(max: number) {
  nextId = Math.max(nextId, max + 1);
}
const nid = () => nextId++;

export function liveTiles(tiles: Tile[]): Tile[] {
  return tiles.filter((t) => t.state !== "dying");
}

export function spawnTile(tiles: Tile[]): Tile | null {
  const occupied = new Set(liveTiles(tiles).map((t) => t.row * SIZE + t.col));
  const free: number[] = [];
  for (let i = 0; i < SIZE * SIZE; i++) if (!occupied.has(i)) free.push(i);
  if (free.length === 0) return null;
  const cell = free[Math.floor(Math.random() * free.length)];
  return {
    id: nid(),
    value: Math.random() < 0.9 ? 2 : 4,
    row: Math.floor(cell / SIZE),
    col: cell % SIZE,
    state: "new",
  };
}

export function newBoard(): Tile[] {
  const tiles: Tile[] = [];
  const a = spawnTile(tiles);
  if (a) tiles.push(a);
  const b = spawnTile(tiles);
  if (b) tiles.push(b);
  return tiles;
}

function lineCell(line: number, pos: number, dir: Dir): { row: number; col: number } {
  switch (dir) {
    case "left":  return { row: line, col: pos };
    case "right": return { row: line, col: SIZE - 1 - pos };
    case "up":    return { row: pos, col: line };
    case "down":  return { row: SIZE - 1 - pos, col: line };
  }
}

export interface MoveResult {
  tiles: Tile[];
  gained: number;
  moved: boolean;
  /** how many merges happened in this single move */
  merges: number;
  /** the largest tile value created by this move (0 when nothing merged) */
  mergedMax: number;
}

export function move(tiles: Tile[], dir: Dir): MoveResult {
  const live = liveTiles(tiles);
  const lines: Tile[][] = [[], [], [], []];

  for (const t of live) {
    const key = dir === "left" || dir === "right" ? t.row : t.col;
    lines[key].push(t);
  }
  for (const line of lines) {
    line.sort((a, b) => {
      const ca = dir === "left" || dir === "right" ? a.col : a.row;
      const cb = dir === "left" || dir === "right" ? b.col : b.row;
      return dir === "left" || dir === "up" ? ca - cb : cb - ca;
    });
  }

  const placed: Tile[] = [];
  const dying: Tile[] = [];
  let gained = 0;
  let moved = false;
  let merges = 0;
  let mergedMax = 0;

  lines.forEach((line, L) => {
    let i = 0;
    let pos = 0;
    while (i < line.length) {
      const a = line[i];
      const b = line[i + 1];
      const cell = lineCell(L, pos, dir);
      if (b && b.value === a.value) {
        placed.push({ id: nid(), value: a.value * 2, ...cell, state: "merged" });
        dying.push({ ...a, ...cell, state: "dying" });
        dying.push({ ...b, ...cell, state: "dying" });
        gained += a.value * 2;
        merges += 1;
        mergedMax = Math.max(mergedMax, a.value * 2);
        moved = true;
        i += 2;
      } else {
        if (a.row !== cell.row || a.col !== cell.col) moved = true;
        placed.push({ ...a, ...cell, state: undefined });
        i += 1;
      }
      pos++;
    }
  });

  return { tiles: [...placed, ...dying], gained, moved, merges, mergedMax };
}

export function hasMoves(tiles: Tile[]): boolean {
  const live = liveTiles(tiles);
  if (live.length < SIZE * SIZE) return true;
  const grid: number[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (const t of live) grid[t.row][t.col] = t.value;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && grid[r][c] === grid[r][c + 1]) return true;
      if (r + 1 < SIZE && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

export function shuffleTiles(tiles: Tile[]): Tile[] {
  const live = liveTiles(tiles);
  const values = live.map((t) => t.value);
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return values.map((v, idx) => ({
    id: nid(),
    value: v,
    row: Math.floor(cells[idx] / SIZE),
    col: cells[idx] % SIZE,
    state: "new" as TileState,
  }));
}

export function tileClass(value: number): string {
  if (value <= 2048) return `t-${value}`;
  return "t-super";
}
