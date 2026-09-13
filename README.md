# 2048 Fusion

A polished 2048 built with React 19, TypeScript, Vite and Tailwind CSS 4. The board, best score, stats, settings and local account all persist in `localStorage` - there is no backend, no analytics and no cookies.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
```

## Build

```bash
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
npm run preview    # serve dist/ locally
```

`vite.config.ts` sets `base: "./"`, so `dist/` works on a root domain, a subdirectory, or GitHub Pages unchanged.

## Deploy

Static SPA - any static host works.

| Host | Steps |
| --- | --- |
| **GitHub Pages** | Push to `main`; `.github/workflows/deploy.yml` builds and publishes automatically. Then set Settings - Pages - Source: GitHub Actions. |
| **Vercel** | `npm i -g vercel && vercel` (config in `vercel.json`) |
| **Netlify** | `npm i -g netlify-cli && netlify deploy --prod` (config in `netlify.toml`) |
| **Cloudflare Pages** | Build command `npm run build`, output directory `dist` |

First push to GitHub:

```bash
git remote add origin https://github.com/<your-user>/2048-fusion.git
git push -u origin main
```

The site lands on `https://<your-user>.github.io/2048-fusion/`.

## Project layout

```
index.html                      meta, icons, manifest, non-blocking fonts
public/                         favicon.svg, og.png, site.webmanifest, robots.txt
src/game.ts                     pure board logic: move, merge, spawn, shuffle, hasMoves, TARGET
src/useSwipe.ts                 touch-swipe helper
src/account.ts                  local account + hashed password storage
src/stats.ts                    lifetime stats
src/sound.ts                    WebAudio effects
src/components/Board.tsx        tile rendering and positioning
src/components/ErrorBoundary.tsx crash screen with a save-reset escape hatch
src/views/                      SignInView, MembershipView
src/App.tsx                     game shell, modes, power-ups, panels
```

## Game modes

- **Standard** - 2 uses of each power-up (Undo, Shuffle, Break).
- **Pure** - no power-ups.
- **Tutorial** - three-step walkthrough, then drops you into Standard.
- **Bonus** - midnight board and 3 uses of each power-up; needs a free local account.

## Data and persistence

Everything lives in `localStorage`:

| Key | Contents |
| --- | --- |
| `2048-save-v1` | board, score, best, mode, power-up uses, short undo tail |
| `2048-stats-v1` | lifetime stats |
| `2048-settings-v1` | sound, midnight board, animations |
| `2048-account-v1` | username, email, hashed password, bonus flag |
| `2048-session-v1` | signed-in username |

Saves carry a `version` (`SAVE_VERSION` in `App.tsx`). Bump it whenever `SaveShape` or `Tile` changes and old saves are discarded instead of rendering a broken board. If anything still throws during render, `ErrorBoundary` offers a reload and a "clear saved data" button.

## Accounts

Accounts are browser-local. Passwords are salted and stretched before being written to `localStorage` (`src/account.ts`) so nothing readable is stored, and older plaintext saves are migrated on load.

This is obfuscation for a local-only game, not authentication. Bonus mode is a local flag, so anyone can flip it by editing `localStorage` - that is fine while it is free. If you ever want it to be a paid tier you need a backend for accounts and entitlements, plus a hosted checkout (Stripe, Paddle, Lemon Squeezy); do not collect card numbers in your own inputs.

## Optional: self-host the fonts

Fonts currently load from Google Fonts without blocking first paint. To remove the third-party request entirely:

```bash
npm i @fontsource/nunito @fontsource/nunito-sans
```

Add the imports at the top of `src/index.css` and delete the font `<link>` tags from `index.html`. This is left out of the default setup because it adds dependencies the lockfile does not yet contain.

## License

MIT - see `LICENSE`.
