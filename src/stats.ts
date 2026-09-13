export interface Stats {
  gamesPlayed: number;
  wins: number;
  bestScore: number;
  totalScore: number;
  highestTile: number;
  totalMoves: number;
  totalMerges: number;
}

const KEY = "2048-stats-v1";

export const emptyStats: Stats = {
  gamesPlayed: 0,
  wins: 0,
  bestScore: 0,
  totalScore: 0,
  highestTile: 0,
  totalMoves: 0,
  totalMerges: 0,
};

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...emptyStats };
    return { ...emptyStats, ...(JSON.parse(raw) as Partial<Stats>) };
  } catch {
    return { ...emptyStats };
  }
}

export function saveStats(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function recordGame(
  prev: Stats,
  r: { score: number; highestTile: number; won: boolean; moves: number; merges: number }
): Stats {
  return {
    gamesPlayed: prev.gamesPlayed + 1,
    wins: prev.wins + (r.won ? 1 : 0),
    bestScore: Math.max(prev.bestScore, r.score),
    totalScore: prev.totalScore + r.score,
    highestTile: Math.max(prev.highestTile, r.highestTile),
    totalMoves: prev.totalMoves + r.moves,
    totalMerges: prev.totalMerges + r.merges,
  };
}
