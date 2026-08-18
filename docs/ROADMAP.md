# Roadmap

**This file is the handoff point.** It must always reflect reality — what is
actually done, what is genuinely in progress, what is next. An agent picking
this repo up cold should be able to start from here without asking questions.
Update it in the same commit as the work it describes.

Last updated: 2026-08-18

## Current state

Design and planning phase. **No application code exists yet.** The repository
contains documentation and a UI mockup.

### Done

- [x] Product direction agreed (`docs/PRODUCT.md`)
- [x] Plugin/reducer architecture agreed (`docs/ARCHITECTURE.md`)
- [x] Engineering standards written (`CLAUDE.md`)
- [x] Decision log started (`docs/DECISIONS.md`)
- [x] UI mockup — four screens, published as a design canvas
      (`design/mockup/`)

### In progress

- [ ] Mockup revision: warmer, table-like palette instead of the current
      neon/futuristic one

### Next up (not started)

- [ ] Choose the stack per layer, record in `docs/DECISIONS.md`
- [ ] Scaffold the project: formatter, linter, test runner, CI gates
      (see "CI gates" in `CLAUDE.md`) — before feature code
- [ ] Data model + migrations for User / Server / Channel / Session / Move,
      including the reserved `kind` and `parent_channel_id` fields
- [ ] Invite-gated auth
- [ ] One server, general text channel, persistent chat

## Phase 1 — prove the core loop

The goal is to validate the two riskiest, least-proven parts of the system:
**the plugin interface** and **the leaderboard/replay path**. Two very
different games are used deliberately, so the plugin API is stressed before
social scaffolding is built on top of it.

1. Invite-gated auth
2. A single shared server, with a general text channel
3. Game-table channels with text chat
4. **Ludo** as the first plugin — 2–4 players, async, move log persisted
5. A **solo high-score game** as the second plugin — leaderboard scoped to the
   channel, tied into a global board, with replay

Out of scope for phase 1: voice/video, realtime transport, second screen,
global lobbies, multi-server, DMs, moderation tooling, plugin sandboxing.

## Phase 2 — the third proof point

6. A **hidden-information game** (Codenames-shaped, or a card game with a
   hand) — the first real exercise of `privateState` and of second-screen
   play. Neither Ludo nor a solo game touches that path, so until this exists
   the public/private split is unproven.
7. Realtime transport — mandatory here, since a board on a TV updating from
   phone actions cannot be poll-based (see decision 005)

## Phase 3 — open it up

8. Multiple servers; DMs as two-person servers
9. Global per-game lobbies, with casual/competitive kept separate (decision
   009)
10. Async notification story: push/email for "it's your turn", turn timers,
    handling of players who go silent
11. Moderation: blocking, reporting, muting — required before any public
    opening (decision 008)

## Phase 4 — the promised depth

12. Voice and video via a hosted service (decision 006)
13. Shared pointer, as a platform service
14. Third-party plugin authoring: real sandbox isolation, an authoring SDK,
    and publishing
15. iOS, if the web product has proven itself

## Open questions

Not yet decided. Don't assume an answer — raise them with the owner.

- Stack per layer (frontend framework, backend, database) — nothing chosen yet
- Which solo high-score game to build
- Which hidden-information game to build
- Hosting and deployment target
- Whether to build on `boardgame.io` or an equivalent rather than inventing the
  plugin runtime from scratch
