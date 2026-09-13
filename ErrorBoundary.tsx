import { Component, type ErrorInfo, type ReactNode } from "react";

const GAME_KEYS = [
  "2048-save-v1",
  "2048-stats-v1",
  "2048-settings-v1",
  "2048-account-v1",
  "2048-session-v1",
];

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, one thrown render error leaves the player on a blank page with
 * no way out. The most likely cause is a corrupt or outdated localStorage save,
 * so the recovery path offers to clear it.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("2048 Fusion crashed:", error, info.componentStack);
  }

  private reload = () => {
    window.location.reload();
  };

  private resetSavedData = () => {
    try {
      GAME_KEYS.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="grid min-h-screen place-items-center px-5 py-10">
        <div className="w-full max-w-[420px] overflow-hidden rounded-[24px] bg-[var(--panel)] shadow-[0_24px_50px_-22px_rgba(88,72,52,0.5)]">
          <div className="bg-[var(--panel-hi)] px-6 py-5">
            <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
              Something went wrong
            </h1>
            <p className="text-[14px] text-[#efeae0]">The game hit an unexpected error.</p>
          </div>
          <div className="px-6 py-6">
            <p className="text-[15px] leading-relaxed text-[#776e65]">
              Reloading usually fixes it. If it keeps happening, your saved game may be corrupt or from an older
              version, so clearing it should get you back in.
            </p>
            <pre className="mt-4 max-h-28 overflow-auto rounded-[12px] bg-[#fdfaf1] px-3.5 py-3 text-[12px] leading-relaxed text-[#8e8574]">
              {error.message || String(error)}
            </pre>
            <div className="mt-5 grid gap-2.5">
              <button
                onClick={this.reload}
                className="font-display w-full rounded-full bg-[#e8734a] py-3 text-[15px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
              >
                Reload the game
              </button>
              <button
                onClick={this.resetSavedData}
                className="font-display w-full rounded-full border-2 border-[#c9bfa9] py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
              >
                Clear saved data and reload
              </button>
            </div>
            <p className="mt-3 text-center text-[12.5px] text-[#a2988a]">
              Clearing removes your board, stats, settings and local account.
            </p>
          </div>
        </div>
      </div>
    );
  }
}
