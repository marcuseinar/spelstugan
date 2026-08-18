# Product

## The problem

Board Game Arena (and platforms like it) implement games well — solid rules
engines, adequate graphics — but treat the social layer as an afterthought.
Concretely, what's broken there:

- Chat is not persistent with the same people across games. You play someone
  ten times and there's no thread connecting those ten games.
- Finished games and their conversations are hard to find afterwards.
- Voice and video are poor or absent.
- The one genuinely good social feature is the shared **pointer** — being able
  to point at the board while talking about it.

## The bet

**Social first, games second.** Not a game platform with chat bolted on: a
social platform where the games happen to live. If a feature choice trades
away social continuity for game-feature depth, we take social continuity.

## Shape of the product

Discord/Slack-shaped, in Discord's vocabulary:

- **Server** — a space. Two kinds:
  - A **global lobby** per game, where anyone can meet strangers and play
    casually or competitively.
  - A **private server** created by a group of friends.
- **Channel** — inside a server. Either a general text channel, or a **game
  table**: one instance of a game, with its own text, voice, and video.
- **DM** — two people playing together privately. Structurally just a server
  with exactly two members; not a separate concept with its own code path.

## Non-negotiables

1. **No install, no heavy process.** Open a link, set up a game, play. Setup
   friction is the thing we're competing on — protect it. This extends to
   signup: a Guest can join a game by room code with no account at all, the
   way Jackbox and codenames.game work (decision 015).
2. **Asynchronous play is first-class.** Turn-based games must work when
   players are hours apart, not only when everyone is online at once. That
   implies notifications and turn timers, not just stored state.
3. **Games are plugins.** Eventually anyone can author one. The platform never
   hardcodes knowledge of a specific game's rules.
4. **Social continuity.** The conversation with a group survives every
   individual game. This is the whole premise.

## Game types supported

- **Turn-based multiplayer**, sync or async — BGA-style. First target: Ludo.
- **Solo / high-score**, with leaderboards and replays. Leaderboards are
  scoped to a server/channel *and* tie into a global board for that game.
- **Hidden-information games** — where each player sees private state (a hand)
  while shared state (the board) is public. This also enables second-screen
  play: hand on your phone, board on a TV.

## Deferred, deliberately

These are wanted, but not in the first slice — see `docs/ROADMAP.md`:

- Voice and video (UI space is reserved now; no implementation).
- Second-screen / private-hand play.
- Global lobbies and multi-server support.
- Third-party plugin authoring and sandboxing (the *interface* is designed for
  it from day one; the isolation machinery is not built yet).
- Moderation tooling — required before any public launch, not before the first
  friends-only build.

## Audience trajectory

Invite-only at first (simplifies auth, moderation, and infrastructure), built
so it can open to the public later. Design choices should not assume a small
trusted user base permanently — but don't pay for public-scale infrastructure
before there are public-scale users.
