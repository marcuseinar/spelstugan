# Architecture

Status: **design agreed, not yet implemented.** Nothing in `crates/`, `src/`,
or equivalent exists yet — this describes the shape we are building toward.
Update this file as reality arrives; do not let it describe a system that
isn't what got built.

## The central idea: the platform owns everything except the rules

A game plugin knows its own rules and nothing else. The platform owns identity,
persistence, turn scheduling, chat, presence, notifications, and the move log.
This split is what makes third-party games possible later without rewriting the
platform.

## The plugin contract

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

## Platform services

Services every plugin gets rather than reimplementing:

- **Seeded RNG** — the only legitimate source of randomness in game logic.
- **Chat** — attached to the channel, owned by the platform, not the game.
- **Presence** — who's here, whose turn it is.
- **Shared pointer** — the one BGA feature worth stealing outright. A
  platform-level cursor games opt into, not something each game rebuilds.

## Domain model

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

## Realtime

Not in the first slice. The MVP can be turn-based with refresh-to-see-state.

Realtime transport (websocket/SSE push) becomes mandatory as soon as
second-screen play arrives — a board on a TV updating as players act on their
phones cannot be poll-based by definition. Don't build it before then; don't
pretend it can be avoided after.

## Guests and room codes

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

## Second screen (deferred, designed for)

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
