# EDS site migration — skill set

Five skills that chain into one pipeline for migrating an existing website into
Adobe Edge Delivery Services (EDS), built around the AEM Importer
(`aem-import-helper`).

## Pipeline order

```
eds-site-crawl
      │  capture-bundle/{page}/dom.json, styles.json, screenshots/*.png, meta.json
      ▼
eds-component-detect
      │  inventory.json   ← HUMAN GATE: confirm/merge/split components
      ▼
eds-block-mapping
      │  mapping.json     ← HUMAN GATE: approve reuse / extend / new
      ▼
   ┌──┴───────────────────────┐
   ▼                          ▼
eds-block-authoring     eds-import-transform
   block PR + diff report   import.js rules + QA report
                             ← HUMAN GATE: visual/content sign-off before bulk run
```

`eds-block-authoring` and `eds-import-transform` both consume `mapping.json` and
can run in parallel — the transform script needs to know the *target* block's
cell/row contract, which for new/extended blocks comes from
`eds-block-authoring`'s output, and for reused blocks comes from the existing
block's own docs.

## Handoff contract

Every skill reads/writes JSON at a fixed path so they can be chained by a
subagent, a Claude Code TodoList, or a custom orchestrator without re-deriving
context each time. See each skill's SKILL.md for its exact schema. Keep the
capture-bundle and inventory/mapping JSON around for the life of a migration
project — later stages (and human reviewers) need to re-open the original
screenshots and DOM to sanity-check decisions.

## Human-in-the-loop gates

Three points are marked as hard stops in the skills below — do not let an
agent auto-advance past them:

1. **Component inventory review** — cheapest place to fix a bad detection.
2. **Block mapping approval** — especially extend/new; this shapes the design
   system long-term.
3. **Final QA / content sign-off** — before running the import at scale.

Reuse-with-high-confidence mappings can be auto-approved if you want to reduce
reviewer load; everything else should wait for a person.

## Suggested repo layout for a migration project

```
migration-<site>/
├── capture/            # eds-site-crawl output, one folder per page
├── inventory.json       # eds-component-detect output (post-review)
├── mapping.json         # eds-block-mapping output (post-approval)
├── blocks-index.json    # cached embeddings of the target repo's /blocks
├── public-blocks-index.json  # cached embeddings of public block collections
└── import.js            # eds-import-transform output
```
