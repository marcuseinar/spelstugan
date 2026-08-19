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

---

## 014 — Mutation testing replaces MC/DC as the rigour gate

**Status:** accepted, supersedes the MC/DC-only position in 010

**Context:** MC/DC was the requested rigour standard. Decision 010 settled for
applying it by hand, since no checker exists for this stack. With latitude to
pick a better metric, the question became: what actually measures whether the
tests would catch a bug?

Coverage does not. It answers "did a test execute this line?", not "would a
test notice if this line were wrong?". The first Ludo suite made the gap
concrete: **99.29% branch coverage, 84.49% mutation score** — 29 ways to break
the rules that no test caught, in code that coverage called fully tested.

**Decision:** Gate CI on **mutation score** (StrykerJS), floor 85%, aiming at
90–95% for rules code. Keep branch coverage at 85% as a fast smoke alarm — it
runs in a second and catches whole untested files early. Keep property-based
testing for invariants. Keep the MC/DC *test-design* discipline for compound
boolean conditions, since naming each condition's independent effect makes
rules readable to a reviewer — but stop treating it as the measured standard.

**Consequences:** Mutation runs take about a minute, so it is a separate CI
job. It found two real weaknesses immediately: `board.ts` was only tested
indirectly through the rules, and `replay.ts` scored **0%** because its tests
lived in a different package — it had never really been tested at all. Both
are now covered, and the score is 92.52%.

**Revisit if:** the mutation run grows slow enough to hurt the feedback loop —
the answer then is to scope it to changed packages, not to drop the gate.

---

## 015 — Anonymous guests can play without an account

**Status:** accepted, revises the position in `docs/ARCHITECTURE.md` on
second-screen play

**Context:** The "no install, jump in and play" non-negotiable was previously
read as "persistent accounts make room codes unnecessary" — a TV or a phone
would open a channel already logged in. That assumed everyone at the table
already has an account, which is exactly the friction the product is supposed
to remove. Jackbox and codenames.game demonstrate the alternative: a short
room code, no signup, playing within seconds.

**Decision:** Support anonymous guests. A guest joins a specific session by
short code or link, picks a display name, and plays. No account, no email.

**Consequences:** Identity can no longer be assumed to imply a User.

- `PlayerId` is already opaque to games, so game plugins need no change — the
  reducer cannot tell a guest from an account holder, and shouldn't.
- A guest identity is ephemeral but must survive a page refresh, or a
  reconnecting player loses their seat mid-game.
- Guests are scoped to one session: they cannot own servers, invite others, or
  post in persistent channels.
- Guest results stay off global leaderboards. Unauthenticated scores are
  trivially farmable, and the global board is only worth having if it means
  something. Session and channel leaderboards are fine.
- A guest must be able to claim an account afterwards and keep their history,
  or the good first game is wasted.
- Room codes are a public entry point: short and unambiguous to read aloud
  (no O/0, I/1/l), rate-limited, and expiring with the session — otherwise
  they are an enumeration surface onto live games.

This strengthens rather than complicates the second-screen design: a TV that
joins as a guest spectator is the same mechanism.

---

## 016 — Don't start on AWS

**Status:** accepted

**Context:** AWS is wanted for the server side eventually, by an owner with no
AWS experience and a low cost ceiling.

**Decision:** Do not build on AWS now. Deploy the first version to a
platform-as-a-service (Fly.io, Render, or Railway) and revisit AWS when there
is a concrete reason — real traffic, a service only AWS offers, or credits.

**Reasoning:** AWS is not the cheap or easy option at this stage; it is the
option that assumes an operator. The pieces this product needs — a small
always-on server, a database, static hosting, later a websocket layer — are
one config file on a PaaS and a multi-week learning project on AWS, at
comparable or higher cost. Learning AWS while also designing a plugin runtime
and a social platform means doing two hard things at once, and the
infrastructure one produces no product.

**Consequences:** Nothing in the architecture leans on a provider: the rules
are pure functions, state is a move log, and there is no framework lock-in. So
this is reversible, which is exactly why it does not need deciding now. The
migration path and the cost traps that catch beginners are written up in
`docs/DEPLOYMENT.md` so the eventual move is informed rather than improvised.

**Revisit when:** there is measured traffic a PaaS struggles with, a hard
requirement for an AWS-only service, or AWS credits worth the switching cost.

---

## 017 — The plugin UI contract is framework-neutral

**Status:** accepted

