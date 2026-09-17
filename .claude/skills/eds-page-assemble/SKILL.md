---
name: eds-page-assemble
description: Compose every approved component of a migrated page into one complete local page — in source order, with real copy and assets, plus header and footer — and verify it responsively against the source full-page screenshot before anything is uploaded. Use this after eds-block-authoring and before eds-author-upload. It is the first point at which the migration is a page rather than a pile of blocks, and it is where adjacency, shared-global regressions, chrome, and missing components surface. Do not treat a set of individually verified blocks as a finished page.
compatibility: requires a confirmed inventory and approved mapping; block code for every non-deferred component; a local EDS dev server serving a drafts folder; a headless browser for measurement and full-page screenshots; network access if source assets still need downloading
---

# EDS page assembly

Every earlier stage is component-scoped. This one is not: it builds the whole
page locally and checks it as a page.

## Why this stage exists

A set of individually verified blocks is not a verified page. Things that are
invisible component-by-component, and that this stage exists to catch:

- **Adjacency.** Band padding and section margins only resolve against
  neighbours. Whether two bands sit flush or 40px apart cannot be seen on a
  fixture containing one band.
- **Shared-global regressions.** A token or a shared utility is changed for
  one block and quietly alters another.
- **Chrome.** Header and footer load through a different path
  (`getMetadata('nav'/'footer')` → fragment). If no fixture ever needed them,
  a `/nav` 404 can sit in the console for a whole session being dismissed as a
  local-dev artifact.
- **Missing components.** The mapping lists what the page needs, but nothing
  forces each one to exist until the page is composed. A gap reads as "not
  built yet" only when you try to assemble the whole thing.
- **Breakpoints the components were never tested at.** See below.

## Inputs

- Confirmed `inventory.json` and approved `mapping.json`.
- The capture bundle: full-page `screenshots/*.png`, `dom.json` (for real
  copy), `styles-*.json` (for band colours and section geometry).
- Block code for every component with a `map` disposition.

## Process

### 1. Account for every component before building

List the inventory in source order and mark each: which block or section
style renders it, or `defer`. Anything with no answer is a gap — say so now
rather than discovering it halfway through. Components deferred earlier (nav,
footer, third-party embeds) still need *something* on the page; deferring the
integration is not the same as omitting the component.

### 2. Take copy and assets from the capture, not by retyping

Extract the real text from `dom.json` and download the real assets from the
source. Retyped copy wraps differently, and wrap points are exactly what the
responsive checks measure. Keep assets beside the draft page.

### 3. Compose the page in source order

One section per component, using the section styles the capture measured
(band background colours are in `styles-*.json`). Wire the chrome through page
metadata rather than editing block code:

```
| metadata |
| nav      | /drafts/<path>/<site>-nav    |
| footer   | /drafts/<path>/<site>-footer |
```

### 4. Verify as a page, at the union of breakpoints

Test at **captured ∪ the project's own CSS breakpoints**. These sets are
usually disjoint: a capture at 375/768/1440 tests none of a project that
switches at 600/900/1200, and that gap is where responsive bugs live. Read the
`@media` widths out of the project's CSS and add them.

At every width, assert:

- **No horizontal overflow** — `document.documentElement.scrollWidth` equals
  the viewport. Cheapest assertion available; catches fixed-width tracks and
  released wrappers that look perfect in a screenshot.
- **Every block reaches `data-block-status="loaded"`**, and the count matches
  the component list from step 1.
- **No console errors and no failed requests**, chrome included. A 404 here is
  a finding, not background noise.
- Full-page screenshot diffed against the capture's screenshot at the same
  width.

### 5. Report the page-level diff

Total page height against the source is a useful single number, but explain
it rather than just stating it — font substitution, deliberate breakpoint
deviations, and deferred components all legitimately change it. Separate:

- fixed since the component stage,
- deliberate deviation, with the measured difference,
- blocked (fonts, third-party embeds, shared chrome styling).

## Human gate

Present the composed page and the diff before `eds-author-upload`. This is the
last point where a mistake is free: after upload, the same mistake is content
in someone's environment.

Shared chrome deserves its own decision. Header and footer are used by every
page in the repo, so restyling them to match one migrated site regresses the
others. If the target's chrome differs, scope it behind the site's theme class
rather than editing the shared blocks, and get that agreed explicitly.

## Handoff

The assembled, verified page and its diff feed `eds-author-upload`. Blocks
that only fail once composed go back to `eds-block-authoring` — a page-level
symptom is still a block-level bug.
