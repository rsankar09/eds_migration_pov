import { createOptimizedPicture } from '../../scripts/aem.js';
import { decorateCta, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the block
 *
 * Expects one row of two cells — image, then copy. Either may be empty: with
 * no image the copy pane spans the full band, and with no copy the image
 * stands alone. The band background is a section style, not a block variant
 * (see capture/credit-union/content-model.md decision D-A).
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  // the author-facing default is image-right; apply it when no variant is set
  if (!block.classList.contains('image-left')) block.classList.add('image-right');

  const row = block.firstElementChild;
  if (!row) return;

  [...row.children].forEach((cell) => {
    if (cell.querySelector('picture, img')) {
      cell.classList.add('feature-image');
    } else if (cell.textContent.trim() || cell.childElementCount) {
      cell.classList.add('feature-copy');
    } else {
      // an unauthored image slot would otherwise hold open half the band
      cell.remove();
    }
  });

  if (!row.querySelector('.feature-image')) block.classList.add('feature-no-image');

  decorateCta(row.querySelector('.feature-copy'));

  row.querySelectorAll('picture > img').forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });
}
