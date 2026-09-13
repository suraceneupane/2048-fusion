export interface Account {
  username: string;
  /** salted, stretched hash — plaintext passwords are never stored */
  passwordHash: string;
  email: string;
  member: boolean;
  memberSince?: number;
  /** legacy field from pre-hash saves, migrated away on load */
  password?: string;
}

const ACCOUNT_KEY = "2048-account-v1";
const SESSION_KEY = "2048-session-v1";
const SALT = "2048-fusion::local-only::v1";

/**
 * Local-only password hash. This game has no backend, so this exists to avoid
 * writing a readable password into localStorage — it is not a substitute for
 * server-side auth.
 */
export function hashPassword(password: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const input = SALT + password + SALT + password.length;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = (((h2 << 5) + h2) ^ c) >>> 0;
  }
  for (let round = 0; round < 5000; round++) {
    h1 = Math.imul(h1 ^ (h2 + round), 16777619) >>> 0;
    h2 = (((h2 << 5) + h2) ^ h1) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function makeAccount(
  username: string,
  password: string,
  email: string,
  member: boolean
): Account {
  return {
    username,
    passwordHash: hashPassword(password),
    email,
    member,
    ...(member ? { memberSince: Date.now() } : {}),
  };
}

export function verifyPassword(account: Account, password: string): boolean {
  if (account.passwordHash) return account.passwordHash === hashPassword(password);
  /* legacy plaintext record */
  if (account.password) return account.password === password;
  return false;
}

export function setPassword(account: Account, password: string): Account {
  const next: Account = { ...account, passwordHash: hashPassword(password) };
  delete next.password;
  return next;
}

export function loadAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Account;
    if (!a || typeof a.username !== "string") return null;
    if (!a.passwordHash && a.password) {
      /* migrate old plaintext saves once */
      const migrated = setPassword(a, a.password);
      saveAccount(migrated);
      return migrated;
    }
    return a;
  } catch {
    return null;
  }
}

export function saveAccount(a: Account) {
  try {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function loadSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveSession(username: string | null) {
  try {
    if (username) localStorage.setItem(SESSION_KEY, username);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
