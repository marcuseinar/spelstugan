# Roadmap

**This file is the handoff point.** It must always reflect reality — what is
actually done, what is genuinely in progress, what is next. An agent picking
this repo up cold should be able to start from here without asking questions.
Update it in the same commit as the work it describes.

Last updated: 2026-08-18

> Visual direction is provisional (decision 012). One rule follows from it and
> applies to all UI work starting now: **no literal colors in components** —
> every color goes through a semantic token, because user-selectable themes
> (decision 013) are planned.

## Current state

**The front half works.** The plugin contract, the Ludo rules, a clickable
board, and the social shell around it — servers, channels, chat — all run and
are verified in a browser. There is still no server: nothing persists, nobody
else can join, and the game is hot seat.

```bash
npm install
npm run dev             # the shell at localhost:5174
npm run dev:playground  # just the Ludo board, at localhost:5173
npm run check           # lint, typecheck, tests, coverage gate
npm run test:mutation   # the rigour gate
```

282 tests; mutation gate at 85%, currently 92%.

### Done

- [x] Product direction agreed (`docs/PRODUCT.md`)
- [x] Plugin/reducer architecture agreed (`docs/ARCHITECTURE.md`)
- [x] Engineering standards written (`CLAUDE.md`)
- [x] Decision log started (`docs/DECISIONS.md`)
- [x] UI mockup — four screens, published as a design canvas
      (`design/mockup/`)
- [x] Visual direction chosen — pastel-on-dark, provisionally (decision 012)
- [x] Stack chosen: TypeScript throughout (decision 011)
- [x] Workspace scaffolded — npm workspaces, Biome, Vitest, CI
- [x] Quality gates wired: branch coverage 85%, mutation score 85%
      (decision 014)
- [x] `@spelstugan/game-kit` — the plugin contract, seeded RNG, replay
- [x] `@spelstugan/ludo` — full rules, plus a playable board
- [x] Framework-neutral plugin UI contract (decision 017)
- [x] Ludo playground at `apps/playground` — hot-seat, runs in the browser
- [x] Public demo on GitHub Pages (`docs/DEPLOYMENT.md`)
- [x] Demo shell at `apps/shell` — servers, channels, chat, and a game plugin
      mounted inside a channel (decision 019)
- [x] The shell on a phone — stack navigation, bottom bar in portrait and rail
      in landscape, table chat as a two-state sheet over the board
      (decision 020)

### In progress

Nothing currently in flight.

### Next up (not started)

- [ ] Data model + migrations for User / Server / Channel / Session / Move,
      including the reserved `kind` and `parent_channel_id` fields
- [ ] Server: apply moves, persist the log, serve views
- [ ] Guest join by room code (decision 015) — reaches a playable game
      sooner than building accounts first
- [ ] Invite-gated accounts
- [ ] One server, general text channel, persistent chat

## Phase 1 — prove the core loop

The goal is to validate the two riskiest, least-proven parts of the system:
**the plugin interface** and **the leaderboard/replay path**. Two very
different games are used deliberately, so the plugin API is stressed before
social scaffolding is built on top of it.

1. **Ludo** as the first plugin — 2–4 players, async, move log persisted
   *(rules and board done; needs persistence and real players)*
2. Guest play by room code, so a game can be started with no signup
3. Invite-gated accounts
4. A single shared server, with a general text channel
5. Game-table channels with text chat
6. A **solo high-score game** as the second plugin — leaderboard scoped to the
   channel, tied into a global board, with replay

Out of scope for phase 1: voice/video, realtime transport, second screen,
global lobbies, multi-server, DMs, moderation tooling, plugin sandboxing.

## Phase 2 — the third proof point

7. A **hidden-information game** (Codenames-shaped, or a card game with a
   hand) — the first real exercise of `privateState` and of second-screen
   play. Neither Ludo nor a solo game touches that path, so until this exists
   the public/private split is unproven.
8. Realtime transport — mandatory here, since a board on a TV updating from
   phone actions cannot be poll-based (see decision 005)

## Phase 3 — open it up

9. Multiple servers; DMs as two-person servers
10. Global per-game lobbies, with casual/competitive kept separate (decision
    009)
11. Async notification story: push/email for "it's your turn", turn timers,
    handling of players who go silent
12. Moderation: blocking, reporting, muting — required before any public
    opening (decision 008)

## Phase 4 — the promised depth

13. Voice and video via a hosted service (decision 006)
14. Shared pointer, as a platform service
15. Third-party plugin authoring: real sandbox isolation, an authoring SDK,
    and publishing
16. **User-selectable theme palettes** (decision 013) — users pick their own
    theme rather than us settling on one everyone tolerates. Cheap to build
    *if* colors stay behind semantic tokens throughout, which is a rule from
    now, not a later cleanup
17. iOS, if the web product has proven itself

## Open questions

Not yet decided. Don't assume an answer — raise them with the owner.

- Frontend framework for the platform shell. The plugin UI contract is
  framework-neutral and settled (decision 017); what the shell itself uses —
  channels, chat, sidebar — is still open
- Which solo high-score game to build
- Which hidden-information game to build
- Hosting: PaaS first, AWS deferred (decision 016, `docs/DEPLOYMENT.md`).
  Which PaaS is still open
- Whether to build on `boardgame.io` or an equivalent rather than inventing the
  plugin runtime from scratch
