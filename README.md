# Daily Game Command Center

A local-first, installable PWA for your daily web games. It tracks streaks and scores, follows each game's own reset time, and has a roulette that picks what to play next.

**Stack:** React 19 · Vite 7 · Tailwind CSS v4 · Framer Motion · dnd-kit · lucide-react · localStorage

```bash
npm install
npm run dev       # http://localhost:5173 (service worker disabled in dev)
npm test          # logic tests (streaks, resets, share-text parsing, migration) in two time zones
npm run build     # production build → dist/
npm run preview   # serve dist/ with the service worker active
```

## Put it on your phone

Deploy `dist/` to any HTTPS static host, then add it to your home screen:

- **Hosts:** Netlify Drop, Vercel, GitHub Pages or Cloudflare Pages. The build uses relative paths, so sub-folders work.
- **iPhone:** in Safari, tap Share → **Add to Home Screen**.
- **Android:** in Chrome, tap ⋮ → **Install app**, or use Settings → Install app.

Your data stays on the device. Use **Settings → Backup** to share, export or import it.

---

## Features

### Per-game rules

| | |
|---|---|
| **Reset time** | Your local midnight, any local time, or a fixed time in any time zone (e.g. 00:00 UTC). Each game has its own "game day", countdown and at-risk warning. |
| **Schedule** | Every day, or chosen weekdays. Days off don't count toward progress and never break a streak. |
| **Custom stats** | As many as a game needs (up to 12). Each one is a *Number* (any unit, higher or lower is better), *Time*, *X/N* guesses or *Win/Loss*, can be marked optional, and can be reordered (the first non win/loss stat is the headline). |
| **Reader per stat** | *Automatic*, *Next to a label* (e.g. the number after 🎯, or before "guesses"), *Count an emoji* (💡), *Connections grid*, *Custom pattern* (regex) or *Manual only*. Clock emojis 🕐…🕧 all match each other, because games change them with the time. |
| **Set up from a share text** | Paste one share message and tap **Detect stats**. Every value is found together with the emoji or word next to it, then named and typed for you (🎯 → Attempts, lower is better). Untick what you don't want and fine-tune the rest. A live preview shows what each stat reads from the sample. |
| **Appearance** | Accent colour and a custom icon. The favicon is fetched automatically, with generated initials as the fallback. |
| **Notes** | Strategy, starting words, login reminders. |
| **Include in roulette** | Per-game opt-out. |

**Quick add:** 19 presets (Pyragrams, Wordle, Connections, Strands, Mini, Spelling Bee, Worldle, Globle, Krillion…) fill in the link, stats and category. Pyragrams is set up from its real share message (🎯 attempts, 🕓 time, 🔀 swaps (optional), ✅/❌ solved). The others are best guesses; every field stays editable.

> **About reset times:** browsers block one website from reading another's data, so the app can't fetch a game's reset time or your score. Resets default to local midnight, which most daily games use, and you can set any other rule per game. Scores come from the share text you paste.

### Tracking

- **One-tap result logging.** Tick a scored game and a sheet opens. Tap **Paste result from clipboard**, the share text is parsed, and you confirm or fix the value.
- **"Back from Wordle?" prompt.** When you return to the app after launching a game, a banner offers *Done* or *Score*.
- **Skip today.** Excuses one game for the day; the streak is kept.
- **Rest day.** Pauses every streak for the day (travel, illness).
- **History calendar.** Tap any past day to mark it played, skipped or missed, or to log a result for it. Useful when you forgot to tick a game.
- **Per-game stats:**
  - current and best streak, total plays, completion %
  - for each custom stat:
    - best and worst (with dates), average, median, last 7, last 30
    - spread (consistency) and solve rate
    - an improving/slipping trend
    - a distribution (X/N guesses, or small whole numbers like attempts)
    - a trend line, plus averages by weekday and by month
  - win/loss stats: win rate, current win streak, best winning run
  - recent results (every stat), with copy-back of the original share text
  - personal-best detection per stat, with confetti and a toast
- **Compare games** (Overview): a sortable table of streak, best streak, completion % and plays, plus each game's headline average.
- **CSV export** (Settings): one row per day, game and stat, ready for Excel, Numbers or Google Sheets.
- **Overview:**
  - perfect-day streak and best (every scheduled game played)
  - plays this week vs last week
  - a 12-week completion heatmap
  - streaks at risk, top streaks, and games you haven't played in a while

### Dashboard

- **Progress:** done/total for today's active games, plus skipped and day-off counts. An "N streaks end in 1h 20m" warning appears in the last 3 hours before a reset.
- **Finding games:**
  - filter: All, To play, Done (with counts)
  - search by name, link, notes or category
  - optional "unplayed first" sorting, with at-risk games at the top
