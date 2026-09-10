# Design system — derived from source

Pages analysed: agentbrokers-transamerica, home, policyholders
Generated: 2026-09-10T17:04:59.848Z

## Colour roles

| Role | Value | Basis |
|---|---|---|
| background | #ffffff | largest light surface |
| text | #666666 | most text weight on leaf nodes |
| link | #00447c | dominant `<a>` colour |
| link hover | #0056b3 | from the source `a:hover` rule |
| brand-1 | #b2b2b2 | background surface by page area |
| brand-2 | #00457c | background surface by page area |
| brand-3 | rgb(255 255 255 / 0.2) | background surface by page area |

## Type

- Body: **helvetica, arial, sans-serif** at 12px / 18px
- Heading: **georgia, times, serif**

| Tag | Size | Weight | Line height |
|---|---|---|---|
| h2 | 24px | 400 | 30px |

Observed text sizes: 11, 12, 13, 16, 24px

## Layout

- Container: 965px
- Gutter: not detected
- Header height: 172px
- Source breakpoints: 576px, 767px, 768px, 991px, 992px

## Spacing scale

- 7px (12 uses)
- 12px (3 uses)
- 16px (2 uses)
- 20px (2 uses)
- 25px (4 uses)
- 30px (2 uses)

## Close calls — decide these yourself

- **text**: chose `#666666` over `#999999` by only 16%. Both are genuinely in use — pick the one the design intends, not the one that happened to win on volume.
- **link**: chose `#00447c` over `#ffffff` by only 3%. Both are genuinely in use — pick the one the design intends, not the one that happened to win on volume.

## Review before adopting

1. `--brand-N` names are positional. Rename to the organisation's own names.
2. Check the body size against accessibility norms — legacy sites often sit
   below 16px, and faithfully copying that is a decision, not a default.
3. Colours within ~14 RGB units were merged; `design-system.json` lists what
   was folded into each role.
