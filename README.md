# OSRS Guide

A personalized progression guide for Old School RuneScape (OSRS), a long-running MMORPG in which players level 24 skills and work through quests and bosses. The app reads a player's real stats from the public hiscores and turns them into a prioritized "what should I do next" plan, aimed at a beginner who does not know the game's progression order.

It is a client-side web app in plain HTML, CSS and JavaScript: no framework, no build step, no backend.

**Live site:** https://dbrokenai.github.io/OSRS-Guide/

## What it does

- **Live stats.** Fetches a player's skill levels, XP, boss kill counts and clue-scroll counts by username, polls every 90 seconds, and shows a toast (plus confetti) on level-ups.
- **Next Up.** A ranked list of things the player can do right now given their levels and completed quests, followed by a "Coming Up" list of locked content sorted by how close the player is to unlocking it. Each locked item shows the exact missing requirements, where to train the missing skill at the current level, and which quests award XP in that skill.
- **The Path.** A phased roadmap to a boss-ready account. Steps tick themselves off from stats, quest completions or boss kill counts, and can also be checked manually.
- **Reference tabs driven by the same stats:** tiered training methods per skill (with the level to switch at), best wearable gear per combat style, bosses and minigames split into ready/locked, slayer, money-making methods, achievement diaries, pets, music, boss loadouts, RuneLite plugins and keybinds.
- **Trackers.** Quest completion (with a bulk editor), a daily checklist with a streak counter, custom goals with an ETA, a task list, an auto-written journal of XP gains, free-form notes, and a History tab that can undo any completion.
- **Chat assistant.** Answers questions using the player's stats as context and can update the page: "set magic to 6" or "I finished Cook's Assistant" changes the saved data. A screenshot of the in-game Skills panel can be attached or pasted and a vision model reads the levels from it.
- **Extras.** Global search across quests, bosses, skills and items; F2P/members content filter; manual stat entry when the hiscores are unreachable; "I'm Lost" and "I'm Bored" buttons that surface a few suggestions or a random eligible activity; live bond price from the OSRS Wiki price API.

## How it is built

**Stack:** vanilla JavaScript (ES2020, no modules or bundler), HTML, CSS custom properties, Canvas 2D for the background and confetti. About 9,000 lines, roughly a third of which is hand-written game data.

**Module layout.** Each file in `js/` is an IIFE that exposes one global (`Hiscores`, `Recommender`, `TaskList`, `Journal`, `DailyChecklist`, `Goals`, `AIChat`, `UserOverrides`, `UI`). Script order in `index.html` is the dependency order: data first, then logic, then `ui.js`, then `app.js` which wires events and starts polling. Game content is kept as declarative tables (`QUESTS`, `SKILL_TIERS`, `BOSSES`, `ROADMAP`, ...) with `reqs` objects, separate from the logic that evaluates them.

**Stats fetching (`js/hiscores.js`).** The official hiscores endpoint sends no CORS headers, so the fetcher picks a source by environment:

