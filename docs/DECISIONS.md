# Decision log

Append-only. Each entry records a decision, the reasoning at the time, and
what would justify revisiting it. **Don't delete or rewrite entries** — if a
decision is reversed, add a new entry that supersedes the old one and mark the
old one as superseded.

Format: number, title, status, context, decision, consequences.

---

## 001 — Social continuity is the product, not a feature

**Status:** accepted

**Context:** The idea began as a reaction to Board Game Arena: good games, poor
social layer. Chat doesn't persist with the same people across games, finished
games are hard to find, voice/video are weak.

**Decision:** Build social-first. When a tradeoff arises between social
continuity and game-feature depth, social continuity wins.

**Consequences:** Justifies putting persistent servers/channels ahead of a
large game catalogue, and reserving voice/video space in the UI before it's
implemented.

---

## 002 — Games are plugins behind a pure reducer interface

**Status:** accepted

**Context:** The long-term goal is that creators — not just us — can add games.
BGA's real moat is hundreds of community-implemented games.

**Decision:** A game is a pure reducer `(state, move, playerId) -> (newState,
events)` plus a separate UI bundle. The platform owns turn order, persistence,
and the move log. Moves cross the boundary as serialized messages, never
shared objects.

**Consequences:** Replay, spectating, and async resumption come free from the
move log. The interface is designed as if plugins were untrusted and remote,
even though today they're first-party and in-process — so adding real sandbox
isolation later is an infrastructure change, not an API rewrite. Cost: game
logic must be deterministic (no clock, no ambient randomness), so the platform
must supply a seeded RNG.

**Revisit if:** the reducer shape proves unable to express a game we actually
want. Note that `boardgame.io` is structured similarly and is worth studying
before inventing more here.

---

## 003 — Public/private state split exists from day one

**Status:** accepted

**Context:** A wanted feature is games displaying private data (your hand, on
your phone) alongside public data (the board, on a TV). Ludo, the first game,
has no hidden information at all.

**Decision:** Model state as `publicState` + `privateState[playerId]` with a
`view(state, viewerId)` function immediately, even though the first game leaves
the private half empty.

**Consequences:** Free now, expensive to retrofit after games and persistence
exist. Note that neither Ludo nor a solo high-score game exercises this path —
so a hidden-information game is needed as a third proof point before the design
can be trusted.

---

## 004 — Channel is one game table, with schema reserved for evolution

**Status:** accepted

**Context:** Two models were considered: channel = one game instance (simple,
but the sidebar accumulates dead channels), versus persistent channel per game
type with plays as sessions inside it (better long-term, more upfront work).

**Decision:** Ship channel = one game table. Reserve `kind` and a nullable
`parent_channel_id` on the schema now so the later migration isn't a rewrite.

**Consequences:** Faster to ship. The real forcing function for migrating is
voice, not sidebar clutter: two concurrent games in one server can't share a
voice room, so voice must scope to session. Session is the atomic unit either
way, which is why the grouping decision is safe to defer.

---

## 005 — Realtime transport deferred until second-screen play

**Status:** accepted

**Context:** Live board updates require push (websocket/SSE). The first slice
is async turn-based, where refresh-to-see is acceptable.

**Decision:** No realtime transport in the MVP. It becomes mandatory when
second-screen play lands, since a TV board updating from phone actions cannot
be poll-based.

**Consequences:** Simpler first slice. Not a permanent avoidance — the need is
scheduled, not wished away.

---

## 006 — Voice/video: reserved in UI, not implemented; hosted when built

**Status:** accepted

**Context:** Voice/video is described as integral to the product, and is also
the single largest infrastructure cost — WebRTC signaling, SFU, TURN,
bandwidth. Projects of this kind die on that scope, not on game logic.

**Decision:** Reserve the UI space now (disabled mic/camera affordances in the
channel header) so layout doesn't get reshuffled later. Build nothing yet. When
built, use a hosted service (LiveKit/Daily/Agora) rather than self-hosting a
media server.

**Consequences:** Users see where it's going; we don't pay for it yet.
Self-hosting is a lot of infrastructure for very little differentiation.

---

## 007 — DMs are not a special case

**Status:** accepted

**Decision:** A two-person DM is a server with exactly two members and no
invite flow. No separate concept, no second code path.

---

## 008 — Invite-only first, public-capable by design

**Status:** accepted

**Context:** The intent is a public platform eventually; invite-only is easier
to start.

**Decision:** Launch invite-gated. Don't assume a permanently small trusted
user base in the data model or the permission model, but don't build
public-scale infrastructure or moderation tooling before there are public-scale
users.

