# Glossary

The project's ubiquitous language. **Use these words exactly** — in code, in
the UI, in commits, in conversation. One concept, one word. If you need a new
concept, add it here in the same commit that introduces it; if you rename one,
rename it everywhere.

Precision here is what stops a codebase drifting into three names for the same
thing.

---

**User** — a person with an account. Not "player" — see below.

**Guest** — someone playing without an account, joined to one Session by room
code (decision 015). Scoped to that Session: no server ownership, no invites,
no global leaderboard entries. May later claim an account and keep their
history.

**Room code** — the short, read-aloud-friendly code that admits a Guest to a
Session. Expires with the Session.

**Player** — a User *seated in a specific Session*. A User browsing a lobby is
not a player. Use `playerId` only where seat identity is meant.

**Spectator** — someone viewing a Session without a seat. Receives the public
view only (`view(state, null)`).

**Server** — a social space containing Channels. Three flavors, one concept:
a global per-game lobby, a private friend group, or a two-person DM. Do not
introduce a separate "DM" type (decision 007).

**Channel** — lives inside a Server. Either a **text channel** (general
conversation) or a **game table**.

**Game table** — a Channel that hosts a game. Currently one table = one game
instance (decision 004). Prefer "table" over "room" or "lobby" in UI copy.

**Session** — one instance of a game being played in a game table. The atomic
unit of play: voice scopes to it, replays belong to it, results attach to it.

**Game** — the *kind* of game (Ludo, Neon Climb). A Session is a play of a
Game. Never use "game" to mean a single play — that's a Session.

**Plugin** — an implementation of a Game: a Reducer plus a UI bundle. What a
third-party creator authors.

**Reducer** — the pure function at the heart of a Plugin:
`(state, move, playerId) -> (newState, events)`. Deterministic, no I/O, no
clock, no ambient randomness.

**Move** — one action a Player attempts in a Session. May be rejected; a
rejected Move never mutates state.

**Move log** — the ordered record of accepted Moves in a Session. The source
of truth: state is the fold of the log, never the other way round.

**Event** — something noteworthy the Reducer emits alongside new state (turn
ended, player won, points scored). The platform may act on Events (notify,
score); the Reducer never acts on them itself.

**Seed** — the platform-supplied randomness source. The *only* legitimate
source of randomness inside a Reducer.

**Public state** — the part of Session state visible to everyone, spectators
included. The board.

**Private state** — the part visible only to one Player. The hand. Keyed by
`playerId`.

**View** — `view(state, viewerId)` — what a given viewer may see.
`viewerId = null` yields the public view.

**Replay** — re-running a Move log through the Reducer to reproduce past
states. Not a stored recording; a recomputation.

**Leaderboard** — ranked scores for a Game. Scoped to a Channel, and
aggregated into a **global leaderboard** for that Game.

**Casual / Competitive** — the two play modes. Results are kept separate;
casual play never affects competitive rating (decision 009).

**Async play** — a Session where players take turns hours or days apart. The
default assumption for turn-based games, not a special mode.

**Shared pointer** — the platform-level cursor Players can point at the board
with. A platform service, not per-Game functionality.

---

## Words we deliberately avoid

- **"Room"** — use Channel or Game table.
- **"Match"** — use Session.
- **"Lobby"** — reserved for the *global* per-game Server. Don't use it for a
  pre-game waiting state; that's a Session that hasn't started.
- **"Bot"** — reserved for future AI opponents. Don't use it for platform
  automation.
