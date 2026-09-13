import { useCallback, useEffect, useRef, useState } from "react";
import {
  Menu,
  RotateCw,
  RotateCcw,
  Star,
  Flag,
  Crown,
  LogOut,
  UserRound,
  BarChart3,
  Settings as SettingsIcon,
  X,
  Volume2,
  VolumeX,
  Moon,
  Sun,
  Trash2,
  Sparkles,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { cn } from "./utils/cn";
import {
  type Dir,
  type Tile,
  newBoard,
  move,
  spawnTile,
  liveTiles,
  hasMoves,
  shuffleTiles,
  ensureIdsAbove,
  TARGET,
} from "./game";
import Board from "./components/Board";
import { useSwipe } from "./useSwipe";
import MembershipView from "./views/MembershipView";
import SignInView from "./views/SignInView";
import { type Account, loadAccount, saveAccount, loadSession, saveSession } from "./account";
import { type Stats, loadStats, saveStats, recordGame, emptyStats } from "./stats";
import { sfx, setSoundEnabled } from "./sound";

/* ---------------- types & persistence ---------------- */
type Mode = "standard" | "classic" | "tutorial" | "plus";
type PowerKey = "undo" | "shuffle" | "break";
type Uses = Record<PowerKey, number>;
type View = "play" | "membership" | "signin";
type Panel = null | "stats" | "settings";

interface Settings {
  sound: boolean;
  darkBoard: boolean;
  motion: boolean;
}

const maxUses = (mode: Mode): Uses =>
  mode === "plus"
    ? { undo: 3, shuffle: 3, break: 3 }
    : mode === "classic"
      ? { undo: 0, shuffle: 0, break: 0 }
      : { undo: 2, shuffle: 2, break: 2 };

const SAVE_KEY = "2048-save-v1";
const SETTINGS_KEY = "2048-settings-v1";
/* bump when SaveShape changes so old saves are discarded instead of crashing */
const SAVE_VERSION = 2;
const HISTORY_LIMIT = 60;
const HISTORY_SAVED = 8;

type Snapshot = { tiles: Tile[]; score: number };

interface SaveShape {
  version: number;
  tiles: Tile[];
  score: number;
  best: number;
  mode: Mode;
  uses: Uses;
  keepPlaying: boolean;
  won: boolean;
  over: boolean;
  /** a short undo tail, so reloading does not strand unusable undo charges */
  history: Snapshot[];
}

function loadSave(): SaveShape | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveShape;
    if (d?.version !== SAVE_VERSION) {
      /* save from an older build: start clean rather than render a broken board */
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    if (!Array.isArray(d.tiles) || typeof d.score !== "number") return null;
    ensureIdsAbove(Math.max(0, ...d.tiles.map((t) => t.id ?? 0)));
    return { ...d, history: Array.isArray(d.history) ? d.history : [] };
  } catch {
    localStorage.removeItem(SAVE_KEY);
    return null;
  }
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { sound: false, darkBoard: false, motion: true };
    return { sound: false, darkBoard: false, motion: true, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { sound: false, darkBoard: false, motion: true };
  }
}

/* ---------------- custom icons ---------------- */
function ShuffleBlocksIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.6" y="2.6" width="7.4" height="7.4" rx="2" fill="currentColor" stroke="none" />
      <rect x="14" y="14" width="7.4" height="7.4" rx="2" fill="currentColor" stroke="none" />
      <path d="M13.6 5.6h3.3a3.5 3.5 0 0 1 3.5 3.5v1.3" />
      <path d="M18.4 8.6l2 2 2-2.2" />
      <path d="M10.4 18.4H7.1a3.5 3.5 0 0 1-3.5-3.5v-1.3" />
      <path d="M5.6 15.4l-2-2-2 2.2" />
    </svg>
  );
}

function BreakGridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7.6" height="7.6" rx="2" />
      <rect x="13.4" y="3" width="7.6" height="7.6" rx="2" />
      <rect x="3" y="13.4" width="7.6" height="7.6" rx="2" />
      <rect x="14" y="14" width="6.4" height="6.4" rx="1.8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ClassicGridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="7.6" height="7.6" rx="2" />
      <rect x="13.4" y="3" width="7.6" height="7.6" rx="2" />
      <rect x="3" y="13.4" width="7.6" height="7.6" rx="2" />
      <rect x="13.4" y="13.4" width="7.6" height="7.6" rx="2" />
    </svg>
  );
}

/* ---------------- scroll reveal ---------------- */
function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("in-view");
          io.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ---------------- shared modal shell ---------------- */
