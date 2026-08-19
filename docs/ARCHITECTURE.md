# Architecture

Status: **partly built.** The plugin contract, the reducer, replay, seeded
randomness and the UI boundary all exist and are exercised by a playable Ludo
(`packages/`, `apps/playground`). The platform around them — persistence,
identity, channels, chat, realtime — does not exist yet.

Sections below mark which is which. Update this file as reality arrives; do
not let it describe a system that isn't what got built.

## The central idea: the platform owns everything except the rules

A game plugin knows its own rules and nothing else. The platform owns identity,
persistence, turn scheduling, chat, presence, notifications, and the move log.
This split is what makes third-party games possible later without rewriting the
platform.

## The plugin contract *(built)*

A game is two separable pieces:

1. **A reducer** — a pure function:

   ```
   (state, move, playerId) -> (newState, events)
   ```

   It validates the move against the rules and returns the resulting state
   plus any events worth recording (a turn ended, a player won, points
   scored). It does not touch the network, the clock, the filesystem, or
   global state.

2. **A UI bundle** — renders a state for a viewer and emits moves the viewer
   attempts. Ships as web content so it runs in a browser today and inside a
   native shell later without being rewritten per platform.

### Why a reducer

- **Replay is free.** Re-running the move log through the reducer reproduces
  any past state exactly — that's the replay feature and the spectator
  feature, not extra machinery.
- **Async resumption is free.** State is the fold of the log; there is no
  "live session" that must stay in memory for a game to continue tomorrow.
- **The trust boundary is honest.** Moves cross as serialized messages, never
  shared objects. A malicious or broken plugin cannot forge a result or reach
  into the platform. Today plugins are first-party and can run in-process;
  swapping in real isolation later becomes an infrastructure change rather
  than an interface rewrite.
- **It's testable.** Pure functions with no I/O are the easiest thing there is
  to property-test — see the testing section of `CLAUDE.md`.

### Determinism is a hard requirement

The reducer may not read the clock, use ambient randomness, or depend on
mutable global state. Randomness is supplied by the platform as a **seed**.
Without this, replay diverges and results can't be verified — so this is
enforced in review, not merely encouraged.

### State visibility

Game state is split from the start:

```
publicState                — visible to everyone, including spectators
privateState[playerId]     — visible only to that player
```

with a view function:

```
view(state, viewerId) -> what that viewer may see
```

where `viewerId = null` yields the public view (spectators, a TV screen).

Ludo has empty private state, so this costs nothing now — but retrofitting it
after games and persistence exist would be expensive. It is what later enables
hidden-hand games and second-screen play.

## Platform services *(only seeded RNG built)*

Services every plugin gets rather than reimplementing:

- **Seeded RNG** — the only legitimate source of randomness in game logic.
- **Chat** — attached to the channel, owned by the platform, not the game.
- **Presence** — who's here, whose turn it is.
- **Shared pointer** — the one BGA feature worth stealing outright. A
  platform-level cursor games opt into, not something each game rebuilds.

## Domain model *(not built)*

Provisional; see `docs/GLOSSARY.md` for exact term meanings.

- **User**
- **Server** — a space (global lobby, private friend group, or a two-person DM)
- **Channel** — belongs to a server; either general text or a game table
- **Session** — one instance of a game being played in a channel
- **Move** — one attempted action by one player in a session
- **MoveLog** — the ordered record of accepted moves; the source of truth
- **Score / LeaderboardEntry** — for solo games, scoped to a channel and
  aggregated globally

### Channel model, and the migration we're reserving for

For now: **a channel is one game table**. Simplest thing that works, ships
fastest.

Reserved on the schema from day one so the later migration isn't a rewrite:

- `kind` on channel
- nullable `parent_channel_id`

The eventual evolution is a persistent channel (e.g. "#ludo" for a group) with
individual plays as sessions *inside* it. The forcing function for that
migration is **voice**: two concurrent games in one server must not share a
voice room, so voice has to scope to session, not to game type. Session is
therefore the atomic unit regardless of how sessions get grouped in the UI —
which is exactly why the grouping decision can be deferred safely.

Note that the persistent-chat-with-the-same-people problem is solved by the
server's general channel, not by the game channel. A game table's chat is
play-by-play for that one game; the relationship lives in the server.

## The server *(partly built)*

`apps/server` is a Cloudflare Worker; each game table is a Durable Object
(decision 021). The Worker owns HTTP — routing, validation, status codes — and
a table owns the game: it holds the move log in its own SQLite storage and
answers in outcomes, not status codes.

```
POST /api/tables             {game, seats}    -> 201 {table}
POST /api/tables/:code/players {name}         -> 200 {table}   take a seat
POST /api/tables/:code/start                  -> 200 {table}   close the seats
GET  /api/tables/:code       ?viewer=<name>   -> 200 {table}
POST /api/tables/:code/moves {player, move}   -> 200 {events, table} | 409
POST /api/tables/:code/messages {author, text} -> 200 {table}
GET  /api/games                               -> 200 {games}
```

A table is named by its room code, and `idFromName(code)` is the whole lookup —
there is no table index to keep consistent. State is never stored: every
request folds the stored log through the rules with `Session`, which is the
same mechanism as replay (see above) rather than a second path that could
disagree with it.

A table has two lives. In the **lobby** it is a code and a set of empty seats,
and anyone holding the code may take one by name. Taking a seat you already
hold hands the table back rather than refusing: closing a tab and following
the link again is the ordinary case, and a name is already the whole of the
credential here. Once **started** the seats close and it is a game. That order matters: it is what lets a game begin
without anyone having an account (decision 015), because a seat is claimed by
whoever is holding the link, not by whoever proved who they are.

