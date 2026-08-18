# Spelstugan

A social-first gaming platform. Discord-shaped servers and channels, where the
channels are game tables — built on the bet that the social layer is the
product and the games live inside it, rather than the other way round.

**Status: design phase.** No application code yet. What exists is the
documentation set below and a UI mockup under `design/mockup/`.

## Start here

| Document | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | How code gets written here — standards, testing, definition of done |
| [`docs/PRODUCT.md`](docs/PRODUCT.md) | What we're building and why |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the system is shaped |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What's done, what's next, what's deferred |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Decisions already made, and why |
| [`docs/GLOSSARY.md`](docs/GLOSSARY.md) | The project's vocabulary — use these words exactly |

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
