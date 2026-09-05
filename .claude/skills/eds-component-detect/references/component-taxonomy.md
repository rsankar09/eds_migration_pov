# Component taxonomy and detection heuristics

Each type below: what it looks like structurally, and the cheapest signal
that flags it before a visual check is even needed.

| Type | Structural signal | Visual tell |
|---|---|---|
| hero | Large top-of-page section, single heading + short copy + image/video background, often full-viewport height | Big single "slide" feel, minimal repeated elements |
| card-grid | 3+ visually similar siblings, each with image + heading + short text | Grid/row of uniform rectangles |
| tabs | `role="tablist"` + `role="tabpanel"`, or JS class toggling `hidden`/`active` on siblings | Row of labels, one content panel visible at a time |
| accordion | Repeated `<details>`/`<button aria-expanded>` + collapsible sibling | Stacked rows that expand vertically on click |
| carousel/slider | class names containing `carousel`/`slider`/`swiper`, or `overflow-x: scroll` with flex row of slides | Horizontally arranged items, often with dot/arrow nav |
| testimonial | Card-like repeated block with quote text + person name/avatar | Quote marks, small avatar images |
| table | `<table>`, or CSS-grid mimicking rows/columns of data | Rows and columns of data, header row |
| form | `<form>`, or repeated `<input>`/`<label>` pairs | Input fields, submit button |
| nav | `<nav>`, or `<header>` with list of links | Horizontal or hamburger-triggered link list |
| footer | `<footer>` | Bottom-of-page multi-column links/legal text |
| cta-banner | Short section with heading + single prominent button, not full hero size | Colored strip with one clear action |
| other | Doesn't fit above | Describe in free text; flag `needs_review: true` |

## What does NOT count as a component

- A single `<img>` with or without a caption.
- A single heading + paragraph (even if styled distinctively).
- A pull-quote that isn't part of a repeating testimonial pattern.
- Decorative dividers/spacers.

These stay as plain content in the migrated markdown — EDS's default content
flow already handles them without a dedicated block.

## Confidence guidance

- Structural signal alone (semantic tag, ARIA role) → confidence ≥ 0.8,
  can skip the visual check.
- Class-name fragment match only (no semantic backing) → confidence ~0.5–0.7,
  do the visual check.
- No structural signal, layout-only inference (e.g. "looks like a grid") →
  confidence ≤ 0.5, always flag `needs_review: true`.