**Context:** Decision 011 settled TypeScript but left the frontend framework
open. Building the first game UI forced the question. A plugin's UI is not the
same problem as the platform shell: the shell is ours, but a game UI may be
written by someone else (decision 002), and requiring them to adopt our
framework is the same barrier as requiring them to adopt our language.

**Decision:** A game UI implements `GameUi` — `mount(container, { view,
viewerId, dispatch })` returning `{ update, destroy }`. Plain DOM in, plain
data out. No framework appears in the contract.

The platform shell may still use any framework it likes; hosting a plugin is
then a matter of handing it an element. The first-party Ludo UI is written in
plain TypeScript and SVG, which proves the contract is honestly usable without
a framework rather than merely claiming to be.

**Consequences:** A plugin author can use React, Svelte, or nothing at all. The
UI reports intent and never decides legality — it asks the rules what is
movable and the reducer stays the authority, so a client that lies still cannot
make an illegal move. The frontend framework for the *shell* remains open.

---

## 018 — Presentation code is excluded from mutation, by name and with reasons

**Status:** accepted, refines 014

**Context:** Adding the Ludo UI dropped the mutation score from 92.5% to
76.3%. Nearly all survivors were in SVG drawing code: mutating `opacity: 0.55`
to `0.56`, or a radius from `0.34` to `0.35`, yields a board that looks
marginally different and behaves identically. The only tests that would kill
them would restate the constants back — precisely the number-chasing tests
`CLAUDE.md` forbids.

**Decision:** Exclude presentation-only modules from mutation, listed
individually in `stryker.config.json` with the reason written next to them.
Never lower the threshold to accommodate them.

The exclusion is earned, not assumed: every *decision* the UI makes was first
moved out of the drawing code into pure modules — `geometry.ts` (where a square
is) and `placement.ts` (where a token sits, and how tokens sharing a square
are arranged) — which are mutated and score 99% and 87%. What remains in
`board.ts` genuinely only sets attributes.

**Consequences:** The rule for future UI work: if drawing code starts deciding
something, that decision moves to a mutated module. Correctness of the drawing
itself is verified by running it — the board was played in a real browser, not
just asserted about.

Mutation testing paid for itself again here. Alongside the cosmetic survivors
it found three real defects: the board would still have invited a move after
the game was won, the "you rolled N" status text was never asserted by any
test, and two defensive fallbacks existed for states the rules make
impossible — now deleted rather than tested.

---

## 019 — A demo shell, built as a sketch of the real thing

**Status:** accepted

**Context:** The Ludo board worked, but standing alone it showed nothing about
the product's actual claim: that the conversation and the play live together.
A static mockup would have shown the layout without answering whether the
plugin boundary survives being embedded in a real shell.

**Decision:** Build `apps/shell` — server rail, channel sidebar, chat, and a
game plugin mounted inside a channel. Everything in memory; no server, no
persistence, hot seat. Deploy it as the public demo, with the standalone
playground kept underneath at `/playground/`.

It is a sketch, not scaffolding to throw away: the model mirrors the domain in
`docs/ARCHITECTURE.md` (Server, Channel, Session), the game is the real
reducer through the real `GameUi` contract, and the decisions live in pure,
mutated modules while the drawing does not (decision 018).

**Consequences:** The plugin boundary is now proven in the setting it was
designed for — the shell hands `ludoUi` an element and plain data, and knows
nothing about Ludo. Swapping the in-memory `ChatLog` and `Session` for a
server should not touch the shell's rendering at all; that is the next test of
this design.

Building it also surfaced two things a mockup would have hidden:

- **Play-by-play drowns conversation.** A stretch of Ludo produced 68 system
  lines against 3 human ones, all equally loud. System lines are now compact
  and dim so the people stay audible — the whole reason for putting both in one
  timeline (decision 001). This will matter more, not less, with a faster game.
- **The default channel was wrong.** Selecting a server opened whatever channel
  came first, including a game that had already finished. A test caught it
  before the code shipped; the rule is now that a finished game is never opened
  by default.

---

## 020 — The shell on a phone: a stack, a bottom bar, and one sheet

**Status:** accepted

**Context:** The shell was built three-columns-wide and did not survive a
390px screen: the main pane collapsed to 74px and the board drew off-screen.
The columns were the problem — a rail, a channel list and a channel cannot
share a phone.

**Decision:** On small screens the shell becomes a stack, following the
conventions phone users already know rather than inventing gestures:

