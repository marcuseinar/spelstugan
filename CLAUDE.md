# Engineering Guide

This file is the standing contract for how code gets written in this repo. It
applies to humans and to Claude sessions alike. If a change conflicts with
something here, either the change or this file is wrong — fix whichever one
is actually wrong, don't just ignore the mismatch.

## What this project is

A social-first gaming platform (Discord/Slack-shaped: servers, channels,
DMs) where each channel can host a game instance with text/voice/video
attached. Games are plugins, not hardcoded platform features — see
`docs/` (once it exists) for the product/architecture discussion this file
assumes as background.

## Stack (current decision — expect this to evolve, update this section when it does)

- **The platform is Rust.** Everything that constitutes "the platform"
  proper — the backend service (auth, servers/channels/sessions,
  persistence, API), the domain model, and the plugin host/ABI — is
  written in Rust, in a Cargo workspace. This part is not negotiable per
  project direction: it's the one place language uniformity matters, since
  it's the trusted core everything else talks to.
- **The rest is not required to be Rust.** UI/frontend code (the web
  client, and later iOS) can be built in whatever stack renders well,
  Rust or not — the only constraint is the delivery mechanism: it has to
  ship as WASM or as native JS/DOM, nothing that requires an install step
  or a bespoke runtime. Concretely this leaves the door open to a
  plain TS/JS web frontend, or a Rust-via-WASM frontend (e.g. Dioxus/Leptos)
  if that ends up preferred once something real has been built — don't
  lock this in prematurely.
- **Game plugin boundary:** a WASM ABI, hosted server-side via a WASM
  runtime (e.g. wasmtime). The ABI is language-agnostic on purpose — a
  plugin author does not have to know Rust, only produce a WASM module that
  satisfies the contract. First-party games' logic is written in Rust
  because we control them; third-party creators are never required to use
  Rust, for their logic or their UI.
- Do not add a new major dependency (framework, runtime, database) without
  writing one paragraph in the PR description on why the existing stack
  doesn't cover it.

## Code style — Clean Code, Rust dialect

The standard here is Robert C. Martin's *Clean Code*, adapted to Rust idiom.
Concretely:

- **Names are the primary documentation.** A function/variable/type name
  should make a comment unnecessary. If you feel the urge to comment *what*
  a line does, rename things until the urge goes away.
- **Functions do one thing.** If a function needs a "and" to describe it,
  split it. Prefer many small, well-named private functions over one long
  one — this is not a performance concern in Rust, the compiler inlines
  aggressively.
- **Small modules, single responsibility.** A module that owns "everything
  about X" is fine; a module that owns "X and also some Y utilities" is not.
- **Guard clauses over nesting.** Prefer early `return`/`continue`/`?` to
  pyramid-of-doom `if` nesting. Two levels of indentation inside a function
  body is a signal to extract a function.
- **Few, structured arguments.** More than ~3 positional arguments, or any
  `bool` argument whose meaning isn't obvious at the call site, means:
  introduce a struct, or split into two differently-named functions instead
  of one function with a mode flag.
- **Errors are values.** Library/domain code returns `Result<T, E>` with a
  real error type (`thiserror`), never panics for a condition a caller can
  trigger. `.unwrap()`/`.expect()` are for tests, `main`, and genuinely
  unreachable invariants — and an `.expect()` on an invariant must say *why*
  it's unreachable in the message, not just describe the value.
- **`unsafe` is exceptional.** Every `unsafe` block carries a `// SAFETY:`
  comment stating the invariant that makes it sound. Keep the block as small
  as possible; don't let `unsafe` leak into a bigger function than it needs
  to.
- **Comments explain "why", never "what".** A comment justified by a
  non-obvious constraint, a workaround for a specific bug, or a subtle
  invariant is welcome. A comment restating the code in English is not. No
  commented-out code gets committed — delete it, git remembers.
- **DRY, but the rule of three.** Two similar-looking blocks are not yet a
  problem. Extract an abstraction on the third occurrence, once the shared
  shape is actually proven, not before.
- **No speculative generality.** Don't add config knobs, trait
  indirection, or plugin points for a future that isn't real yet. This
  applies doubly to game logic: a game reducer should be exactly as generic
  as the plugin ABI requires and no more.
- **Determinism is a hard requirement for game-reducer code specifically.**
  No wall-clock reads, no thread/OS randomness, no shared mutable global
  state inside a game's reducer. Randomness comes from a seed the platform
  hands the plugin. This isn't a style preference — replay and anti-cheat
  both depend on it.
