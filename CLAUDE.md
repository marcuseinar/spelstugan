# Engineering Guide

This file is the standing contract for how code gets written in this repo. It
applies to humans and to AI agents alike. If a change conflicts with something
here, either the change or this file is wrong — fix whichever one is actually
wrong, don't silently ignore the mismatch.

**If you are an agent picking this repo up cold, read in this order:**

1. This file — how we work.
2. `docs/PRODUCT.md` — what we're building and why.
3. `docs/ARCHITECTURE.md` — how the system is shaped.
4. `docs/ROADMAP.md` — what's done, what's next, what's deliberately deferred.
5. `docs/DECISIONS.md` — decisions already made, and why. Don't relitigate
   these without new information.
6. `docs/GLOSSARY.md` — the project's vocabulary. Use these words exactly.

## The documentation duty (this is not optional)

Docs are part of the deliverable, not an afterthought. **Every change that
alters behavior, structure, or direction updates the relevant doc in the same
commit as the code.** Specifically:

- Changed how the system is shaped? → `docs/ARCHITECTURE.md`
- Made a call that a future contributor might otherwise second-guess or
  accidentally reverse? → append an entry to `docs/DECISIONS.md`
- Finished, started, or re-scoped a slice of work? → `docs/ROADMAP.md`
- Introduced or renamed a domain concept? → `docs/GLOSSARY.md`

The test of whether the docs are good enough: **a fresh agent with no
conversation history should be able to read them and continue the work
without asking questions.** If you had context in a conversation that isn't
written down, it doesn't exist. Write it down.

Never leave a doc describing intent that the code has since contradicted. A
stale doc is worse than no doc, because it gets trusted.

## Commit and authorship rules

- **The repository owner is the author of every commit.** Agents commit as
  `marcuseinar <78vmnfw27z@privaterelay.appleid.com>`. Do not add
  `Co-Authored-By` trailers naming an AI, and do not put model names, tool
  names, or session links in commit messages, PR bodies, or code comments.
- Small, focused commits; a commit does one logical thing and includes both
  its tests and its doc updates.
- No half-finished features land. Prefer complete-but-unwired over
  partially-wired.
- Boy Scout Rule: leave touched code cleaner than you found it — but don't
  drive-by-refactor unrelated code inside a feature commit. That's its own
  commit.

## Stack

The guiding rule is **best tool for each job**, decided per layer and written
down in `docs/DECISIONS.md` when chosen. There is no repo-wide language
mandate.

- **Web first.** The product ships as a web app. iOS is a later question to be
  revisited once the web product proves itself — do not add native-mobile
  scaffolding, abstractions, or compromises "for later".
- **No install step for players.** Whatever the frontend is built with, the
  experience is: open a link, play. That constraint outranks stack preference.
- **Game logic is separable from the platform.** Game rules live behind a
  plugin boundary and must be runnable independently of any UI framework — see
  `docs/ARCHITECTURE.md`. This is the one structural rule the stack choice may
  not violate.
- Do not add a major dependency (framework, runtime, database) without an
  entry in `docs/DECISIONS.md` explaining what the existing stack couldn't do.

## Code style — Clean Code

The standard is Robert C. Martin's *Clean Code*, applied in whatever language
a given layer uses.

- **Names are the primary documentation.** If you want to write a comment
  explaining *what* code does, rename things until the comment is redundant.
  Names come from `docs/GLOSSARY.md` — one concept, one word, everywhere.
- **Functions do one thing.** If describing a function needs the word "and",
  split it. Prefer many small, well-named functions over one long one.
- **Small modules, one responsibility each.** A module that owns "X and some
  Y helpers" is two modules.
- **Guard clauses over nesting.** Early return beats a pyramid of `if`. Two
  levels of indentation in a function body is a signal to extract.
- **Few, structured arguments.** More than ~3 positional arguments, or a
  boolean whose meaning isn't obvious at the call site, means: introduce a
  named structure, or split into two clearly-named functions.
- **Errors are values at boundaries.** Domain and library code reports failure
  explicitly rather than crashing on conditions a caller can cause. Validate
  at system boundaries (user input, network, plugin output); trust internal
  invariants rather than defensively re-checking them everywhere.
