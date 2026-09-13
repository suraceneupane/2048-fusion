import { useState } from "react";
import { ArrowLeft, Check, Crown, Moon, Sparkles, Star } from "lucide-react";
import { type Account, loadAccount, makeAccount } from "../account";
import { cn } from "../utils/cn";

interface Props {
  onBack: () => void;
  onSignIn: () => void;
  onActivated: (a: Account) => void;
}

type Step = "intro" | "account" | "done";

const benefits = [
  { icon: <Crown className="h-4 w-4" />, text: "Play the exclusive Bonus mode." },
  { icon: <Sparkles className="h-4 w-4" />, text: "Extra power-ups - 3 uses each instead of 2." },
  { icon: <Moon className="h-4 w-4" />, text: "The Midnight board theme, in any mode." },
  { icon: <Star className="h-4 w-4" />, text: "A golden crown next to your username." },
];

const fieldClass =
  "mt-1.5 w-full rounded-[12px] border-2 border-[#cfc6b3] bg-[#fdfaf1] px-4 py-2.5 text-[15px] text-[#776e65] outline-none transition-colors placeholder:text-[#b5ab99] focus:border-[#a69883]";
const labelClass = "block text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#8b8171]";

export default function MembershipView({ onBack, onSignIn, onActivated }: Props) {
  const [step, setStep] = useState<Step>("intro");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  const existing = loadAccount();

  const activate = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3) return setErr("Username needs at least 3 characters.");
    if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return setErr("Usernames can use letters, numbers, dots and dashes.");
    if (password.length < 4) return setErr("Password needs at least 4 characters.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return setErr("That email does not look right.");
    }
    if (existing && existing.username.toLowerCase() !== u.toLowerCase()) {
      return setErr(
        `This browser already stores the account "${existing.username}". Use that username to keep its scores.`
      );
    }
    setErr("");
    onActivated(makeAccount(u, password, email.trim(), true));
    setStep("done");
  };

  return (
    <div className="min-h-screen">
      <div className="top-band h-[clamp(48px,8vw,80px)] w-full" aria-hidden="true" />

      <div className="mx-auto w-full max-w-[520px] px-5 pb-16">
        <button
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#8b8171] transition-colors hover:text-[#5c5346]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to game
        </button>

        <div className="mt-5 overflow-hidden rounded-[24px] bg-[var(--panel)] shadow-[0_24px_50px_-22px_rgba(88,72,52,0.5)]">
          <div className="flex items-center gap-3 bg-[var(--panel-hi)] px-6 py-5">
            <Crown className="h-7 w-7 shrink-0 text-[#f4c430]" fill="currentColor" stroke="none" />
            <div>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">Bonus mode</h1>
              <p className="text-[14px] text-[#efeae0]">
                {step === "done" ? "Unlocked - have fun" : "Free while the game is in beta"}
              </p>
            </div>
          </div>

          <div className="px-6 py-6">
            {step === "intro" && (
              <div className="rise">
                <p className="text-[15px] font-semibold text-[#776e65]">Create a free account and you unlock:</p>
                <ul className="mt-3 space-y-2.5">
                  {benefits.map((b) => (
                    <li key={b.text} className="flex items-start gap-2.5 text-[15px] text-[#8e8574]">
                      <span className="mt-0.5 shrink-0 text-[#e8734a]">{b.icon}</span>
                      <span>{b.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="font-display mt-5 text-[16px] font-extrabold text-[#e8734a]">
                  No payment, no card, no subscription.
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-[#8e8574]">
                  Your account is stored only in this browser, so there is nothing to cancel and nothing to bill.
                </p>
                <button
                  onClick={() => {
                    setUsername(existing?.username ?? "");
                    setStep("account");
                  }}
                  className="font-display mt-5 w-full rounded-full bg-[#e8734a] py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                >
                  Unlock Bonus mode
                </button>
                <p className="mt-4 text-center text-[14px] text-[#8e8574]">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="font-bold text-[#776e65] underline decoration-[#b3a88f] underline-offset-4 hover:text-[#e8734a]"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {step === "account" && (
              <form onSubmit={activate} className="rise">
                <p className="text-[15px] font-semibold text-[#776e65]">
                  {existing ? `Confirm your login for "${existing.username}"` : "Pick a login for this browser"}
                </p>
                <label className={cn(labelClass, "mt-4")} htmlFor="unlock-username">
                  Username
                </label>
                <input
                  id="unlock-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="tile-slider"
                  className={fieldClass}
                />
                <label className={cn(labelClass, "mt-3")} htmlFor="unlock-password">
                  Password
                </label>
                <input
                  id="unlock-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 4 characters"
                  className={fieldClass}
                />
                <label className={cn(labelClass, "mt-3")} htmlFor="unlock-email">
                  Email <span className="normal-case tracking-normal text-[#a2988a]">(optional)</span>
                </label>
                <input
                  id="unlock-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={fieldClass}
                />
                {err && <p className="mt-2.5 text-[13px] font-bold text-[#c14a2c]">{err}</p>}
                <button
                  type="submit"
                  className="font-display mt-5 w-full rounded-full bg-[#e8734a] py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                >
                  Create account and unlock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("intro");
                    setErr("");
                  }}
                  className="mt-3 w-full text-center text-[13.5px] font-semibold text-[#8e8574] underline decoration-[#b3a88f] underline-offset-4 hover:text-[#5c5346]"
                >
                  Back
                </button>
              </form>
            )}

            {step === "done" && (
              <div className="rise py-2 text-center">
                <Crown className="mx-auto h-14 w-14 text-[#e8a800]" fill="#f4c430" stroke="#c89000" strokeWidth={1.2} />
                <h2 className="font-display mt-3 text-[24px] font-extrabold text-[#776e65]">Bonus mode unlocked!</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[#8e8574]">
                  Signed in as <strong className="text-[#776e65]">{username}</strong>. The Midnight board and three of
                  every power-up are yours, and your golden crown is on your profile.
                </p>
                <p className="mt-4 flex items-center justify-center gap-2 text-[14px] font-bold text-[#4d8f4d]">
                  <Check className="h-4 w-4" /> Nothing was charged
                </p>
                <button
                  onClick={onBack}
                  className="font-display mt-5 rounded-full bg-[#e8734a] px-8 py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                >
                  Start playing
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-[#c4baa5] bg-[var(--panel-deep)] px-6 py-3.5 text-center text-[13.5px] text-[#6f665a]">
            Accounts live in your browser only - no servers, no payments, no tracking.
          </div>
        </div>
      </div>
    </div>
  );
}
