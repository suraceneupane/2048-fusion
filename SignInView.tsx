import { useState } from "react";
import { ArrowLeft, KeyRound, MailCheck, UserRound, Crown } from "lucide-react";
import {
  type Account,
  loadAccount,
  makeAccount,
  saveAccount,
  setPassword as withPassword,
  verifyPassword,
} from "../account";
import { cn } from "../utils/cn";

interface Props {
  onBack: () => void;
  onMembership: () => void;
  onSignedIn: (account: Account) => void;
}

type Tab = "in" | "up";

export default function SignInView({ onBack, onMembership, onSignedIn }: Props) {
  const [tab, setTab] = useState<Tab>("in");
  const existing = loadAccount();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetId, setResetId] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [resetErr, setResetErr] = useState("");

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    const acct = loadAccount();
    if (!acct) {
      setErr("No account on this device yet — create one below.");
      return;
    }
    if (username.trim().toLowerCase() !== acct.username.toLowerCase()) {
      setErr(`We couldn't find an account named "${username.trim()}".`);
      return;
    }
    if (!verifyPassword(acct, password)) {
      setErr("That password doesn't match. Try again or reset it.");
      return;
    }
    setErr("");
    onSignedIn(acct);
  };

  const signUp = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3) return setErr("Username needs at least 3 characters.");
    if (!/^[a-zA-Z0-9_.-]+$/.test(u)) return setErr("Usernames can use letters, numbers, dots, dashes.");
    if (password.length < 4) return setErr("Password needs at least 4 characters.");
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      return setErr("That email doesn't look right.");
    }
    const current = loadAccount();
    if (current && current.username.toLowerCase() === u.toLowerCase()) {
      return setErr("That account already exists on this device — sign in instead.");
    }
    if (current) {
      return setErr(
        `This browser already stores the account "${current.username}". Sign in with it instead.`
      );
    }
    setErr("");
    onSignedIn(makeAccount(u, password, email.trim(), false));
  };

  const sendReset = (e: React.FormEvent) => {
    e.preventDefault();
    const id = resetId.trim();
    if (id.length < 3) return setResetErr("Enter your username or email.");
    const acct = loadAccount();
    const matches =
      !!acct &&
      (id.toLowerCase() === acct.username.toLowerCase() ||
        (!!acct.email && id.toLowerCase() === acct.email.toLowerCase()));
    if (!acct || !matches) return setResetErr("No matching account on this device.");
    /* there is no mail server, so issue a one-time password locally */
    const code = String(Math.floor(100000 + Math.random() * 900000));
    saveAccount(withPassword(acct, code));
    setTempPassword(code);
    setResetErr("");
    setResetSent(true);
  };

  const field =
    "mt-1.5 w-full rounded-[12px] border-2 border-[#cfc6b3] bg-[#fdfaf1] px-4 py-2.5 text-[15px] text-[#776e65] outline-none transition-colors placeholder:text-[#b5ab99] focus:border-[#a69883]";
  const label = "block text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#8b8171]";

  return (
    <div className="min-h-screen">
      <div className="top-band h-[clamp(48px,8vw,80px)] w-full" aria-hidden="true" />

      <div className="mx-auto w-full max-w-[480px] px-5 pb-16">
        <button
          onClick={onBack}
          className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-bold text-[#8b8171] transition-colors hover:text-[#5c5346]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to game
        </button>

        <div className="mt-5 overflow-hidden rounded-[24px] bg-[var(--panel)] shadow-[0_24px_50px_-22px_rgba(88,72,52,0.5)]">
          <div className="flex items-center gap-3 bg-[var(--panel-hi)] px-6 py-5">
            <UserRound className="h-7 w-7 shrink-0 text-white" />
            <div>
              <h1 className="font-display text-[22px] font-extrabold leading-tight text-white">
                {resetting ? "Reset password" : tab === "in" ? "Sign in" : "Create account"}
              </h1>
              <p className="text-[14px] text-[#efeae0]">
                {resetting ? "We'll sort you out" : existing ? `Welcome back, ${existing.username}` : "Save your best scores"}
              </p>
            </div>
          </div>

          {!resetting && (
            <div className="flex gap-1 px-6 pt-5">
              {(
                [
                  { id: "in" as Tab, label: "Sign in" },
                  { id: "up" as Tab, label: "Create account" },
                ]
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setTab(t.id);
                    setErr("");
                  }}
                  className={cn(
                    "font-display flex-1 rounded-full py-2.5 text-[14.5px] font-extrabold transition-all",
                    tab === t.id
                      ? "bg-[var(--panel-hi)] text-white shadow-sm"
                      : "bg-[rgba(90,75,55,0.07)] text-[#776e65] hover:bg-[rgba(90,75,55,0.13)]"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-6 py-5">
            {!resetting ? (
              tab === "in" ? (
                <form onSubmit={signIn} className="rise">
                  <label className={label}>Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder={existing?.username ?? "your-username"}
                    className={field}
                  />
                  <label className={cn(label, "mt-3")}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={field}
                  />
                  {err && <p className="mt-3 text-[13px] font-bold text-[#c14a2c]">{err}</p>}
                  <button
                    type="submit"
                    className="font-display mt-5 w-full rounded-full bg-[#e8734a] py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResetting(true);
                      setResetSent(false);
                      setErr("");
                    }}
                    className="mt-3 w-full text-center text-[13.5px] font-semibold text-[#8e8574] underline decoration-[#b3a88f] underline-offset-4 hover:text-[#5c5346]"
                  >
                    Forgot your password?
                  </button>
                </form>
              ) : (
                <form onSubmit={signUp} className="rise">
                  <label className={label}>Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="tile-slider"
                    className={field}
                  />
                  <label className={cn(label, "mt-3")}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 4 characters"
                    className={field}
                  />
                  <label className={cn(label, "mt-3")}>
                    Email <span className="normal-case tracking-normal text-[#a2988a]">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={field}
                  />
                  {err && <p className="mt-3 text-[13px] font-bold text-[#c14a2c]">{err}</p>}
                  <button
                    type="submit"
                    className="font-display mt-5 w-full rounded-full bg-[#e8734a] py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                  >
                    Create account
                  </button>
                  <p className="mt-3 text-center text-[13px] leading-relaxed text-[#8e8574]">
                    Your account lives only in this browser. Unlock Bonus mode any time for extra power-ups.
                  </p>
                </form>
              )
            ) : !resetSent ? (
              <form onSubmit={sendReset} className="rise">
                <p className="text-[14.5px] leading-relaxed text-[#8e8574]">
                  Enter your username or email and we'll generate a reset code for you.
                </p>
                <div className="mt-3 flex items-center gap-2.5 rounded-[12px] border-2 border-[#cfc6b3] bg-[#fdfaf1] px-3.5 py-2.5">
                  <KeyRound className="h-4.5 w-4.5 shrink-0 text-[#a69883]" />
                  <input
                    value={resetId}
                    onChange={(e) => {
                      setResetId(e.target.value);
                      setResetErr("");
                    }}
                    placeholder="Username or email"
                    className="w-full bg-transparent text-[15px] text-[#776e65] outline-none placeholder:text-[#b5ab99]"
                  />
                </div>
                {resetErr && <p className="mt-2.5 text-[13px] font-bold text-[#c14a2c]">{resetErr}</p>}
                <button
                  type="submit"
                  className="font-display mt-4 w-full rounded-full bg-[#e8734a] py-3 text-[16px] font-extrabold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#dd653c] active:translate-y-0"
                >
                  Send reset code
                </button>
                <button
                  type="button"
                  onClick={() => setResetting(false)}
                  className="mt-3 w-full text-center text-[13.5px] font-semibold text-[#8e8574] underline decoration-[#b3a88f] underline-offset-4 hover:text-[#5c5346]"
                >
                  ← Back to sign in
                </button>
              </form>
            ) : (
              <div className="rise py-3 text-center">
                <MailCheck className="mx-auto h-11 w-11 text-[#4d8f4d]" />
                <p className="font-display mt-2 text-[19px] font-extrabold text-[#776e65]">Reset code created</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#8e8574]">
                  This game runs entirely in your browser, so there is no mail server. Your password has been reset to the
                  one-time code below — sign in with it now.
                </p>
                <p className="font-display mt-3 rounded-[12px] bg-[#fdfaf1] px-4 py-2.5 text-[20px] font-extrabold tracking-[0.2em] text-[#e8734a]">
                  {tempPassword}
                </p>
                <button
                  onClick={() => {
                    setResetting(false);
                    setResetSent(false);
                    setPassword(tempPassword);
                    setErr("");
                    setTab("in");
                  }}
                  className="font-display mt-4 rounded-full border-2 border-[#c9bfa9] px-6 py-2.5 text-[15px] font-extrabold text-[#776e65] transition-all hover:-translate-y-0.5 hover:bg-[#efe8d6] active:translate-y-0"
                >
                  Back to sign in
                </button>
              </div>
            )}

            {!resetting && (
              <div className="mt-5 border-t border-[#c4baa5] pt-4">
                {existing?.member ? (
                  <p className="flex items-center justify-center gap-2 text-[14px] font-bold text-[#a07d1c]">
                    <Crown className="h-4 w-4" fill="#f4c430" stroke="#c89000" strokeWidth={1.2} /> Bonus mode is already
                    unlocked on this account.
                  </p>
                ) : (
                  <p className="text-center text-[14px] text-[#8e8574]">
                    Want the midnight board and extra power-ups?{" "}
                    <button onClick={onMembership} className="font-bold text-[#776e65] underline decoration-[#b3a88f] underline-offset-4 hover:text-[#e8734a]">
                      Unlock Bonus mode — free
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-[#c4baa5] bg-[var(--panel-deep)] px-6 py-3.5 text-center text-[13.5px] text-[#6f665a]">
            Accounts are stored locally in your browser — no servers, no tracking.
          </div>
        </div>
      </div>
    </div>
  );
}
