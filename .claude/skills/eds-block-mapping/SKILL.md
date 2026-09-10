---
name: eds-block-mapping
description: Map a confirmed EDS component inventory to existing blocks — searching both the target EDS repo's own /blocks directory and public block collections (e.g. Adobe's block-collection, block-party, boilerplate blocks) — and recommend reuse, extend, or new-block-needed for each component, together with the authoring content model and behaviour contract the block will need. Use this after a component inventory has been human-confirmed and before any block code gets written or an import transform script is generated. Always stop for human approval of extend/new verdicts before continuing to eds-block-authoring or eds-import-transform.
compatibility: requires a confirmed inventory.json; read access to the target EDS repo; network access to public block-collection sources for building/refreshing the public index
---

# EDS block mapping

Decides, per component, whether an existing block already does the job,
whether one can be extended, or whether a new block is needed — and defines
what the block must expose to authors.

## Inputs

- Confirmed `inventory.json` from `eds-component-detect`.
- Path (or git URL) to the target EDS repo.
- A cached public block-collection index, if one exists (see below).

## Process

### 1. Build/refresh the two search indices

- **Internal index**: for every folder under `/blocks`, record name,
  README/description, the `decorate()` function's rough shape (what DOM
  restructuring it does), its example markup/table structure, **and the
  fields already declared in its `_{block}.json` model**. Cache as
  `blocks-index.json`.
- **Public index**: same fields from known public EDS block sources (Adobe
  block-collection, block-party, the EDS boilerplate). Changes rarely — cache
  as `public-blocks-index.json`, rebuild on request or when >30 days old.

### 2. Score candidates per component

Compare each inventory entry's `type_guess` + `html_snippet` against both
indices on three signals:

- **Structural** — cell/row count, nesting depth, media vs. text cells.
- **Semantic** — does the block's name/description match the component's
  purpose (`type_guess: "card-grid"` vs. a block named `cards`)?
- **Behavioural** — does the candidate already implement the component's
  `behavior` slice? A `cards` block is not a match for a component with an
  autoplay rotator, however similar the markup.

Return the top 3 matches per component with a score and one-line rationale.

### 3. Define the content model

For every component, regardless of verdict, decide what the author actually
edits. Walk the component's DOM and classify each part as a field:

- text → `text`, rich text → `richtext`, image → `reference` + an alt `text`,
  link → `aem-content` or `text` + label, choice → `select`.
- Anything that repeats becomes rows the author adds, not a numbered field
  per instance (`card1Title`, `card2Title` is the classic wrong answer).
- Anything the design fixes — a colour, a column count that never varies —
  is **not** a field. Fields are for what changes.
- Each `variants` entry from the inventory becomes an option on a single
  `classes` select field, not a separate block.

Follow https://www.aem.live/developer/component-model-definitions. This
section is what makes the block authorable in Universal Editor; a mapping
without it forces the next skill to invent a model.

### 4. Recommend a verdict

- **Reuse** — strong structural + semantic + behavioural match, no new
  variant needed. Auto-approvable above a threshold the user sets.
- **Extend** — structurally close, missing a specific variant or behaviour.
  List the specific gaps.
- **New** — nothing clears a reasonable bar, or the type doesn't exist in
  either index.

Prefer extend over new. A fourth card-like block is a design-system cost that
outlives the migration.

### 5. Emit `mapping.json`

```json
[
  {
    "component_id": "cmp-003",
    "verdict": "extend",
    "target_block": "cards",
    "candidates": [
      { "block_name": "cards", "source": "internal", "score": 0.71,
        "rationale": "Same card structure, missing horizontal-scroll variant",
        "gaps": ["horizontal scroll layout", "video-in-card support"] },
      { "block_name": "card-collection", "source": "public", "score": 0.66,
        "rationale": "Public collection card grid with scroll variant built in" }
    ],
    "content_model": {
      "row_contract": "one row per card: [ image | title + body + cta ]",
      "fields": [
        { "name": "image", "component": "reference", "label": "Image" },
        { "name": "imageAlt", "component": "text", "label": "Alt" },
        { "name": "text", "component": "richtext", "label": "Text" },
        { "name": "classes", "component": "select", "label": "Layout",
          "options": ["default", "horizontal"] }
      ]
    },
    "behavior_contract": {
      "interaction": "none",
      "css_hover": ["ul.menu li:hover > ul { display: block }"],
      "notes": "submenu is statically rendered; no JS needed"
    }
  }
]
```

## Human gate — do not skip for extend/new

Present each non-`reuse` verdict with its screenshot crop, candidate
rationale, **and its proposed content model**. Two decisions matter here and
both are long-lived: whether to extend or fork a block, and what authors get
to edit. Reuse verdicts above the user's threshold can be auto-approved.

## Handoff

Approved `mapping.json` feeds both `eds-block-authoring` (extend/new entries,
which need code and a model partial) and `eds-import-transform` (all entries —
even reused blocks need a transform aimed at the right row contract).