1. On `localhost`, a bundled PowerShell server (`server.ps1`) proxies `/api/hiscores` to the official endpoint.
2. On any other origin, the [Wise Old Man](https://wiseoldman.net) API, which is CORS-enabled. Untracked players are registered on first lookup, and a re-sync is requested every fifth poll.
3. Public CORS proxies in front of the official endpoint as a last resort.

All sources are normalized to one stats shape. Polling pauses while the tab is hidden and resumes on `visibilitychange`. Consecutive snapshots are diffed to produce the journal entries and level-up notifications.

**Recommendation logic (`js/recommender.js`).** Rule-based, no ML. Requirements (skill levels, combat level, prerequisite quests) are checked against live stats; combat level and the XP table are computed from the game's formulas. Locked items get a "readiness gap", the sum of missing levels with unmet quest prerequisites weighted heavily, and are sorted by it. Ready items are merged from several sources (starter quests, catch-up rules such as "Hitpoints is behind melee", eligible quests and tasks, quests that give XP in skills still being levelled, minigames, the current training method for the weakest skills), then de-duplicated and sorted by priority.

**Chat assistant (`js/ai.js`).** Three tiers, cheapest first:

1. A regex command parser handles edits ("set X to N", "finished Y") locally, and deliberately ignores questions so "how do I get mining to 40" does not set Mining to 40.
2. A local knowledge base answers common questions (next steps, money, gear, training spots, quest walkthroughs) from the app's own data.
3. Otherwise an LLM is called directly from the browser with a system prompt built from the player's stats and recent journal. Groq, Cerebras, OpenRouter, OpenAI and Anthropic are supported with a user-supplied API key (stored in `localStorage`, sent only to the chosen provider); with no key configured it falls back to the keyless Pollinations endpoint.

The model can return a fenced `osrs-actions` JSON block (`setLevel`, `markQuest`, `markTask`, `fixData`). The app parses and validates it, applies it through a single `UI.applyAction` executor, re-renders once, and strips the block from the displayed reply. Screenshots are downscaled on a canvas before upload. If the request fails, the reply falls back to local recommendations.

**State.** Everything is stored in `localStorage` under versioned keys; there are no accounts and no server-side storage. Skill levels have a single source of truth, either live hiscores or manually entered values. An earlier design that overlaid quest XP rewards on top of stats inflated levels, so `js/pending.js` is now a no-op shim that also clears the legacy data. `js/overrides.js` lets a user (via the assistant) correct a quest's XP reward or requirement; the correction is persisted and re-applied to the in-memory data on every load.

**Offline (`sw.js`, `manifest.json`).** A service worker, registered only over HTTPS, pre-caches the app shell. Same-origin HTML/JS/CSS is network-first with a cache fallback so deploys show up immediately; other assets are cache-first; hiscores and API requests are never cached. Old caches are removed on activation by a version bump.

**Local server (`server.ps1`).** A small `System.Net.HttpListener` static file server with MIME types, a path-traversal check, and the hiscores proxy route.

## Running it

**Hosted:** open the live site above. Enter an OSRS username in the top-right field and press Enter.

**Locally on Windows:** double-click `start.bat`. It runs `server.ps1`, which serves the folder at `http://localhost:8765` and opens the browser. Nothing to install.

Opening `index.html` directly from disk is not supported; the app shows a banner pointing to the hosted site because `file://` pages are CORS-restricted.

To enable the full chat assistant, click the gear button, choose a provider and paste your own API key. Without a key, edit commands and the built-in answers still work.

Notes:

- Hiscores only update when the player logs out of the game, so stats can lag behind a live session.
- If stats cannot be fetched within a few seconds, the manual entry dialog opens; everything else works from typed-in levels.

## Project structure

```
index.html        Page shell, chat panel, script load order
style.css         Theme and layout (one breakpoint at 900px)
manifest.json     Web app manifest
sw.js             Service worker: app-shell cache, network-first for code
server.ps1        Local static server + hiscores proxy (PowerShell)
start.bat         Launches server.ps1
js/
  data.js         Skills, XP/combat formulas, quests, tasks, skill tiers, gear, bosses, minigames, roadmap
  extras.js       Diaries, pets, music, slayer, boss loadouts, quest walkthroughs
  overrides.js    Persisted user corrections applied over the data tables
  pending.js      Deprecated shim (see State above)
  hiscores.js     Multi-source stats fetch, manual stats, polling and diffing
  recommender.js  Requirement checks, readiness gap, ranked recommendations
  tasklist.js     Task list store
  journal.js      Activity log store
  dailies.js      Daily checklist and streak
  goals.js        Custom goals and ETA
  ai.js           Command parser, local answers, LLM providers, action protocol
  ui.js           Navigation and rendering for all 27 sections
  app.js          Boot: service worker, event wiring, polling start
  sakura.js       Canvas background animation
  confetti.js     Level-up confetti
```

## Status and limitations

- A personal project built for one specific player; a default username and some copy are hard-coded for that player. Any username can be entered.
- Game data is hand-maintained in `data.js` and `extras.js` and goes stale as the game is updated.
- No automated tests, linting or build pipeline.
- `ui.js` renders with template strings and inline styles and re-renders every section on each stats update.
- On `localhost` the app assumes `server.ps1` is serving it; under a different local server the stats request fails and the app falls back to manual entry.
- LLM calls are made from the browser, so a user's API key lives in that browser's `localStorage`.
- The public CORS proxies and the keyless LLM endpoint are third-party services with no availability guarantee.

## Credits

- Player data: [Wise Old Man](https://wiseoldman.net) API and the official Old School RuneScape hiscores.
- Prices and reference links: the [Old School RuneScape Wiki](https://oldschool.runescape.wiki).
- Fonts: Pacifico and Quicksand via Google Fonts.

Old School RuneScape is a trademark of Jagex Ltd. This project is unofficial and not affiliated with Jagex.
