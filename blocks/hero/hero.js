/**
 * loads and decorates the block
 *
 * Tags each pane as media or copy so the `panel` variant can set the aside
 * beside the image. The default hero is unaffected — the classes are additive
 * and the existing CSS selectors still match.
 *
 * A pane is a direct child of the block holding one cell, which is what the
 * `panel` variant needs: it is the flex container, so the panes have to be its
 * own children, and its `.hero-panel > div` padding expects the cell to still
 * be nested inside.
 *
 * Cells arrive in either arrangement. Universal Editor renders one row per
 * field group in the model — `image`/`imageAlt` first, then `text` — so each
 * cell already has its own row. Document authoring puts both cells in a single
 * row. A row holding one cell is therefore already a pane and is kept as-is,
 * unchanged; a row holding both is split so each cell gets one.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const panes = [];

  [...block.children].forEach((row) => {
    const cells = [...row.children];

    if (cells.length <= 1) {
      panes.push(row);
      return;
    }

    cells.forEach((cell) => {
      const pane = document.createElement('div');
      pane.append(cell);
      panes.push(pane);
    });
  });

  panes.forEach((pane) => {
    pane.classList.add(pane.querySelector('picture, img') ? 'hero-image' : 'hero-panel');
  });

  block.replaceChildren(...panes);
}
