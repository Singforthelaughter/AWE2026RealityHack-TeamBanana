# Agent Instructions — Team Banana (AWE 2026 Reality Hack)

## Before you make any changes

1. **Read `MAP.md`** in this folder. It describes every script in the project, what each one does, and which scripts depend on which. Do not skip this step.

## After you make any changes

2. **Update your section in `MAP.md`** — the block between your `<!-- BEGIN_SECTION: _Name -->` and `<!-- END_SECTION: _Name -->` delimiters.
   - Added a script? Add an entry.
   - Deleted or renamed a script? Remove or update its entry.
   - Changed a public API or cross-file dependency? Update the entry and the Dependency Graph.
   - **Only edit your own section. Do not touch any other section, even to fix a typo.**

3. **`git pull` before editing `MAP.md`** to avoid clobbering another agent's update.

## Platform notes (Lens Studio 5.x — Spectacles)

- World units are **centimetres**. Distances in metres must be × 100.
- TypeScript with `isolatedModules: true` — no `const enum`, no implicit globals.
- See MAP.md for per-script gotchas before modifying any existing script.