function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const focusable = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );
    focusable()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    card.addEventListener("keydown", onKey);
    return () => card.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className="overlay-in fixed inset-0 z-50 grid place-items-center bg-[rgba(60,50,38,0.42)] p-5 backdrop-blur-[3px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={cardRef}
        className="overlay-card w-full max-w-[400px] overflow-hidden rounded-[24px] bg-[var(--panel)] shadow-[0_30px_60px_-24px_rgba(60,48,32,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[var(--panel-hi)] px-6 py-4">
          <h2 className="font-display flex items-center gap-2.5 text-[19px] font-extrabold text-white">
            {icon}
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ==================================================================== */
export default function App() {
  const [view, setView] = useState<View>("play");
  const [account, setAccount] = useState<Account | null>(() => loadAccount());
  const [signedIn, setSignedIn] = useState<string | null>(() => {
    const s = loadSession();
    const a = loadAccount();
    return s && a && s.toLowerCase() === a.username.toLowerCase() ? s : null;
  });
  const isMember = !!(signedIn && account?.member);

  const nav = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const handleActivated = (a: Account) => {
    saveAccount(a);
    saveSession(a.username);
    setAccount(a);
    setSignedIn(a.username);
    nav("play");
  };

  const handleSignedIn = (a: Account) => {
    saveAccount(a);
    saveSession(a.username);
    setAccount(a);
    setSignedIn(a.username);
    nav("play");
  };

  const signOut = () => {
    saveSession(null);
    setSignedIn(null);
  };

  if (view === "membership")
    return <MembershipView onBack={() => nav("play")} onSignIn={() => nav("signin")} onActivated={handleActivated} />;

  if (view === "signin")
    return <SignInView onBack={() => nav("play")} onMembership={() => nav("membership")} onSignedIn={handleSignedIn} />;

  return (
    <PlayView
      account={account}
      signedIn={signedIn}
      isMember={isMember}
      onSignOut={signOut}
      onNavigate={nav}
    />
  );
}

