# Roadmap

**This file is the handoff point.** It must always reflect reality — what is
actually done, what is genuinely in progress, what is next. An agent picking
this repo up cold should be able to start from here without asking questions.
Update it in the same commit as the work it describes.

Last updated: 2026-08-19

> Visual direction is provisional (decisions 012 and 026 — currently a light
> palette: sky, cream, sand, tan). One rule follows from it and applies to all
> UI work: **no literal colors in components** — every color goes through a
> semantic token, because user-selectable themes (decision 013) are planned.
> Swapping the whole theme touched one block, which is that rule paying off.

## Current state

**Two people can play a real game, and talk while they do.** Open a table,
send the code, take a seat, play — no account, nothing to install. The plugin
contract, the Ludo rules and the board run in the browser; the server holds
each table as a Durable Object and keeps the move log and the conversation
together.

**Nothing on screen is invented** (decision 025). The shell lists the tables
this browser has sat at and shows the one it is looking at; the demo — its
servers, channels and pretend conversation — is gone.

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

433 tests; mutation gate at 85%, currently 95%.

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
- [x] **Leaving a table** (decision 028) — a leave control per row, local to
      the device, and rejoining a seat you already hold now works
- [x] **The demo removed** (decision 025) — no invented servers, channels or
      conversation; starting a table is a row where the tables are, and the
      shell stays put while a table is set up

### Known gaps

Nothing is in flight right now. These are shipped features with a hole in
them, which makes them cheaper to close than the candidates below.

- [ ] **Play-by-play in an online table.** The move events already exist where
      the conversation is kept, so the table can narrate itself; nothing does
      yet, so the thread holds people and table notes only.
- [ ] **Timestamps on messages**, without which asynchronous play cannot read
      right (decision 024).
- [ ] **A seat token.** Today naming a seated player is enough to move for
      them (decision 022). Fine for friends with a link, blocks anything
      public.

### Next up (not started)

Nothing here is committed to yet — these are the real candidates, roughly in
the order they are worth doing.

- [ ] **A live transport instead of polling.** The shell re-reads the table on
      a timer (1.5s in the lobby, 2.5s in a game). A Durable Object can hold
      WebSockets, so the table can push instead — fewer reads, and chat that
      arrives when it is sent. Decision 005 already says realtime is
      unavoidable by phase 2; this is the first place it pays for itself.
- [ ] **A second game**, to stress the plugin contract with something that is
      not Ludo-shaped. Which game is still open (see Open questions).
- [ ] **Accounts.** Deliberately deferred: a table needs nothing but a name and
      a code today (decision 022), and guest play was always meant to come
      first (decision 015). Accounts become necessary when identity has to
      outlive a table — a leaderboard, an invite, a name someone owns. The
      User / Server / Channel / Session / Move data model that used to sit here
      went away with the demo (decision 025) and should be redesigned against
      what the product actually does, not restored.

## Phase 1 — prove the core loop

The goal is to validate the two riskiest, least-proven parts of the system:
**the plugin interface** and **the leaderboard/replay path**. Two very
different games are used deliberately, so the plugin API is stressed before
social scaffolding is built on top of it.

1. **Ludo** as the first plugin — 2–4 players, async, move log persisted
   *(done — rules, board, and a move log kept by the table itself)*
2. Guest play by room code, so a game can be started with no signup
   *(done — decision 022)*
3. Game-table chat, kept beside the move log *(done — decision 024)*
4. A **solo high-score game** as the second plugin — leaderboard scoped to the
   table, tied into a global board, with replay
5. Invite-gated accounts *(deferred — see Next up)*
6. A single shared server, with a general text channel *(deferred — the
   server/channel model went away with the demo, decision 025)*

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

- Frontend framework for the platform shell — including whether it needs one
  at all. The plugin UI contract is framework-neutral and settled (decision
  017); the shell itself is plain DOM that refreshes live parts rather than
  redrawing (decision 027), and has not hurt yet
- Which solo high-score game to build
- Which hidden-information game to build
- Whether to build on `boardgame.io` or an equivalent rather than inventing the
  plugin runtime from scratch
