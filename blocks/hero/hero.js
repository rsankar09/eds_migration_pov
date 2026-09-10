/**
 * loads and decorates the block
 *
 * Tags each row as media or copy so the `panel` variant can set the aside
 * beside the image. The default hero is unaffected — the classes are additive
 * and the existing CSS selectors still match.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    if (row.querySelector('picture, img')) row.classList.add('hero-image');
    else row.classList.add('hero-panel');
  });
}