**Consequences:** Moderation tooling (blocking, reporting, muting) is required
before any public opening — it's a promise implied by "social done right", not
an optional extra.

---

## 009 — Casual and competitive play must not share a rating

**Status:** accepted

**Context:** Global lobbies imply stranger-matchmaking with skill ratings.
Friend servers imply zero-pressure play. BGA separates casual from Arena
ratings for this reason.

**Decision:** Keep casual and competitive results separate in the data model
from the start.

**Consequences:** Avoids either polluting competitive rating with
messing-around-with-friends games, or needing two entirely separate
matchmaking paths bolted on later.

---

## 010 — MC/DC is a test-design discipline, not a tooling claim

**Status:** accepted

**Context:** MC/DC coverage was requested. Automated MC/DC checkers are
avionics/automotive tooling (DO-178C, ISO 26262) for C/C++/Ada; no mainstream
equivalent exists for the languages we're likely to use.

**Decision:** Gate CI on branch/region coverage (85% floor). Apply MC/DC by
hand as a test-design discipline in rules-critical code: each condition in a
compound boolean must be shown to independently flip the outcome. Verified in
review, not by a tool.

**Consequences:** Honest about what's actually measured. Adopting real MC/DC
tooling later would be its own decision entry.

**Revisit if:** a certification-adjacent requirement appears, or usable tooling
shows up for our stack.

---

## 011 — No repo-wide language mandate; web first

**Status:** accepted, supersedes an earlier "platform is Rust" position

**Context:** Rust was initially proposed for the whole platform, for speed and
memory safety. On examination, those arguments are weak for a UI layer: UI work
is bound by layout/paint rather than CPU, the JS↔WASM boundary can make
fine-grained DOM updates slower, and memory safety addresses a bug class that
garbage-collected UI code never had. The costs are real — smaller component
ecosystem, weaker devtools, slower iteration, and a higher barrier for
third-party game authors, most of whom know JS/TS rather than Rust.

**Decision:** No repo-wide language requirement. Choose the best tool per
layer, record each choice here. Web first; iOS revisited only after the web
product proves itself.

**Consequences:** Binding constraints remain: no install step for players; game
rules must run independently of any UI framework; the plugin interface stays
language-agnostic. One place a compiled-to-WASM module is genuinely attractive
is running the *same* game reducer client-side for optimistic local moves and
replay scrubbing, with no risk of the client's rules drifting from the
server's — that's code reuse, not a UI framework decision.

---

## 012 — Pastel-on-dark palette, provisionally

**Status:** provisional — good enough to keep working against, not settled

**Context:** Four directions were tried in the mockup: a neon/futuristic
scheme (too futuristic), a warm wood-toned scheme (background lost what was
good about the first), a Cobalt2-derived navy-and-gold, and a Swedish cabin
scheme drawn from the project's name. The chosen direction returns to the
original cool dark background with the neon accents replaced by pastels.

**Decision:** Use a pastel-on-dark palette: cool dark violet base, with soft
mauve as the primary accent and rose / periwinkle / peach / teal for player
colors. Text is a soft blue-white rather than stark white. Board surfaces keep
a subtle limed-oak grain so a game table reads as a table without warming the
rest of the interface.

This is close to **Catppuccin Mocha**, which is a mature, accessibility-tested
pastel-on-dark palette. Current values are hand-picked approximations of it.
Pinning Catppuccin exactly — and gaining its ready-made component and editor
themes — is an open option, not yet taken.

**Consequences:** Colors are already expressed as semantic tokens
(`--bg`, `--surface`, `--accent`, `--text`, per-player colors) rather than
literal values scattered through markup. Keep it that way: it is what makes
both a palette swap and the user-selectable theming below cheap.

**Revisit when:** theming work starts (below), or if the palette proves to
have contrast problems in real use.

---

## 013 — User-selectable theme palettes are a planned feature

**Status:** accepted as direction; not scheduled

**Context:** The palette above is one choice among several the owner wanted to
see. Rather than searching for a single palette everyone likes, let users pick.

**Decision:** Users will eventually choose their own theme palette. Not built
now, and not on the near roadmap — but it constrains how styling is written
from the start.

**Consequences:** Never hardcode a literal color in a component. Every color
goes through a semantic token, so a theme is a set of token values and nothing
else. This also applies to game plugins: a plugin's UI should draw its chrome
from platform tokens, while colors that carry game meaning (player seat colors,
board regions) stay under the game's control — a theme must not be able to make
two players' pieces indistinguishable.