- **Servers stay permanently visible** as a bottom bar in portrait, and as a
  left rail in landscape — the swap Material Design describes between bottom
  navigation and a navigation rail when vertical space is the scarce axis.
- **The channel list pushes to a channel**, with a back control in the header.
  `navigation.ts` owns that state; the layout decides *when* it applies with
  media queries, and ignores it when everything fits.
- **A game channel gives the screen to the board**, with the table chat as a
  bottom sheet over it. The sheet has two states: lowered, showing the newest
  line and the composer; and raised to two thirds of the pane, translucent and
  blurred so the board stays visible behind the talk.

The sheet is deliberately *two* states, not a ladder of stops. Three stops
meant a player had to think about which one they wanted and step through them;
two means one gesture, either direction, always lands somewhere they chose.

A tap and a drag are the same gesture with different distances, so both arrive
at `afterGesture(height, deltaY)`: under the threshold it is a tap and toggles,
over it the direction decides. Nothing lands the sheet at a position nobody
picked.

**Consequences:** The sheet is a portrait answer to a portrait problem and is
scoped to portrait alone — landscape lays the chat out as a column beside the
board, because a sheet rising through a 390px-tall window would bury the game
it exists to sit alongside.

Touch is now a first-class target throughout: 44px minimum tap targets, a
16px composer font (anything smaller makes iOS Safari zoom on focus),
`dvh`-based height so browser chrome cannot cut the layout off, safe-area
insets at the bottom, and a permanent — not hover-dependent — cue for movable
tokens.

Two bugs found by measuring rather than looking, both from media queries that
matched more than they were written for: the chat column in landscape
inherited the sheet's collapsed 132px height, and the game chat's fixed grid
rows handed the composer the space of a handle that only exists on phones.
Panes that stack a variable number of children are flex columns now, not fixed
grids.

---

## 021 — The server runs on Cloudflare Workers, with a Durable Object per table

**Status:** accepted

**Context:** Decision 016 said "not AWS, start on a platform-as-a-service" and
left the platform open. Choosing it properly meant pricing the alternatives —
Cloudflare, Render, Fly, Railway, and three different shapes of AWS — for the
product we are actually building.

**Decision:** Cloudflare Workers, with **one Durable Object per game table**
and the move log in its SQLite storage. D1 later for the relational parts
(accounts, servers, channels) if and when they need it.

The fit decided it, not the price. A Durable Object is a single consistent
addressable object with storage attached, which is what a game table already
is in `docs/ARCHITECTURE.md`: one move log, one strict order of events, one
place the truth lives. Serialising moves per table is the platform's default
rather than something we build. WebSockets come with it, so the realtime
transport phase 2 requires (decision 005) arrives with the model instead of as
a separate service.

The price merely agreed: free at our size against roughly $14/month for a
Render pair, $8–15 for a Lightsail box someone has to administer, and $75–95
for the AWS shape most tutorials produce.

**Consequences:** This is the Workers runtime, not Node. **`game-kit` and the
game plugins must stay free of Node-specific APIs** — no `fs`, no `crypto`
module, no `Buffer` — so the same rules run in the browser, in tests, and on
the edge. That constraint is easy to hold today and expensive to recover if it
is broken quietly, so it belongs in review.

Deployment stays git-push: GitHub Actions runs the gates and then
`wrangler deploy`, with the Cloudflare API token as a GitHub secret. No
long-lived credentials exist in the repository or in any agent's hands —
GitHub secrets are write-only, which is what makes it safe to have an agent
deploy at all. `docs/DEPLOYMENT.md` has the setup steps.

The AWS material in that file is deliberately kept. It is the comparison this
decision rests on, and the trigger for revisiting is written down there rather
than left to memory.


---

## 022 — Online tables: a lobby first, and no accounts anywhere

**Status:** accepted

**Context:** The shell played its own in-memory game and the server played
real ones, and the two did not know about each other. Joining them raised the
question the product has been deferring since decision 015: what does someone
have to be, to sit down?

**Decision:** Nothing. A table is **opened** with a game and a seat count, and
anyone holding the code **claims a seat** by typing a display name. When every
seat is taken, anyone at the table may **start** it, which closes the seats.
No account, no signup, no verification — the link is the invitation and the
code is the whole of the authorization story.

