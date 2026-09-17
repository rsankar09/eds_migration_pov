# EDS site migration — skill set

Seven skills that chain into one pipeline for migrating an existing website into
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
   └──────────┬──────────────┘
              ▼
      eds-page-assemble
      the whole page, locally: every component in source order + chrome
              ← HUMAN GATE: page-level diff before anything is uploaded
              ▼
       eds-author-upload
       imported page live in AEM author, editable in Universal Editor
              ← HUMAN GATE: confirm target env; sample page before bulk run
```

Two stages exist because component-scoped work does not add up to a page.
`eds-page-assemble` is the first time the migration is a *page*: adjacency,
shared-global regressions, chrome, missing components and the project's own
breakpoints only surface there. Verify blocks individually, then verify them
together, then upload.

The pipeline is only "done" at `eds-author-upload`. Everything before it
produces code and scripts: blocks in the repo, a transform that *would*
convert pages. Nothing lands a page an author can open until this stage runs.
It is also the only stage that touches a live environment, which is why it
carries two gates rather than one.

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

## Keeping the rules applied (vendor refresh + bypass)

Adobe ships its own edge-delivery skills (`aem-edge-delivery-services:*`,
vendored and refreshed on a schedule). `building-blocks` in particular is a
parallel block-authoring path that knows nothing about this repo's conventions,
so rules kept only inside `eds-block-authoring` can be bypassed simply by
entering through it.

The block-authoring rules therefore live in one repo-owned file:

```
.claude/skills/eds-block-authoring/references/authoring-contract.md   ← single source
.claude/hooks/eds-authoring-contract.sh                                ← injects it
.claude/settings.json                                                  ← PreToolUse/Skill
```

A `PreToolUse` hook on the `Skill` tool injects the contract whenever a
block-authoring skill is invoked — `eds-block-authoring`, and Adobe's
`building-blocks`, `content-driven-development` and `testing-blocks`. It is
inert for every other skill, and never blocks if the script is missing.

Consequences worth knowing:

- **A vendor refresh cannot drop the rules** — nothing of ours lives in the
  vendored tree, and the hook is keyed on skill-name suffixes, so a namespace
  change still matches.
- **There is one copy.** `eds-block-authoring`'s step 3 points at the contract
  rather than restating it. Put new block-authoring rules in the contract file,
  not in a skill, or the two will drift.
- **Precedence is explicit.** The injected text states that the contract
  outranks the more general guidance in whichever skill is running, so an agent
  following Adobe's "restructure the authored table markup" wording still gets
  the cells-not-rows requirement.

To narrow or widen coverage, edit the `case` list in the hook script. To test a
change without a session restart:

```sh
echo '{"tool_name":"Skill","tool_input":{"skill":"eds-block-authoring"}}' \
  | .claude/hooks/eds-authoring-contract.sh | jq -r '.hookSpecificOutput.additionalContext'
```
