import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * loads and decorates the block
 *
 * Authoring contract: one row per paragraph of fine print. Each row's content
 * is flattened into a single styled paragraph so footnote markers and inline
 * links keep working.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const notes = [...block.children].map((row) => {
    const note = document.createElement('div');
    note.className = 'disclaimer-note';
    moveInstrumentation(row, note);
    // rows wrap their content in cell divs; lift the paragraphs out of them
    [...row.children].forEach((cell) => {
      while (cell.firstElementChild) note.append(cell.firstElementChild);
    });
    return note;
  });

  block.replaceChildren(...notes);
}