A table keeps its conversation beside its move log, in the same storage: what
was said and what was played happened at the same table (decision 001). Only
the seated may speak; anyone with the code may read. Sitting down and starting
the game write their own notes into that thread, so it reads as a history of
the table rather than only of the chat.

Messages ride along on every table response rather than being fetched
separately. That is wasteful and deliberate: a table's conversation is small,
one round trip beats two, and a since-cursor is worth adding when a table's
history is long enough to notice.

What is built: opening a table, claiming a seat, starting, playing, chatting,
reading a view, and durability of both logs. What is not:

- **Nobody owns a seat.** Naming a seated player is enough to move — or to
  speak — for them. Two friends sharing a link is fine; strangers is not. A
  seat needs a token the server issued at claim time before this can face
  anyone untrusted.
- **No play-by-play online.** The demo narrates moves into its chat; an online
  table does not yet, so the thread holds people and table notes only.
- **No timestamps.** Lines are ordered but not dated, which will not survive
  asynchronous play — "your turn" from three days ago must look like it.
- **Nothing expires.** Tables are kept forever, which is wrong at any real
  scale and irrelevant at this one.

## Realtime *(not built)*

Not in the first slice. The MVP can be turn-based with refresh-to-see-state.

Realtime transport (websocket/SSE push) becomes mandatory as soon as
second-screen play arrives — a board on a TV updating as players act on their
phones cannot be poll-based by definition. Don't build it before then; don't
pretend it can be avoided after.

The shape it will take is already decided by where tables live: a Durable
Object can hold the WebSocket connections of everyone at its table, so pushing
a move to the other players is a broadcast from the object that just applied
it. No separate service, no shared bus.

Until then the shell **polls** — every 1.5s in a lobby, every 2.5s in a game,
and not at all once a game is finished. That is a placeholder with a cost
(latency you can feel, requests nobody needed) and it is deliberately kept in
one place, `apps/shell/src/table.ts`, so replacing it is a small change rather
than an excavation.

## The shell *(built)*

`apps/shell` is the product, not a demo of one (decision 025). Two panes: the
tables this browser has sat at, and the table it is looking at. On a phone
they become a stack — the list pushes to a table, a back control returns —
and in a game the chat becomes a sheet that rises over the board.

The shell knows how to reach a table and nothing about any game. It hands
`ludoUi` a container, a view and a dispatch, exactly as the contract below
describes; swapping Ludo for another plugin would not touch it.

## The UI boundary *(built)*

A game ships two things: rules and a way to draw them. The rules are a pure
reducer; the UI implements `GameUi`:

```
mount(container, { view, viewerId, dispatch }) -> { update, destroy }
```

Plain DOM in, plain data out, no framework in the contract (decision 017). A
plugin author may use React, Svelte, or none — and the platform shell can pick
its own framework independently, since hosting a plugin means handing it an
element.

The UI reports intent and never decides legality. It asks the rules what is
movable so it can show the player their options, but a client that lied about
that still could not make an illegal move: the reducer re-checks everything and
is the only authority.

**Decisions live in pure modules, drawing does not.** In the Ludo UI, *which
square a token is on* (`geometry.ts`) and *where it sits when several share a
square* (`placement.ts`) are pure functions with tests and a mutation score.
What is left in `board.ts` only sets colours and radii. This split is what
lets presentation be excluded from mutation testing honestly (decision 018) —
if drawing code starts deciding something, that decision moves out.

## Guests and room codes *(partly built)*

An earlier version of this document argued that persistent accounts made
Jackbox-style room codes unnecessary. That was wrong, and decision 015 revises
it: requiring an account to sit down is exactly the setup friction the product
exists to remove.

A **Guest** joins one Session by short room code, picks a display name, and
plays. The important property is that this costs the game plugins nothing:
`PlayerId` is opaque, so a reducer cannot tell a guest from an account holder
and has no business knowing. The distinction lives entirely in the platform.

What the platform owes a guest:

- **Survival across a refresh.** A guest identity is ephemeral but must be
  held in a client-side token, or a reconnecting player loses their seat
  mid-game.
- **A path to an account.** Claiming an account after a good first game must
  carry the guest's history with it.

What the platform withholds from a guest:

- Server ownership, invites, and posting in persistent channels — a guest is
  scoped to the one Session.
- Global leaderboard entries. Unauthenticated scores are trivially farmable,
  and a global board is only worth having if it means something. Session and
  channel boards are fine.

Room codes are a public entry point onto live games, so they need care: short
and unambiguous when read aloud (no O/0, I/1/l), rate-limited against
guessing, and expiring with the Session.

**Built so far:** a five-character code from that alphabet names a table, and
anyone holding it can claim a seat by picking a display name. **Not built:**
rate limiting, expiry, and the client-side token that would make a seat
actually belong to the browser that claimed it. Today a name is the only
credential, which is exactly as strong as trusting everyone who has the link.

## Second screen *(not built)*

A TV joining a game is a guest spectator — the same mechanism as above, with
no seat, receiving `view(state, null)`. That's the whole feature: shared state
on the big screen, private state on each phone.

## Stack

Deliberately not fixed repo-wide — best tool per layer, each choice recorded in
`docs/DECISIONS.md`. The binding constraints are:

- Web first; no install step for players.
- Game rules must be runnable independently of any UI framework.
- The plugin interface must stay language-agnostic, so third-party authors are
  never forced into our language choices.