- **Formatting and lints are non-negotiable and automated**, not a matter of
  taste: `rustfmt` on every file, `clippy` with `-W clippy::pedantic` as a
  baseline, promoted to `deny` in CI for lints the team hasn't explicitly
  opted out of in `Cargo.toml`.

## Testing

Tests are the executable spec. Untested behavior is unspecified behavior.

### Unit tests

- Every non-trivial public function gets tests for: the happy path, each
  documented error case, and boundary values (empty, zero, max, one-past-
  max — whichever apply).
- Colocate unit tests with the code (`#[cfg(test)] mod tests` at the bottom
  of the file). If a test needs elaborate setup to reach the function it's
  testing, that's usually a sign the function/module boundary is wrong —
  fix the boundary before working around it with test scaffolding.
- One assertion concept per test. Name the test after the behavior, not the
  function: `rejects_move_when_not_players_turn`, not `test_apply_move_2`.
- A test with a conditional (`if` inside a `#[test]` fn, deciding whether to
  assert) is a bug magnet — split it into separate tests instead.
- Tests must be hermetic: no wall-clock dependence, no network, no shared
  mutable state across tests, no dependence on test execution order.

### Property-based tests for game logic

Game reducers are pure functions (`(state, move, player) -> (state,
events)`), which makes them an unusually good fit for property testing —
use it, don't just hand-write examples. With `proptest`, assert invariants
like:
- Replaying a recorded move log through the reducer always reproduces the
  exact same final state (this *is* the replay feature — test it as a
  property, not just an example).
- The reducer never panics for any well-typed move against any reachable
  state.
- A move rejected as illegal never mutates state (no partial application).

### MC/DC — as a discipline, not a claimed tool guarantee

There is no mainstream, off-the-shelf MC/DC checker for Rust (that tooling
mostly lives in avionics/automotive toolchains for C/C++/Ada). Don't claim
MC/DC coverage from a tool that isn't actually measuring it. Instead:

- For any function with a compound boolean condition (turn validity, win
  detection, scoring rules — the actual rules of a game), write the test
  cases so each individual condition is shown, by at least one test pair, to
  independently flip the outcome while the others are held fixed. This is
  the MC/DC test-*design* discipline, applied by hand.
- Name/group these tests so the condition being isolated is obvious from
  the test name, so a reviewer can check the discipline was actually
  followed without re-deriving the truth table themselves.
- If real MC/DC tooling becomes worth chasing later (e.g. for a
  certification-adjacent reason), that's a deliberate follow-up, not a
  silent assumption baked into this file.

### Coverage as a floor, not a target

- CI runs `cargo-llvm-cov` and gates on branch/region coverage, not just
  line coverage. Default floor: 85%, per crate. Adjust the number
  deliberately if it's wrong, don't quietly let it drift.
- Coverage is a signal that untested code exists, not a goal to be
  maximized. Never write a test whose only purpose is moving the number —
  if you can't state what behavior a test verifies, delete it.

### Integration tests

- Crate-level behavior (the plugin ABI boundary, the server's HTTP/WS API)
  gets integration tests under `tests/`, exercising the public interface
  only — no reaching into private internals to make a test pass.

## CI gates (all required, no merging with a red one)

1. `cargo fmt --check`
2. `cargo clippy --all-targets -- -D warnings`
3. `cargo test --workspace`
4. `cargo llvm-cov` coverage floor (see above)

## Workspace layout (provisional — a sketch, not a commitment)

```
crates/
  domain/        pure domain types: User, Server, Channel, Session, Move...
  plugin-abi/     the WASM host<->guest contract (types + trait defs)
  plugin-host/    wasmtime-based sandboxed plugin runner
  games/ludo/     first-party Ludo plugin logic (reducer, compiled to WASM)
  games/<solo>/   first-party solo/high-score plugin logic
  server/         backend service: auth, channels, sessions, persistence, API

web/              frontend client — stack TBD (plain TS/JS, or Rust-via-WASM
                  if that proves out); lives outside the Cargo workspace if
                  it isn't Rust
games/*/ui/       per-plugin UI bundles, same rule: whatever stack, ships as
                  WASM or native JS/DOM
ios/              (later) thin native shell around the same plugin UIs
```

Expect this to change as soon as real code makes it obviously wrong — update
it in the same PR that changes it, don't let it rot into fiction.

## Commit hygiene

- Small, focused commits; a commit does one logical thing and includes its
  tests.
- No half-finished features on `main`/the working branch — land things
  behind a clean boundary (unused-but-complete) rather than partially wired
  up.
- Boy Scout Rule: leave touched code cleaner than you found it, but don't
  drive-by-refactor unrelated code in a feature commit — that's a separate
  commit.