The lobby exists because the alternative was worse: the host would have had to
invent everyone else's name in advance, and the other players would have
arrived to find themselves already named. Claiming a seat is the smallest step
that lets someone arrive as themselves.

The name a browser used is remembered per code in `localStorage`, because
phones reload constantly and being refused for using your own name is an
absurd way to lose a game.

**Consequences:** **A seat belongs to nobody.** Naming a seated player is
enough to move for them — there is no token proving the browser that claimed a
seat is the one now using it. That is acceptable for friends sharing a link
and is not acceptable for strangers, so it blocks any public opening. The fix
is a seat token issued at claim time; it is small, and it is deliberately not
built yet because nothing public exists to protect.

The shell **polls** rather than being pushed to: 1.5s in a lobby, 2.5s in a
game, never once finished. Deliberately confined to one module so the
websocket transport (decision 005) replaces it rather than being threaded
through the UI.

Online tables had **no chat** when this decision was first written; decision
024 closed that.

---

## 023 — A schema change empties a table, until real games exist

**Status:** accepted, with an expiry date

**Context:** Adding the lobby changed a Durable Object's SQLite schema.
`CREATE TABLE IF NOT EXISTS` does not migrate, so tables written by the older
shape started failing with "no such column" — found by running the end-to-end
script against storage that already existed.

**Decision:** The store carries a schema version. Storage written by a
different version is **dropped and recreated**, not migrated.

**Consequences:** This is only defensible because no game anyone would miss
has been played here. A move log is the product's memory, and the day a real
one exists this must become an additive migration — new columns with
defaults, a rewrite that preserves the log, or a refusal to serve rather than
a reset. Whoever adds the first feature that real people use owns changing it.

It is written down in `apps/server/src/store.ts` next to the version constant,
because that is where somebody will be standing when they need to know.


---

## 024 — Chat lives with the move log, in the same table

**Status:** accepted

**Context:** Online tables could be played but not talked at, in a product
whose entire thesis (decision 001) is that the conversation is the thing and
the game lives inside it. A game you can play in silence with a stranger is
Board Game Arena, which is what this exists not to be.

**Decision:** A table's messages are stored in the Durable Object that holds
its move log — same object, same storage, one thread. Sitting down and
starting write notes into it, so the history reads as the table's, not the
chat box's. Only the seated may speak; anyone holding the code may read.

Messages come back on **every** table response rather than from an endpoint of
their own. One round trip instead of two, and the poll that was already
fetching the board now fetches the conversation for free.

**Consequences:** Whole-history-every-poll is wrong at scale and right at this
one. The moment a table's thread is long enough to notice, this needs a
since-cursor — the shape is ready for it, since messages already carry
ascending ids.

**Lines carry no timestamp.** Ordering is enough while both players are
looking at the same screen, and it will not survive asynchronous play, where
"your turn" needs to look three days old. Adding one is easy; the reason it is
not there is that the clock has no business in this repo until something needs
it, and no reducer may ever read it (see `CLAUDE.md`).

The demo's chat renderer draws both — the mockup's invented conversation and
the real table's — because one renderer is what keeps the pretend one honest
about what the real one can do.


---

## 025 — The demo is gone; the shell is the product

**Status:** accepted

**Context:** `apps/shell` was built as a sketch (decision 019): invented
servers, invented conversation, a hot-seat game, and — once online tables
existed — a *second* screen where the real thing lived. Two of them, side by
side, one pretend.

That cost more than it looked. Starting a real table was a button bolted onto
a fake sidebar, where it stretched to fill a row meant for a channel list. The
real table then replaced the whole window, so the shell around it vanished at
exactly the moment a player needed to know where they were. Both bugs were
the same bug: the product was a guest in its own mockup.

**Decision:** Delete the demo. The shell now shows only what is real:

- The sidebar lists **the tables this browser has sat at** — code and the name
  it sat under — with **New table** as a row among them. Starting a game is
  where the games are.
- The main pane holds the table: the setup form, the lobby, or the board with
  its chat. The frame stays put throughout.
- No servers, no channels, no invented people. When those become real, they
  come back as themselves.

Deleted with it: `demoData.ts`, `workspace.ts` and its Server/Channel model,
the in-memory `ChatLog`, and the client-side play-by-play narrator. The domain
model those sketched still lives in `docs/ARCHITECTURE.md`, where a plan
belongs; the narrator's real home is the server, which already has the events
and now owns the conversation (decision 024).

