# Roadmap

**This file is the handoff point.** It must always reflect reality — what is
actually done, what is genuinely in progress, what is next. An agent picking
this repo up cold should be able to start from here without asking questions.
Update it in the same commit as the work it describes.

Last updated: 2026-08-19

> Visual direction is provisional (decision 012). One rule follows from it and
> applies to all UI work starting now: **no literal colors in components** —
> every color goes through a semantic token, because user-selectable themes
> (decision 013) are planned.

## Current state

**The front half works, and the server behind it now holds a game.** The
plugin contract, the Ludo rules, a clickable board, and the social shell
around it — servers, channels, chat — all run and are verified in a browser. The server persists a game and plays it back:
a full 312-move game of Ludo has been played against it through HTTP. The two
halves are not joined yet — the shell still runs its own in-memory session,
so nobody else can join and the demo is still hot seat.

```bash
npm install
npm run dev             # the shell at localhost:5174
npm run dev:playground  # just the Ludo board, at localhost:5173
npm run check           # lint, typecheck, tests, coverage gate
npm run test:mutation   # the rigour gate
npm run dev --workspace @spelstugan/server        # the server, locally
npm run test:e2e --workspace @spelstugan/server   # play a whole game against it
```

The shell talks to the deployed server by default; point it somewhere else
with `VITE_SERVER_URL=http://127.0.0.1:8787 npm run dev`.

445 tests; mutation gate at 85%, currently 95%.

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
- [x] Cloudflare account and API token, so deploys are git-push
      (`docs/DEPLOYMENT.md`)
- [x] `apps/server` — a Worker with a Durable Object per game table: seat a
      table, play moves through the real reducer, read a view, and keep the
      move log in the table's own SQLite (decision 021)
- [x] **Online tables end to end** (decision 022) — open a table, share the
      code, claim a seat, start, and play from two devices. Verified by
      driving two browsers through a real game against a real server.
- [x] **Chat at an online table** (decision 024) — stored beside the move log,
      in the lobby and over the board, with notes for sitting down and
      starting

### In progress

- [ ] **Play-by-play in an online table.** The demo narrates moves into its
      chat; the real table does not yet, so the thread holds people and notes
      only.
- [ ] **Timestamps on messages**, without which asynchronous play cannot read
      right (decision 024).
- [ ] **A seat token.** Today naming a seated player is enough to move for
      them (decision 022). Fine for friends with a link, blocks anything
      public.

### Next up (not started)

- [ ] Data model + migrations for User / Server / Channel / Session / Move,
      including the reserved `kind` and `parent_channel_id` fields
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