/* ==================================================================== */
function PlayView({
  account,
  signedIn,
  isMember,
  onSignOut,
  onNavigate,
}: {
  account: Account | null;
  signedIn: string | null;
  isMember: boolean;
  onSignOut: () => void;
  onNavigate: (v: View) => void;
}) {
  const [saved] = useState(loadSave);

  const [tiles, setTiles] = useState<Tile[]>(() => saved?.tiles.map((t) => ({ ...t, state: undefined })) ?? newBoard());
  const [score, setScore] = useState(saved?.score ?? 0);
  const [best, setBest] = useState(saved?.best ?? 0);
  const [mode, setMode] = useState<Mode>(saved?.mode ?? "standard");
  const [uses, setUses] = useState<Uses>(saved?.uses ?? maxUses(saved?.mode ?? "standard"));
  const [keepPlaying, setKeepPlaying] = useState(saved?.keepPlaying ?? false);
  const [won, setWon] = useState(saved?.won ?? false);
  const [over, setOver] = useState(saved?.over ?? false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [targeting, setTargeting] = useState(false);
  const [tutStep, setTutStep] = useState(saved?.mode === "tutorial" ? 0 : -1);
  const [gain, setGain] = useState<{ v: number; k: number } | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [newBest, setNewBest] = useState(false);

  const [stats, setStats] = useState<Stats>(() => loadStats());
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const historyRef = useRef<Snapshot[]>(saved?.history ?? []);
  const movesRef = useRef(0);
  const mergesRef = useRef(0);
  /* guards against a finished game being counted twice in stats */
  const recordedRef = useRef(saved?.over ?? false);

  const darkBoard = mode === "plus" || (settings.darkBoard && isMember);

  useEffect(() => setSoundEnabled(settings.sound), [settings.sound]);
  useEffect(() => {
    document.documentElement.dataset.motion = settings.motion ? "on" : "off";
  }, [settings.motion]);

  useEffect(() => {
    const data: SaveShape = {
      version: SAVE_VERSION,
      history: historyRef.current.slice(-HISTORY_SAVED),
      tiles: liveTiles(tiles).map((t) => ({ ...t, state: undefined })),
      score,
      best,
      mode,
      uses,
      keepPlaying,
      won,
      over,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [tiles, score, best, mode, uses, keepPlaying, won, over]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2000);
  }, []);

  const resetGame = useCallback((m: Mode) => {
    historyRef.current = [];
    movesRef.current = 0;
    mergesRef.current = 0;
    recordedRef.current = false;
    setTiles(newBoard());
    setScore(0);
    setUses(maxUses(m));
    setOver(false);
    setWon(false);
    setKeepPlaying(false);
    setTargeting(false);
    setGain(null);
    setNewBest(false);
  }, []);

  const highestOf = (list: Tile[]) =>
    liveTiles(list).reduce((m, t) => Math.max(m, t.value), 0);

  const endGame = useCallback(
    (finalScore: number, finalTiles: Tile[], wasWon: boolean) => {
      if (recordedRef.current) return;
      recordedRef.current = true;
      setStats((prev) => {
        const next = recordGame(prev, {
          score: finalScore,
          highestTile: highestOf(finalTiles),
          won: wasWon,
          moves: movesRef.current,
          merges: mergesRef.current,
        });
        saveStats(next);
        return next;
      });
    },
    []
  );

  /* snapshot the board for Undo, stripped of transient animation state */
  const pushHistory = useCallback(() => {
    historyRef.current.push({
      tiles: liveTiles(tiles).map((t) => ({ ...t, state: undefined })),
      score,
    });
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
  }, [tiles, score]);

  const handleMove = useCallback(
    (dir: Dir) => {
      if (over || menuOpen || panel || (won && !keepPlaying) || tutStep >= 0) return;
      const result = move(tiles, dir);
      if (!result.moved) return;

      pushHistory();

      movesRef.current += 1;
      mergesRef.current += result.merges;

      let next = result.tiles;
      const spawned = spawnTile(next);
      if (spawned) next = [...next, spawned];

      const nextScore = score + result.gained;
      setTiles(next);
      setScore(nextScore);
      if (settings.sound) {
        if (result.merges > 0) sfx.merge(result.mergedMax);
        else sfx.move();
      }
      if (result.gained > 0) setGain({ v: result.gained, k: Date.now() });
      if (nextScore > best) {
        setBest(nextScore);
        if (best > 0 && !newBest) {
          setNewBest(true);
          flash("New personal best!");
        }
      }
      const reached = !won && next.some((t) => t.value >= TARGET && t.state !== "dying");
      if (reached) {
        setWon(true);
        if (settings.sound) sfx.win();
      }
      if (!hasMoves(next)) {
        setOver(true);
        if (settings.sound) sfx.lose();
        endGame(nextScore, next, reached || won);
      }
    },
    [tiles, score, best, over, won, keepPlaying, menuOpen, panel, tutStep, settings.sound, newBest, flash, endGame, pushHistory]
  );

  const swipe = useSwipe(handleMove);

  const doUndo = () => {
    if (uses.undo <= 0 || historyRef.current.length === 0) return;
    const snap = historyRef.current.pop()!;
    recordedRef.current = false;
    setTiles(snap.tiles);
    setScore(snap.score);
    setUses((u) => ({ ...u, undo: u.undo - 1 }));
    setOver(false);
    setTargeting(false);
    if (settings.sound) sfx.power();
    flash("Move undone");
  };

  const doShuffle = () => {
    if (uses.shuffle <= 0 || over) return;
    pushHistory();
    setTiles(shuffleTiles(tiles));
    setUses((u) => ({ ...u, shuffle: u.shuffle - 1 }));
    setOver(false);
    if (settings.sound) sfx.power();
    flash("Board shuffled");
  };

  const toggleBreak = () => {
    if (uses.break <= 0 || over) return;
    setTargeting((t) => !t);
    if (settings.sound) sfx.click();
  };

  const breakTile = (id: number) => {
    if (!targeting || uses.break <= 0) return;
    pushHistory();
    const after = liveTiles(tiles).filter((t) => t.id !== id);
    setTiles(after);
    setUses((u) => ({ ...u, break: u.break - 1 }));
    setTargeting(false);
    if (hasMoves(after)) {
      setOver(false);
      recordedRef.current = false;
    }
    if (settings.sound) sfx.power();
    flash("Tile removed");
  };

  const restart = () => {
    if (score > 0 || liveTiles(tiles).length > 2) endGame(score, tiles, won);
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 520);
    resetGame(mode);
    if (settings.sound) sfx.click();
  };

  const selectMode = (m: Mode) => {
    if (m === "plus" && !isMember) {
      setMenuOpen(false);
      if (settings.sound) sfx.click();
      flash("Bonus mode just needs a free account");
      onNavigate("membership");
      return;
    }
    if (score > 0 || liveTiles(tiles).length > 2) endGame(score, tiles, won);
    setMode(m);
    resetGame(m);
    setTutStep(m === "tutorial" ? 0 : -1);
    setMenuOpen(false);
    if (settings.sound) sfx.click();
    flash(
      m === "classic"
        ? "Pure mode — power-ups disabled"
        : m === "plus"
          ? "Bonus mode — midnight board & 3 uses each"
          : m === "tutorial"
            ? "Tutorial started"
            : "Standard mode"
    );
  };

  /* if the account is signed out, Bonus mode falls back to Standard */
  useEffect(() => {
    if (mode === "plus" && !isMember) {
      setMode("standard");
      setUses(maxUses("standard"));
    }
  }, [mode, isMember]);

  const endTutorial = useCallback(() => {
    setTutStep(-1);
    if (mode === "tutorial") {
      setMode("standard");
      setUses(maxUses("standard"));
    }
  }, [mode]);

  const closeAll = useCallback(() => {
    setMenuOpen(false);
    setPanel(null);
    setTargeting(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAll();
        return;
      }
      const map: Record<string, Dir> = {
        ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
        w: "up", s: "down", a: "left", d: "right", W: "up", S: "down", A: "left", D: "right",
      };
      /* never hijack typing or browser shortcuts */
      const target = e.target as HTMLElement | null;
      if (target?.closest?.("input, textarea, select, [contenteditable=\"true\"]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      handleMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleMove, closeAll]);

  const classicDisabled = mode === "classic";

  const modes = [
    { id: "standard" as Mode, title: "Standard", sub: "The full game with power-ups", icon: <Star className="h-7 w-7" fill="currentColor" stroke="none" />, locked: false },
    { id: "classic" as Mode, title: "Pure", sub: "No power-ups, no safety net", icon: <ClassicGridIcon className="h-7 w-7" />, locked: false },
    { id: "tutorial" as Mode, title: "Tutorial", sub: "Learn the ropes in three steps", icon: <Flag className="h-7 w-7" fill="currentColor" stroke="none" />, locked: false },
    {
      id: "plus" as Mode,
      title: "Bonus",
      sub: isMember
        ? "Your midnight board and 3 of every power-up"
        : "Free account — midnight board and extra power-ups",
      icon: <Crown className="h-7 w-7 text-[#e8734a]" fill="currentColor" stroke="none" />,
      accent: true,
      locked: !isMember,
    },
  ];

  const powerups: { key: PowerKey; label: string; icon: React.ReactNode; onClick: () => void; armed?: boolean }[] = [
    { key: "undo", label: "Undo", icon: <RotateCcw className="h-7 w-7" strokeWidth={2.4} />, onClick: doUndo },
    { key: "shuffle", label: "Shuffle", icon: <ShuffleBlocksIcon className="h-7 w-7" />, onClick: doShuffle },
    { key: "break", label: "Break a tile", icon: <BreakGridIcon className="h-7 w-7" />, onClick: toggleBreak, armed: targeting },
  ];

  const avg = stats.gamesPlayed ? Math.round(stats.totalScore / stats.gamesPlayed) : 0;

  return (
    <div data-theme={darkBoard ? "plus" : undefined} className="min-h-screen">
      {/* decorative top band / member badge */}
      {isMember ? (
        <div className="flex h-[clamp(40px,7vw,64px)] w-full items-center justify-center">
          <span className="rise flex items-center gap-1.5 rounded-full bg-[#f4ecd4] px-4 py-1 text-[12.5px] font-extrabold text-[#a07d1c] shadow-sm">
            <Crown className="h-3.5 w-3.5" fill="#f4c430" stroke="#c89000" strokeWidth={1.2} /> Bonus mode unlocked
          </span>
        </div>
      ) : (
        <div className="top-band h-[clamp(56px,11vw,104px)] w-full" aria-hidden="true" />
      )}

      <main className="mx-auto w-full max-w-[540px] px-5 pb-20">
        {/* header */}
        <header className="rise grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5" style={{ animationDelay: "40ms" }}>
          <button
            onClick={() => {
              setMenuOpen((o) => !o);
              setPanel(null);
              if (settings.sound) sfx.click();
            }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className={cn(
              "grid h-12 w-12 place-items-center rounded-full text-[#7b6e5b] transition-all duration-200 hover:bg-[#e9e2cf] active:scale-95",
              menuOpen && "bg-[#ddd5c0]"
            )}
          >
            <Menu className="h-6 w-6" strokeWidth={2.6} />
          </button>
          <div className="select-none text-center">
            <h1 className="font-display text-[42px] font-extrabold leading-none tracking-tight text-[#7b6e5b] sm:text-[46px]">
              2048
            </h1>
            <span className="font-display mt-0.5 block text-[11px] font-extrabold uppercase tracking-[0.42em] text-[#b3a88f]">
              Fusion
            </span>
          </div>
          <button
            onClick={restart}
            aria-label="New game"
            title="Start a new game"
            className="grid h-12 w-12 place-items-center rounded-full text-[#7b6e5b] transition-all duration-200 hover:bg-[#e9e2cf] active:scale-95"
          >
            <RotateCw className={cn("h-[26px] w-[26px]", spinning && "spin-once")} strokeWidth={2.5} />
          </button>
        </header>

        {menuOpen ? (
          <section className="menu-in mt-1 overflow-hidden rounded-[22px] bg-[var(--panel)] shadow-[0_24px_50px_-22px_rgba(88,72,52,0.5)]">
            {modes.map((m) => {
              const active = m.id === mode;
              return (
                <button
                  key={m.id}
                  onClick={() => selectMode(m.id)}
                  className={cn(
                    "flex w-full items-start gap-4 px-6 py-4 text-left transition-colors duration-150",
                    active ? "bg-[var(--panel-hi)]" : "hover:bg-[rgba(90,75,55,0.06)]",
                    m.locked && "opacity-90"
                  )}
                >
                  <span className={cn("mt-0.5 shrink-0", active ? "text-white" : m.accent ? "text-[#e8734a]" : "text-[#776e65]")}>
                    {m.icon}
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("font-display text-[21px] font-extrabold leading-tight", active ? "text-white" : m.accent ? "text-[#e8734a]" : "text-[#776e65]")}>
                        {m.title}
                      </span>
                      {m.locked && (
                        <span className="rounded-full bg-[#e8734a] px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                          Free
                        </span>
                      )}
                    </span>
                    <span className={cn("mt-0.5 block text-[16px] leading-snug", active ? "text-[#efeae0]" : "text-[#8e8574]")}>
                      {m.sub}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* account strip */}
            <div className="border-t border-[#c4baa5]">
              {signedIn ? (
                <div className="flex items-center justify-between gap-3 bg-[rgba(90,75,55,0.05)] px-6 py-3.5">
                  <span className="flex items-center gap-2 text-[15px] font-bold text-[#776e65]">
                    <UserRound className="h-[18px] w-[18px]" />
                    {signedIn}
                    {account?.member && (
                      <>
                        <Crown className="h-4 w-4 text-[#e8a800]" fill="#f4c430" stroke="#c89000" strokeWidth={1.2} />
                        <span className="text-[12px] font-extrabold uppercase tracking-wide text-[#a07d1c]">Bonus</span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={() => {
                      onSignOut();
                      flash("Signed out");
                    }}
                    className="flex shrink-0 items-center gap-1.5 text-[13.5px] font-bold text-[#8e8574] transition-colors hover:text-[#5c5346]"
                  >
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 bg-[rgba(90,75,55,0.05)] px-6 py-3.5">
                  <span className="text-[14px] font-semibold text-[#8e8574]">Save your best score</span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate("signin");
                      }}
                      className="rounded-full border border-[#b3a88f] px-3.5 py-1.5 text-[13.5px] font-bold text-[#776e65] transition-colors hover:bg-[#cfc6b2]"
                    >
                      Sign in
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate("membership");
                      }}
                      className="rounded-full bg-[#e8734a] px-3.5 py-1.5 text-[13.5px] font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-[#dd653c]"
                    >
                      Unlock bonus
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* tools */}
            <div className="grid grid-cols-2 gap-3 border-t border-[#c4baa5] px-6 py-4">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPanel("stats");
                  if (settings.sound) sfx.click();
                }}
                className="font-display flex items-center justify-center gap-2 rounded-[14px] bg-[rgba(90,75,55,0.07)] py-3 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[rgba(90,75,55,0.13)]"
              >
                <BarChart3 className="h-4.5 w-4.5" /> Stats
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setPanel("settings");
                  if (settings.sound) sfx.click();
                }}
                className="font-display flex items-center justify-center gap-2 rounded-[14px] bg-[rgba(90,75,55,0.07)] py-3 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[rgba(90,75,55,0.13)]"
              >
                <SettingsIcon className="h-4.5 w-4.5" /> Settings
              </button>
            </div>

            <button
              onClick={() => {
                setMenuOpen(false);
                setTutStep(0);
                if (settings.sound) sfx.click();
              }}
              className="flex w-full items-center justify-center gap-2 bg-[var(--panel-deep)] py-3.5 text-center text-[16.5px] font-semibold text-[#6f665a] transition-colors hover:bg-[#c5bba7] hover:text-[#544c40]"
            >
              <GraduationCap className="h-5 w-5" /> How to play
            </button>
          </section>
        ) : (
          <>
            {/* scores */}
            <div className="rise flex gap-4" style={{ animationDelay: "110ms" }}>
              <div className="relative flex flex-1 items-center justify-between rounded-[22px] bg-[var(--chip)] px-6 py-3.5">
                <span className="text-[13.5px] font-extrabold uppercase tracking-[0.08em] text-[#8b8171]">Score</span>
                <span className="font-display text-[26px] font-extrabold leading-none text-[#776e65]" aria-live="polite">{score}</span>
                {gain && (
                  <span key={gain.k} className="gain-float font-display pointer-events-none absolute right-6 top-1 text-[22px] font-extrabold text-[#e8734a]">
                    +{gain.v}
                  </span>
                )}
              </div>
              <div className="flex flex-1 items-center justify-between rounded-[22px] border-2 border-[var(--chip-line)] px-6 py-3.5">
                <span className="text-[13.5px] font-extrabold uppercase tracking-[0.08em] text-[#8b8171]">Best</span>
                <span className="font-display text-[26px] font-extrabold leading-none text-[#776e65]">{best}</span>
              </div>
            </div>

            {/* board */}
            <div className="rise mt-[clamp(44px,9vw,86px)]" style={{ animationDelay: "180ms" }}>
              <Board tiles={tiles} targeting={targeting} onTileClick={breakTile} {...swipe}>
                {targeting && (
                  <div className="overlay-in pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#e8734a] px-4 py-1.5 text-[14px] font-bold text-white shadow-lg">
                    Tap a tile to break it
                  </div>
                )}

                {tutStep >= 0 && (
                  <div className="overlay-in absolute inset-0 z-20 grid place-items-center rounded-[16px] bg-[rgba(251,248,238,0.82)] p-6 backdrop-blur-[2px]">
                    <div className="overlay-card w-full max-w-[340px] rounded-[20px] bg-[var(--panel)] p-6 text-center shadow-2xl">
                      <div className="font-display text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#a2937f]">
                        Step {tutStep + 1} of 3
                      </div>
                      <h2 className="font-display mt-2 text-[26px] font-extrabold text-[#776e65]">
                        {["Slide to move", "Merge the equals", "Use power-ups"][tutStep]}
                      </h2>
                      <p className="mt-2 text-[15.5px] leading-relaxed text-[#8e8574]">
                        {[
                          "Use the arrow keys, WASD, or swipe on the board — every tile slides at once.",
                          "Two tiles with the same number merge into one when they collide. Chain your way to 2048!",
                          "Undo a slip, shuffle the board, or break a single tile. Uses are limited, so spend them wisely.",
                        ][tutStep]}
                      </p>
                      <div className="mt-5 flex items-center justify-center gap-3">
                        <button onClick={endTutorial} className="rounded-full px-4 py-2 text-[15px] font-bold text-[#8e8574] transition-colors hover:text-[#5c5346]">
                          Skip
                        </button>
                        <button
                          onClick={() => {
                            if (tutStep >= 2) endTutorial();
                            else setTutStep(tutStep + 1);
                            if (settings.sound) sfx.click();
                          }}
                          className="font-display rounded-full bg-[#e8734a] px-6 py-2.5 text-[15px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                        >
                          {tutStep >= 2 ? "Let's play!" : "Next"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {(over || (won && !keepPlaying)) && tutStep < 0 && (
                  <div className="overlay-in absolute inset-0 z-20 grid place-items-center rounded-[16px] bg-[rgba(251,248,238,0.72)] backdrop-blur-[2px]">
                    <div className="overlay-card text-center">
                      <h2 className="font-display text-[44px] font-extrabold text-[#776e65]">{over ? "Game over!" : "You win!"}</h2>
                      <p className="mt-1 text-[16px] font-semibold text-[#8e8574]">
                        {over ? `You scored ${score} points.` : "You reached the legendary 2048 tile."}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                        {!over && (
                          <button
                            onClick={() => {
                              setKeepPlaying(true);
                              if (settings.sound) sfx.click();
                            }}
                            className="font-display rounded-full border-2 border-[#c9bfa9] px-6 py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
                          >
                            Keep going
                          </button>
                        )}
                        {over && uses.undo > 0 && historyRef.current.length > 0 && (
                          <button
                            onClick={doUndo}
                            className="font-display flex items-center gap-2 rounded-full border-2 border-[#c9bfa9] px-5 py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
                          >
                            <RotateCcw className="h-4 w-4" strokeWidth={2.6} /> Undo
                          </button>
                        )}
                        <button
                          onClick={restart}
                          className="font-display rounded-full bg-[#e8734a] px-7 py-2.5 text-[15px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </Board>
            </div>
          </>
        )}

        {/* power-ups */}
        <div className="rise mt-[clamp(52px,10vw,96px)] flex justify-center" style={{ animationDelay: "260ms" }}>
          <div className="flex items-end gap-5 rounded-[30px] bg-[var(--chip)] px-7 py-5">
            {powerups.map((p) => {
              const remaining = uses[p.key];
              const max = maxUses(mode)[p.key];
              const disabled = classicDisabled || remaining <= 0 || over;
              return (
                <div key={p.key} className="flex flex-col items-center gap-2.5">
                  <button
                    onClick={p.onClick}
                    disabled={disabled && !p.armed}
                    title={classicDisabled ? "Not available in Classic" : `${p.label} — ${remaining} left`}
                    aria-label={p.label}
                    className={cn(
                      "grid h-16 w-16 place-items-center rounded-[18px] text-[#fdfbf3] transition-all duration-200",
                      p.armed
                        ? "targeting-pulse bg-[var(--btn-on)] shadow-md"
                        : disabled
                          ? "cursor-not-allowed bg-[var(--btn)] opacity-40"
                          : "bg-[var(--btn)] hover:-translate-y-1 hover:bg-[#c8c0a8] hover:shadow-md active:translate-y-0"
                    )}
                  >
                    {p.icon}
                  </button>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {Array.from({ length: Math.max(max, 0) }, (_, i) => (
                      <span key={i} className={cn("h-[5px] w-[18px] rounded-full transition-colors duration-300", i < remaining ? "bg-[#a89e87]" : "bg-[#dcd5c0]")} />
                    ))}
                    {max === 0 && <span className="h-[5px] w-[18px] rounded-full bg-[#dcd5c0]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* how to play */}
        <section id="how-to-play" className="mt-[clamp(64px,12vw,110px)]">
          <Reveal>
            <h2 className="font-display text-[28px] font-extrabold text-[#7b6e5b]">How to play</h2>
            <p className="mt-3 max-w-[46ch] text-[16.5px] leading-relaxed text-[#8e8574]">
              Use your <strong className="font-bold text-[#776e65]">arrow keys</strong> or{" "}
              <strong className="font-bold text-[#776e65]">swipe</strong> to move the tiles. Tiles with the same number merge into one when
              they touch — add them up, reach <strong className="font-bold text-[#776e65]">2048</strong>!
            </p>
          </Reveal>

          <div className="mt-8 space-y-4">
            {[
              { n: "1", t: "Slide everything at once", d: "Every move shifts all tiles as far as they can go in one direction. A fresh tile appears after each slide." },
              { n: "2", t: "Plan your merges", d: "Keep your highest tile in a corner and build a chain of descending values toward it to avoid getting stuck." },
              { n: "3", t: "Spend power-ups wisely", d: "Undo rewinds a mistake, Shuffle reshuffles the board, and Break removes a single tile of your choice." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="group flex items-start gap-4 rounded-[18px] bg-[#f3eedd] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#efe8d3] hover:shadow-[0_12px_28px_-16px_rgba(96,80,58,0.5)]">
                  <span className="font-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8734a] text-[17px] font-extrabold text-white shadow-sm transition-transform duration-300 group-hover:scale-110">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-display text-[18px] font-extrabold text-[#776e65]">{s.t}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#8e8574]">{s.d}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120}>
            <footer className="mt-12 border-t border-[#e6dfca] pt-6">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                {[
                  { label: "Stats", act: () => setPanel("stats") },
                  { label: "Settings", act: () => setPanel("settings") },
                  { label: "How to play", act: () => setTutStep(0) },
                  ...(signedIn ? [] : [{ label: "Sign in", act: () => onNavigate("signin") }]),
                  ...(!isMember ? [{ label: "Unlock bonus", act: () => onNavigate("membership") }] : []),
                ].map((b) => (
                  <button
                    key={b.label}
                    onClick={() => {
                      b.act();
                      if (settings.sound) sfx.click();
                    }}
                    className="text-[14px] font-semibold text-[#a2988a] underline decoration-[#cfc6b0] underline-offset-4 transition-colors hover:text-[#e8734a] hover:decoration-[#e8734a]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-[13.5px] font-semibold text-[#a2988a]">
                Your board, best score and stats are saved automatically on this device.
              </p>
              <p className="mt-1.5 text-center text-[13px] text-[#b0a695]">
                No accounts on a server, no analytics, no cookies — clearing your browser data resets everything.
              </p>
            </footer>
          </Reveal>
        </section>
      </main>

      {/* toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
          <div className="overlay-in rounded-full bg-[#776e65] px-5 py-2.5 text-[14px] font-bold text-[#fdfbf3] shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {/* stats panel */}
      {panel === "stats" && (
        <Modal title="Your stats" icon={<BarChart3 className="h-5 w-5" />} onClose={() => setPanel(null)}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Games played", v: stats.gamesPlayed },
              { l: "Wins", v: stats.wins },
              { l: "Best score", v: stats.bestScore },
              { l: "Average score", v: avg },
              { l: "Highest tile", v: stats.highestTile || "—" },
              { l: "Total merges", v: stats.totalMerges },
              { l: "Total moves", v: stats.totalMoves },
              { l: "Win rate", v: stats.gamesPlayed ? `${Math.round((stats.wins / stats.gamesPlayed) * 100)}%` : "—" },
            ].map((s) => (
              <div key={s.l} className="rounded-[16px] bg-[#fdfaf1] px-4 py-3">
                <div className="font-display text-[26px] font-extrabold leading-none text-[#776e65]">{s.v}</div>
                <div className="mt-1 text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#a2988a]">{s.l}</div>
              </div>
            ))}
          </div>

          {stats.highestTile >= TARGET && (
            <p className="mt-4 flex items-center justify-center gap-2 rounded-[14px] bg-[#fdf3dc] py-2.5 text-[14px] font-bold text-[#a07d1c]">
              <Trophy className="h-4 w-4" /> You've built a 2048 tile — {stats.wins} win{stats.wins === 1 ? "" : "s"} so far.
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                setStats({ ...emptyStats });
                saveStats({ ...emptyStats });
                if (settings.sound) sfx.power();
                flash("Stats reset");
              }}
              className="flex items-center gap-2 rounded-full border-2 border-[#c9bfa9] px-5 py-2.5 text-[14.5px] font-extrabold text-[#8e8574] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
            >
              <Trash2 className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={() => {
                setPanel(null);
                restart();
              }}
              className="font-display flex-1 rounded-full bg-[#e8734a] py-2.5 text-[15px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
            >
              New game
            </button>
          </div>
        </Modal>
      )}

      {/* settings panel */}
      {panel === "settings" && (
        <Modal title="Settings" icon={<SettingsIcon className="h-5 w-5" />} onClose={() => setPanel(null)}>
          <div className="space-y-2.5">
            {[
              {
                key: "sound" as const,
                label: "Sound effects",
                desc: "Gentle tones for moves and merges",
                on: <Volume2 className="h-5 w-5" />,
                off: <VolumeX className="h-5 w-5" />,
              },
              {
                key: "darkBoard" as const,
                label: "Midnight board",
                desc: isMember ? "Your Bonus board theme" : "Comes with Bonus mode — free",
                on: <Moon className="h-5 w-5" />,
                off: <Sun className="h-5 w-5" />,
                premium: true,
              },
              {
                key: "motion" as const,
                label: "Animations",
                desc: "Tile slides, pops and reveals",
                on: <Sparkles className="h-5 w-5" />,
                off: <Sparkles className="h-5 w-5 opacity-40" />,
              },
            ].map((s) => {
              const locked = "premium" in s && s.premium && !isMember;
              const active = settings[s.key] && !locked;
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    if (locked) {
                      setPanel(null);
                      flash("Midnight board comes with Bonus mode");
                      onNavigate("membership");
                      return;
                    }
                    setSettings((p) => ({ ...p, [s.key]: !p[s.key] }));
                    sfx.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-[16px] bg-[#fdfaf1] px-4 py-3 text-left transition-all hover:bg-[#f6f0e0]"
                >
                  <span className={cn("shrink-0", active ? "text-[#e8734a]" : "text-[#a69883]")}>
                    {active ? s.on : s.off}
                  </span>
                  <span className="flex-1">
                    <span className="font-display block text-[15.5px] font-extrabold text-[#776e65]">{s.label}</span>
                    <span className="text-[13px] text-[#8e8574]">{s.desc}</span>
                  </span>
                  {locked ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f4ecd4] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#a07d1c]">
                      <Crown className="h-3.5 w-3.5" fill="#f4c430" stroke="#c89000" strokeWidth={1.2} />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
                        active ? "bg-[#e8734a]" : "bg-[#cfc6b3]"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-300",
                          active ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-2.5">
            <button
              onClick={() => {
                setTutStep(0);
                setPanel(null);
              }}
              className="font-display flex items-center justify-center gap-2 rounded-full border-2 border-[#c9bfa9] py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
            >
              <GraduationCap className="h-4.5 w-4.5" /> Replay tutorial
            </button>
            <button
              onClick={() => {
                setPanel(null);
                restart();
                flash("Fresh board — good luck!");
              }}
              className="font-display flex items-center justify-center gap-2 rounded-full border-2 border-[#c9bfa9] py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
            >
              <RotateCw className="h-4.5 w-4.5" /> Restart game
            </button>
            {signedIn && (
              <button
                onClick={() => {
                  setPanel(null);
                  onSignOut();
                  flash("Signed out");
                }}
                className="flex items-center justify-center gap-2 py-1.5 text-[14px] font-bold text-[#8e8574] transition-colors hover:text-[#5c5346]"
              >
                <LogOut className="h-4 w-4" /> Sign out of {signedIn}
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