- **Comments explain *why*, never *what*.** A comment earns its place by
  recording a non-obvious constraint, a subtle invariant, or a workaround for
  a specific bug. Never commit commented-out code — git remembers.
- **DRY, but rule of three.** Two similar blocks are not a problem yet.
  Abstract on the third, once the shared shape is proven.
- **No speculative generality.** No config knobs, indirection layers, or
  extension points for futures that aren't real yet.
- **Determinism is mandatory in game rule code.** No wall-clock reads, no
  ambient randomness, no shared mutable global state inside a game's reducer.
  Randomness arrives as a seed from the platform. Replay, spectating, and
  anti-cheat all depend on this — it is a correctness requirement, not taste.
- **Formatting and linting are automated, not debated.** Every language layer
  gets a formatter and a linter wired into CI before real code lands in it.

## Testing

Tests are the executable specification. Untested behavior is unspecified
behavior.

### Unit tests

- Every non-trivial public function is tested for: the happy path, each
  failure mode, and boundary values (empty, zero, max, one-past-max).
- One behavior per test. Name tests after the behavior, not the function:
  `rejects_move_when_not_players_turn`, never `test_apply_move_2`.
- A test containing a conditional that decides whether to assert is a latent
  bug — split it into separate tests.
- Tests are hermetic: no clock dependence, no network, no shared mutable
  state, no reliance on execution order.
- If a test needs elaborate setup to reach what it's testing, the boundary is
  wrong. Fix the design rather than growing the scaffolding.

### Property-based tests for game logic

Game reducers are pure functions, which makes them an unusually good fit for
property testing. Assert invariants, not just examples:

- Replaying a recorded move log reproduces the identical final state. (This
  *is* the replay feature — test it as a property.)
- The reducer never crashes for any well-typed move against any reachable
  state.
- A move rejected as illegal leaves state completely unchanged — no partial
  application.

### MC/DC — a discipline, not a tool claim

Automated MC/DC checkers are avionics/automotive tooling and aren't broadly
available for the languages we're likely to use. So don't claim MC/DC from a
tool that isn't measuring it. Instead, apply it by hand where it matters:

- For any compound boolean condition in rules-critical code (turn validity,
  win detection, scoring), write cases so that **each individual condition is
  shown to independently flip the outcome** while the others are held fixed.
- Name and group those tests so a reviewer can see the discipline was followed
  without re-deriving the truth table.
- If real MC/DC tooling becomes worth adopting later, that's a deliberate
  decision with an ADR — not an assumption baked in silently here.

### Coverage as a floor

- CI gates on **branch/region coverage**, not line coverage. Default floor:
  85% per module. Change the number deliberately, with an ADR — don't let it
  drift.
- Coverage detects untested code; it is not a goal to maximize. Never write a
  test whose only purpose is moving the number. If you can't say what behavior
  a test pins down, delete it.

### Integration tests

Public interfaces (the plugin boundary, the server API) get tests that
exercise them from the outside only. Never reach into private internals to
make a test pass.

## Definition of Done

A change is done when **all** of these are true. Agents: do not report work as
complete otherwise — say explicitly which of these you couldn't satisfy.

1. It does what was asked, and you have observed it working — not merely
   compiled it. For UI, that means opening it; if you cannot, say so plainly
   rather than implying it was verified.
2. Tests cover the new behavior, including its failure modes, and the whole
   suite passes.
3. Formatter and linter are clean.
4. The relevant docs (above) are updated in the same commit.
5. No debug leftovers, dead code, commented-out blocks, or TODOs without an
   owner and a reason.
6. Committed with the owner as author, and pushed.

## Working with AI agents on this repo

- **Read before writing.** Grep the actual code. Never infer an interface from
  memory or assume a helper exists.
- **Prefer editing over creating.** New files need a reason; new abstractions
  need three occurrences.
- **Ask when a decision is the owner's to make** — product direction, spending
  money, anything hard to reverse. Make the reasonable call on everything else
  and note it.
- **Never fabricate progress.** "Tests pass" means you ran them. "It works"
  means you saw it work. Report blockers as blockers.
- **Leave the campsite documented.** Before ending a work session, the roadmap
  should reflect reality, so the next agent starts from truth rather than
  archaeology.
