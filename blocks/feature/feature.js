import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the block
 *
 * Authoring contract: a single row with two cells — one holding the image,
 * the other the copy (heading, body/list, optional call-to-action link).
 * Either cell may come first; the media cell is detected, not assumed.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const row = block.firstElementChild;
  if (!row) return;

  [...row.children].forEach((cell) => {
    if (cell.querySelector('picture')) cell.classList.add('feature-media');
    else cell.classList.add('feature-content');
  });

  block.querySelectorAll('.feature-media img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });
}
