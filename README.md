# Spelstugan

[![CI](https://github.com/marcuseinar/spelstugan/actions/workflows/ci.yml/badge.svg)](https://github.com/marcuseinar/spelstugan/actions/workflows/ci.yml)
[![Demo](https://github.com/marcuseinar/spelstugan/actions/workflows/pages.yml/badge.svg)](https://github.com/marcuseinar/spelstugan/actions/workflows/pages.yml)

A social-first gaming platform. Discord-shaped servers and channels, where the
channels are game tables — built on the bet that the social layer is the
product and the games live inside it, rather than the other way round.

**[Open the demo](https://marcuseinar.github.io/spelstugan/)** — the whole
shell: servers, channels, chat, and a real game of Ludo inside one of them.
([Just the board, on its own.](https://marcuseinar.github.io/spelstugan/playground/))

**Status: two people can play a real game.** Open the demo, hit *Play with a
friend*, send the code, and play from two devices — no account, nothing to
install, and you can talk to each other while you play. The server is a
Cloudflare Worker with a Durable Object per table, keeping the move log and
the conversation together. The surrounding shell — servers, channels — is
still a mockup.

```bash
npm install
npm run dev             # the shell at localhost:5174
npm run dev:playground  # just the Ludo board, at localhost:5173
npm run check           # lint, typecheck, tests, coverage gate
npm run test:mutation   # the rigour gate — see CLAUDE.md
npm run dev --workspace @spelstugan/server   # the server, on localhost:8787
```

## Start here

| Document | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | How code gets written here — standards, testing, definition of done |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What we're building and why |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the system is shaped |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What's done, what's next, what's deferred |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions already made, and why |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | The project's vocabulary — use these words exactly |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Where this will run, and the cloud cost traps to avoid |

Picking the work up cold? Read them in that order. `docs/ROADMAP.md` is the
handoff point and should always reflect reality.

## The idea in one paragraph

Platforms like Board Game Arena implement games well but treat social as an
afterthought: chat doesn't persist with the same people across games, finished
games are hard to find again, voice and video are weak. Spelstugan inverts
that. Each game gets a global lobby where anyone can play casually or
competitively; groups of friends get their own servers with channels; two
people can play privately. The conversation with a group survives every
individual game.

Games are plugins, not hardcoded features — a pure rules function plus a UI
bundle — so anyone can eventually add one, and replay, spectating, and
asynchronous play come out of that design rather than being built separately.

## Packages

| Package | What it is |
|---|---|
| `packages/game-kit` | The contract every game implements: a pure reducer, seeded randomness, replay from the move log |
| `packages/games/ludo` | Ludo — the first game: rules, board geometry, and UI |
| `apps/shell` | The demo shell — servers, channels, chat, hosting a game plugin |
| `apps/server` | The server — a Worker, with each game table a Durable Object |
| `apps/playground` | A focused harness for playing Ludo on its own |
