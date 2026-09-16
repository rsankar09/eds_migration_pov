import { createOptimizedPicture } from '../../scripts/aem.js';
import { decorateCta, moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Publishes the image's own aspect ratio to the block as
 * `--feature-image-ratio`, so the stacked layout sizes the pane from the real
 * asset instead of a hardcoded crop.
 *
 * Preferred source is the width/height attributes, which the delivery pipeline
 * puts on every authored image and `createOptimizedPicture` then drops. Local
 * drafts and hand-written markup have no attributes, so those fall back to the
 * decoded image — one frame later, hence the attribute path first: reading the
 * attributes is synchronous and shifts nothing.
 *
 * @param {Element} block the block
 * @param {HTMLImageElement} img the image to measure
 */
function publishImageRatio(block, img) {
  const apply = (w, h) => {
    if (w > 0 && h > 0) block.style.setProperty('--feature-image-ratio', `${w} / ${h}`);
  };

  const width = Number(img.getAttribute('width'));
  const height = Number(img.getAttribute('height'));
  if (width && height) {
    apply(width, height);
    return;
  }

  if (img.complete && img.naturalWidth) {
    apply(img.naturalWidth, img.naturalHeight);
    return;
  }

  img.addEventListener('load', () => apply(img.naturalWidth, img.naturalHeight), { once: true });
}

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
    const optimizedImg = optimized.querySelector('img');

    // createOptimizedPicture copies only src and alt, so carry the intrinsic
    // dimensions across: without them the browser has no ratio to reserve
    // space with, which is what the removed hardcoded crop was standing in for
    ['width', 'height'].forEach((attr) => {
      const value = img.getAttribute(attr);
      if (value) optimizedImg.setAttribute(attr, value);
    });

    moveInstrumentation(img, optimizedImg);
    img.closest('picture').replaceWith(optimized);
    publishImageRatio(block, optimizedImg);
  });
}
