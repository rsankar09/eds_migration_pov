---
name: eds-block-mapping
description: Map a confirmed EDS component inventory to existing blocks — searching both the target EDS repo's own /blocks directory and public block collections (e.g. Adobe's block-collection, block-party, boilerplate blocks) — and recommend reuse, extend, or new-block-needed for each component. Use this after a component inventory has been human-confirmed and before any block code gets written or an import transform script is generated. Always stop for human approval of extend/new verdicts before continuing to eds-block-authoring or eds-import-transform.
compatibility: requires a confirmed inventory.json; read access to the target EDS repo; network access to public block-collection sources for building/refreshing the public index
---

# EDS block mapping

Decides, per component, whether an existing block already does the job,
whether one can be extended, or whether a new block is needed.

## Inputs

- Confirmed `inventory.json` from `eds-component-detect`.
- Path (or git URL) to the target EDS repo.
- A cached public block-collection index, if one exists (see below) — build
  or refresh it if missing or stale.

## Process

### 1. Build/refresh the two search indices

- **Internal index**: for every folder under the repo's `/blocks`, record
  name, README/description (if present), the `decorate()` function's rough
  shape (what DOM restructuring it does), and one example markup/table
  structure. Cache as `blocks-index.json`.
- **Public index**: same fields, pulled from known public EDS block sources
  (Adobe block-collection, block-party, the EDS boilerplate repo). This
  changes rarely — cache as `public-blocks-index.json` and only rebuild when
  the user asks or the cache is older than ~30 days.

### 2. Score candidates per component

For each inventory entry, compare its `type_guess` + `html_snippet` shape
against both indices using two signals:
- **Structural**: cell/row count, nesting depth, presence of media vs. text
  cells — same signals a human would eyeball in the block's example markup.
- **Semantic**: does the block's name/description match the component's
  purpose (e.g. `type_guess: "card-grid"` vs. a block literally named
  `cards`)?

Return the top 3 matches per component with a similarity score and one-line
rationale each.

### 3. Recommend a verdict

- **Reuse**: a candidate's structural + semantic match is strong and no
  visual variant is needed. Safe to auto-approve if score is high and the
  user has opted into that.
- **Extend**: a candidate is structurally close but missing a specific
  variant (e.g. existing `cards` block has no "horizontal" layout, or no
  video-in-card support) — list the specific gap(s).
- **New**: no candidate clears a reasonable similarity bar, or the component
  type doesn't exist in either index at all.

Emit `mapping.json`:
```json
[
  {
    "component_id": "cmp-003",
    "verdict": "extend",
    "candidates": [
      { "block_name": "cards", "source": "internal", "score": 0.71,
        "rationale": "Same card structure, missing horizontal-scroll variant",
        "gaps": ["horizontal scroll layout", "video-in-card support"] },
      { "block_name": "card-collection", "source": "public", "score": 0.66,
        "rationale": "Public block-collection card grid with scroll variant built in" }
    ]
  }
]
```

## Human gate — do not skip for extend/new

Present each non-`reuse` verdict with its screenshot crop and candidate
rationale. This decision shapes the design system going forward — getting a
reviewer to confirm "yes, extend `cards`" vs. "no, this deserves its own
block" is worth the pause. Reuse verdicts above a score threshold the user
sets can be auto-approved to reduce review load; everything else waits.

## Handoff

Approved `mapping.json` feeds both `eds-block-authoring` (for extend/new
entries) and `eds-import-transform` (for all entries, since even reused
blocks need a transform rule pointed at the right block contract).
