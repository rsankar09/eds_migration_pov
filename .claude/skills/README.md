# EDS site migration — skill set

Six skills that chain into one pipeline for migrating an existing website into
Adobe Edge Delivery Services (EDS), built around the AEM Importer
(`aem-import-helper`).

Nothing in the pipeline is specific to a site or a source CMS. Every heuristic
keys off standard HTML/ARIA/CSS signals, so the same skills work on the next
migration without editing them.

## Pipeline order

```
eds-site-crawl                              ← scripts/capture.mjs
      │  capture/<page>/ dom.html · styles.json · css/ · behavior.json
      │                  assets.json · tokens-raw.json · screenshots/
      │  capture/index.json  (template groups)
      ├─────────────────────────────┐
      ▼                             ▼
eds-design-system            eds-component-detect     ← scripts/tokens.mjs
   design-system.{json,css,md}   inventory.json
   ← HUMAN GATE: token roles     ← HUMAN GATE: component boundaries
      │                             │
      └──────────────┬──────────────┘
                     ▼
              eds-block-mapping
                 mapping.json  (+ content model, behaviour contract)
                 ← HUMAN GATE: approve reuse / extend / new
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
eds-block-authoring        eds-import-transform
  .js + .css + _{block}.json   import.js rules + path map
  visual diff report            QA report + Universal Editor check
                                ← HUMAN GATE: sign-off before bulk run
```

`eds-block-authoring` and `eds-import-transform` both consume `mapping.json`
and can run in parallel — the transform needs the *target* block's row
contract, which for new/extended blocks comes from `eds-block-authoring` and
for reused blocks from the existing block's own docs.

## Executable steps

Two stages ship real scripts. Run them rather than re-implementing:

```bash
# capture (multi-page, multi-breakpoint, CSS + behaviour + assets)
node .claude/skills/eds-site-crawl/scripts/capture.mjs --url <url> --out capture

# site-wide design tokens from everything captured so far
node .claude/skills/eds-design-system/scripts/tokens.mjs --capture capture
```

## Handoff contract

Every skill reads/writes JSON at a fixed path so the chain can be driven by a
subagent, a TodoList, or a custom orchestrator without re-deriving context.

The join key across all of it is **`data-eds-id`**: the crawler stamps every
captured element, and that id appears in `dom.html`, `styles.json`,
`css/index.json`, `behavior.json` and `assets.json`. Given a component you can
always recover its computed styles, its source CSS rules (including `:hover`
and `@media`), its behaviour and its media — which is what lets later stages
reproduce a component instead of approximating it from a screenshot.

Keep the capture bundle and the inventory/mapping JSON for the life of the
project — later stages and human reviewers re-open the originals.

## Human-in-the-loop gates

Four hard stops. Do not let an agent auto-advance past them:

1. **Design token roles** — cheap to settle, and every block inherits them.
   The generator flags close calls explicitly.
2. **Component inventory** — cheapest place to fix a bad detection, and the
   place where variants get correctly folded into one block.
3. **Block mapping** — extend/new verdicts *and* the authoring content model.
   This shapes the design system long-term.
4. **Final QA** — before importing at scale, including a check that each
   block is actually editable in Universal Editor.

Reuse-with-high-confidence mappings can be auto-approved to reduce reviewer
load; everything else waits for a person.

## Repo layout for a migration project

```
capture/                        # crawl output, one folder per page
├── index.json                  # page list + template groups
├── design-system.{json,css,md} # eds-design-system output
├── inventory.json              # eds-component-detect output (post-review)
├── mapping.json                # eds-block-mapping output (post-approval)
└── <page-slug>/…
blocks-index.json               # cached index of the target repo's /blocks
public-blocks-index.json        # cached index of public block collections
tools/importer/import.js        # eds-import-transform output
```