**Consequences:** The published page is smaller and honest — nothing on it
implies a feature that does not exist. What it loses is the showroom: there is
no longer a screen that shows what a busy server would feel like. That was
worth having while the product was a promise and is worth less now that it is
a thing you can play.

The list of tables is **local to a browser**, not an account, and says so on
screen. It is a convenience, not an identity, and it disappears when the
storage does — which is the honest shape of a product with no accounts
(decision 022).


---

## 026 — A light palette, with ink derived rather than picked

**Status:** accepted, still provisional (supersedes the palette in 012)

**Context:** The owner supplied four bands to work from: a pale sky
`#b8dbe4`, a cream `#eaece0`, a sand `#dbc6b0` and a tan `#d1a988`. The app
was dark; this is not.

**Decision:** The four bands carry the surfaces — cream for the main pane,
sky for the sidebar, sand for the board's track, tan in the board's home
columns — and **every ink colour is derived from them rather than taken from
them**. Four light bands cannot spell out text on each other; text, borders
and the accent are darkened until they can.

Nothing was chosen by eye. Each value was checked against every surface it
can appear on and clears WCAG AA — 4.5:1 for text, 3:1 for the faint and the
edges. The worst case is sand, so the tokens are tuned against sand and are
comfortable everywhere else. The accent is a deep blue drawn out of the sky
band, so the one strong colour on screen still belongs to the palette.

**Consequences:** Seat colours changed too — pastels that read on a dark board
disappear on a cream one. They are deeper now and still four clearly separate
hues, each at least 3:1 against the board. They remain the one exception to
theming (decision 013): a theme may never make two players' pieces look alike.

Decision 013 stands: this is still provisional and user-chosen palettes are
still the plan. That every colour goes through a semantic token is what made
this swap a change to one block rather than a change to the whole stylesheet
— which is the argument for the rule, now demonstrated.

---

## 027 — The page is kept up to date, not rebuilt

**Status:** accepted

**Context:** The shell redrew everything on every change, and a table polls
every one to three seconds. On a phone that meant the keyboard vanished
mid-word, half-typed names disappeared, and scrolling back through the chat
was yanked to the bottom by the next poll. Three reports, one cause: the
input a player was using did not survive the redraw, because nothing did.

**Decision:** A screen that can change under a player is drawn once and
**refreshed in place**. Each such screen returns its element together with a
`refresh(table)`, and the shell compares a *shape* — which table, which phase,
whether the viewer is seated — to decide between refreshing and redrawing.
Composers, name fields and scroll positions are never rebuilt for a change
that did not need them rebuilt.

The board is refreshed through the plugin contract's own `update(view)`, which
existed for exactly this and which the shell had been ignoring in favour of
mounting a fresh copy each time.

**Consequences:** Chat follows the conversation only for a reader already at
the end of it; scrolled up, they are left where they are.

The app's height now follows `visualViewport` rather than `dvh` alone. `dvh`
tracks the address bar but knows nothing about the keyboard, which is what put
the composer underneath it.

Rendering is now two paths where it was one, and the shape string is what
keeps them honest — get it wrong and a stale screen persists. Its one job is
to name everything a redraw would change, so anything added to a screen must
be either refreshable or in the shape.


---

## 028 — Leaving a table is local, and walking back in is allowed

**Status:** accepted

**Context:** The sidebar listed every table this browser had sat at and gave
no way to be rid of one. Worse, `forgetting()` had been written for exactly
that and left unwired — a feature half-built, which `CLAUDE.md` says not to
land.

**Decision:** Each table row carries a leave control. Leaving removes the
table **from this device's list only**: the table stays on the server, the
other players stay at it, and the invite link still works. Nobody owns a table
(decision 022), so there is nobody who could close one for everybody, and
pretending otherwise would be a lie in the interface.

Leaving the table currently open falls through to the next one down, or to the
new-table screen when the list empties. The notice says the link still works,
because the alternative is a player believing they destroyed the game.

**Joining a seat you already hold now succeeds** instead of being refused for
using your own name. Leaving and following the link again was a dead end
otherwise. It grants nothing new: a name is already the whole credential here,
so anyone who could take a seat this way could already move and speak from it.
When seats get tokens, this becomes "resume with your token" and the dead end
stays closed.

**Consequences:** A player who leaves a table and loses the link has lost the
way back to it, and no account exists to recover it. That is the price of a
list with no server behind it, and it is why the sidebar says out loud that
tables are remembered on this device only.
