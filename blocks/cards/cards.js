import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Promotes the card's first link so it covers the whole card, matching the
 * source design where the entire tile is one click target. The original inline
 * anchor is unwrapped so its text is not nested inside a second anchor.
 * @param {Element} li the card element
 */
function linkWholeCard(li) {
  const link = li.querySelector('a[href]');
  if (!link) return;

  const wrapper = document.createElement('a');
  wrapper.className = 'cards-card-link';
  wrapper.href = link.getAttribute('href');
  if (link.title) wrapper.title = link.title;

  // unwrap the inline anchor, keeping its text where the author put it
  link.replaceWith(...link.childNodes);

  while (li.firstChild) wrapper.append(li.firstChild);
  li.append(wrapper);
}

export default function decorate(block) {
  /* change to ul, li */
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);
    [...li.children].forEach((div) => {
      if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
      else div.className = 'cards-card-body';
    });
    ul.append(li);
  });
  ul.querySelectorAll('picture > img').forEach((img) => {
    const optimizedPic = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimizedPic.querySelector('img'));
    img.closest('picture').replaceWith(optimizedPic);
  });
  if (block.classList.contains('insights')) {
    [...ul.children].forEach(linkWholeCard);
  }
  block.replaceChildren(ul);
}
