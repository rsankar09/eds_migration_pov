import { decorateCta, moveInstrumentation, replaceWithOptimizedPicture } from '../../scripts/scripts.js';

/**
 * loads and decorates the block
 *
 * A container: one row per card, each row an image cell followed by a copy
 * cell. That shape is the same on both authoring surfaces — the editor makes
 * each child item a row and its field groups the cells — so items are read
 * from `block.children` and cells are classified by content, never position.
 *
 * The track scrolls horizontally when the cards overflow it, which is the
 * source's behaviour at mobile; at desktop the same cards simply fit and it
 * reads as a static grid. That is CSS overflow, not a JS carousel: the source
 * ships no arrows, dots or slide controls, so adding them would invent an
 * interaction the design does not have.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const ul = document.createElement('ul');

  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    li.className = 'carousel-card';

    [...row.children].forEach((cell) => {
      if (cell.querySelector('picture, img')) {
        cell.className = 'carousel-card-image';
        li.append(cell);
      } else if (cell.textContent.trim() || cell.childElementCount) {
        cell.className = 'carousel-card-body';
        decorateCta(cell, 'link');
        li.append(cell);
      }
    });

    if (li.childElementCount) ul.append(li);
  });

  ul.querySelectorAll('picture > img').forEach((img) => replaceWithOptimizedPicture(img, [{ width: '750' }]));
  block.replaceChildren(ul);
}
