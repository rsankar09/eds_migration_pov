/**
 * loads and decorates the block
 *
 * Tags each row as media or copy so the `card` variant can lift the copy into
 * an overlay panel. The default hero renders exactly as before — the classes
 * are additive and the existing CSS selectors are unaffected.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    if (row.querySelector('picture')) row.classList.add('hero-image');
    else row.classList.add('hero-content');
  });
}