- **Cards:** today's score chip, a streak flame, the reset countdown (for custom resets), and day-off, skipped and rest badges.
- **Long-press a card** (right-click on desktop) for quick actions: open, mark done, log result, skip, stats, edit, duplicate, archive, delete.
- **Undo.** Every destructive action (delete, archive, skip, import, reset all) shows an Undo toast.
- **Archive.** Hides a game but keeps its stats; restore it from Settings.
- **Organize mode.** Drag categories and games, collapse or expand all, and rename or delete categories. Games from a deleted category are moved to another category, never lost.
- **Display:** compact density, haptics (Android), synthesized sounds, confetti (all games done or a new personal best), and a home-screen icon badge showing games left.
- **Roulette:**
  - picks from unplayed games only
  - *Pure random* or *Favour neglected* (weighted by days since last played)
  - a category filter
  - after a pick, it opens the game, then scrolls to and highlights its card
- **Keyboard (desktop):** `N` add · `R` roulette · `O` organize · `/` search.
- **Updates:** a "New version ready" toast with a one-tap reload after a deploy.

---

## Architecture

```
src/
├─ main.jsx                    # root + service worker + update toast
├─ App.jsx                     # which sheet is open; undo toasts, return prompt, celebrations, shortcuts
├─ hooks/
│  ├─ useGameState.js          # ★ reducer + persistence + derived selectors + actions
│  ├─ useNow.js                # minute clock, re-synced when the app wakes
│  ├─ useLongPress.js          # long-press / right-click without breaking taps & scroll
│  ├─ useDndSensors.js         # dnd-kit sensors
│  └─ useInstallPrompt.js      # Android install prompt + iOS detection
├─ lib/
│  ├─ storage.js               # schema v2, defaults, v1→v2 migration, sanitising
│  ├─ schedule.js              # game-day keys, reset time zones, countdowns, weekday schedules
│  ├─ stats.js                 # streaks (neutral days aware), completion, at-risk, per-game summary
│  ├─ metrics.js               # custom stats: readers, auto-detection, formatting, aggregates, migration
│  ├─ csv.js                   # results → CSV
│  ├─ overview.js              # cross-game perfect days, heatmap, weekly trend
│  ├─ presets.js               # quick-add library + accent colours
│  ├─ feedback.js              # haptics + WebAudio sounds
│  ├─ events.js                # toast store + confetti trigger
│  ├─ dates.js · favicon.js
└─ components/
   ├─ Header · Dashboard · CategorySection · GameCard · GameIcon · RouletteButton · ReturnPrompt
   ├─ MetricsEditor            # "Set up from a share text" + per-stat editor
   ├─ MetricStats              # per-stat numbers & charts in the stats sheet
   ├─ ui/       Sheet · Toasts · Confetti · primitives (Button, Toggle, Segmented, Section, Chip…)
   └─ modals/   GameForm · Result · Stats · QuickActions · Overview · Roulette · Category · Settings
tests/logic.test.js            # npm test
```

### Data model (`localStorage["gcc:state"]`, v3)

```js
{
  version: 3,
  settings: { haptics, sounds, confetti, returnPrompt, appBadge, density, filter, sortTodoFirst, ... },
  restDays: ['2026-10-24'],
  categories: [{ id, name, order, collapsed }],
  games: [{
    id, name, url, categoryId, order, iconUrl, color, notes, archived, inRoulette, createdAt,
    reset:    { mode: 'local' | 'zone', time: '00:00', timeZone: 'UTC' },
    schedule: { type: 'daily' | 'weekdays', days: [1,2,3,4,5] },
    askResult: true,
    metrics: [{
      id, name: 'Attempts', emoji: '🎯', type: 'number' | 'time' | 'guesses' | 'winloss',
      unit, better: 'higher' | 'lower', max, optional,
      reader: { mode: 'auto' | 'label' | 'count' | 'connections' | 'regex' | 'manual', label: '🎯', labelPos, regex, win, loss }
    }],
    stats: {
      playedDays:  ['2026-10-23', ...],       // game-day keys
      skippedDays: [...],
      results:     { '2026-10-25': { values: { <metricId>: 4, ... }, failed: false, raw: 'Pyragrams: …' } }
    }
  }]
}
```

All metrics are **derived** from `playedDays`, `skippedDays`, `results` and `restDays`, so nothing can drift out of sync.

- A game's "today" is `gameDayKey(game, now)`: its wall-clock date in the reset time zone, shifted back a day before the reset time.
- Streaks step over *neutral* days (unscheduled, skipped, rest).
- v1 and v2 data (and older backups) are migrated automatically on load or import. A v2 single score becomes one custom stat, with its history kept.
