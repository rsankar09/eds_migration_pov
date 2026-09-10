---
name: eds-design-system
description: Derive a site-wide EDS design system — colour roles, font stacks, type scale, spacing scale, container width and real breakpoints — from a capture bundle's computed styles and source CSS, and emit a paste-ready `:root` block for styles/styles.css. Use this after eds-site-crawl and before eds-block-authoring, so blocks are written against shared tokens instead of hardcoded hex values. Always stop for human review of the token roles before editing the repo's global styles.
compatibility: requires a capture bundle from eds-site-crawl (styles.json, css/index.json, tokens-raw.json); write access to the target EDS repo's styles/
---

# EDS design system extraction

Blocks written against `#00457c` are unmaintainable; blocks written against
`var(--brand-navy)` are a design system. This skill produces the token layer
first, so every block authored afterwards references it.

Run this **once per site**, not once per page — the whole point is to find the
values shared across templates.

## Run it

```bash
node .claude/skills/eds-design-system/scripts/tokens.mjs --capture capture
```

Writes three files to the capture root:

- **`design-system.css`** — a `:root` block using the EDS boilerplate's own
  variable names (`--text-color`, `--link-color`, `--body-font-family`,
  `--heading-font-size-*`, `--content-max-width`, `--nav-height`), so it drops
  into `styles/styles.css` with minimal editing.
- **`design-system.json`** — the full derivation, including what was merged
  into each role and the source's own custom properties.
- **`design-system.md`** — a reviewer-facing summary with the basis for each
  role and an explicit **close calls** section.

## How roles are derived

Frequency alone is a bad signal — a page's most common colour is usually its
body text, but its most *important* colour usually isn't. So roles come from
element context:

| Token | Derived from |
|---|---|
| `--text-color` | colour weighted by each node's `own_text` length |
| `--link-color` | dominant colour on `<a>` elements specifically |
| `--link-hover-color` | parsed out of the source's own `a:hover` rule, not guessed |
| `--background-color` | the lightest large-area background surface |
| `--brand-N` | background surfaces ranked by how much page area they cover |
| `--heading-font-*` | dominant size/weight per `h1`–`h6` tag |
| `--content-max-width` | most common `max-width` ≥ 480px |
| breakpoints | `(min-width:)` / `(max-width:)` values parsed from matched `@media` rules |

Colours within ~14 RGB units are merged, so anti-aliasing and one-off shades
don't each become a token.

## Human gate — review the roles

Present `design-system.md` and ask about, at minimum:

1. **Close calls.** When the runner-up is within 25% of the winner, the script
   says so instead of quietly picking. These are the tokens most likely to be
   wrong, and a person can settle them in seconds.
2. **`--brand-N` names.** Positional by design. Renaming them to the
   organisation's vocabulary is a human decision, and it's much cheaper before
   blocks reference them than after.
3. **Body font size.** Legacy sites frequently sit below 16px. Reproducing
   that faithfully is a legitimate choice and so is modernising it — but it
   should be a stated choice, not a silent copy.
4. **Missing breakpoints.** If none were found, the source may use a CSS
   framework whose stylesheet was cross-origin and blocked. Check
   `meta.json`'s `blocked_stylesheets` before assuming the site is fixed-width.

## Applying it

Once approved, merge the reviewed `:root` block into `styles/styles.css`.
Preserve variables the boilerplate already defines and the repo relies on;
add rather than wholesale-replace, and keep the boilerplate's comment
groupings so the file stays readable.

Do not paste `--brand-N` names straight in — rename first.

## Handoff

`eds-block-authoring` reads these tokens and must reference them by variable
name. If a block needs a value that isn't in the token set, that's a signal
either the token set is incomplete or the value is genuinely block-local —
decide which, don't just inline a hex.
