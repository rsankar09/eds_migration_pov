---
name: eds-block-authoring
description: For EDS components approved as "extend" or "new" in a block mapping, extract style tokens from the captured source styles and author or modify the actual block code (decorate.js + CSS) in the target EDS repo, then visually verify the rendered block against the original screenshot. Use this once a block mapping has been human-approved and only for entries whose verdict is extend or new — reused blocks don't need this skill. Always leave extend/new block code as a reviewable diff or branch; never merge/commit directly without a code review gate.
compatibility: requires an approved mapping.json with extend/new verdicts; the capture bundle (styles.json, screenshots); write access to the target EDS repo; a local EDS dev server or equivalent render harness; Playwright for screenshot diffing
---

# EDS block authoring

Turns an approved "extend" or "new" verdict into real block code, checked
against the original design.

## Inputs

- Approved `mapping.json` entries where `verdict` is `extend` or `new`.
- The capture bundle's `styles.json` and `screenshots/*.png` for the
  corresponding component.
- Target EDS repo (write access, ideally on a feature branch).

## Process

### 1. Extract and normalize style tokens

From `styles.json`, pull the component's colors, spacing values, font
family/size/weight, and breakpoint-specific layout changes. Before inventing
new CSS custom properties, check the repo's existing token file (commonly
`styles/styles.css`) for a close match (e.g. a captured `#1a73e8` that's
within a few steps of an existing `--link-color`) — reuse the existing token
rather than duplicating it. Only propose new tokens for values with no
reasonable match.

### 2. Read before you write

Before authoring anything, open 2–3 existing blocks in the repo to learn
local conventions: how `decorate()` is typically structured, naming patterns,
how CSS files reference tokens, and how variants are usually expressed (extra
class on the block wrapper is the common EDS pattern).

### 3a. New block

Scaffold `/blocks/<name>/<name>.js` and `<name>.css`:
- `decorate(block)` restructures the authored table markup into the final
  DOM (see repo conventions from step 2 — don't reinvent the pattern).
- CSS uses the normalized tokens from step 1.
- Match the component's responsive behavior across the breakpoints captured.

### 3b. Extend existing block

- Add a variant class (e.g. `cards.horizontal`) rather than branching the
  base `decorate()` logic, unless the gap requires new DOM structure the
  existing function can't produce.
- Confirm the change doesn't alter output for existing usages of the block —
  check other pages/blocks that already reference it if you can find them.

### 4. Verify visually

Render the block standalone (local EDS dev server, or an equivalent minimal
harness) and screenshot it at the same breakpoints as the capture. Diff
against the original `screenshots/*.png` crop for that component region.
Iterate on CSS until the diff is within a reasonable tolerance, or — if a gap
remains that's a deliberate simplification rather than a bug — note it
explicitly in the handoff rather than silently leaving it.

### 5. Lint/build

Run whatever lint/build step the repo defines before considering the block
done.

## Output

A branch/diff containing the new or modified block files, plus a short visual
diff report (before/after screenshots + any noted remaining gaps) attached to
the same component id from `mapping.json`.

## Human gate

Code review / PR approval before merge — this skill produces a proposal, not
a finished merge.
