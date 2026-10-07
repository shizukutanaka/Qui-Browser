// Invariant: a JSDoc block must document the method that immediately follows
// it — an orphaned doc block misattributes the signature of whatever it sits
// on (defect class: doc-to-code honesty).
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, '..', 'src/vr/browser/WebPanel.js'), 'utf8');
const lines = SRC.split('\n');

// Index of the first code-ish line after a JSDoc `*/` closer.
function nextCodeLine(fromIdx) {
  for (let i = fromIdx; i < lines.length; i++) {
    const s = lines[i].trim();
    if (s === '' || s.startsWith('//')) continue;
    return s;
  }
  return null;
}

function jsdocBlocks() {
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('/**')) {
      let end = i;
      while (end < lines.length && !lines[end].includes('*/')) end++;
      blocks.push({ start: i, end, text: lines.slice(i, end + 1).join('\n') });
      i = end;
    }
  }
  return blocks;
}

describe('WebPanel JSDoc attachment', () => {
  it('the curve-toggle JSDoc documents setCurved', () => {
    const block = jsdocBlocks().find((b) => b.text.includes('flat plane and a concave curved'));
    expect(block).toBeDefined();
    expect(nextCodeLine(block.end + 1)).toMatch(/^setCurved\(/);
  });

  it('setSearchEngine is not shadowed by the curve-toggle JSDoc', () => {
    const block = jsdocBlocks().find((b) => b.text.includes('@param {boolean} value'));
    expect(block).toBeDefined();
    expect(nextCodeLine(block.end + 1)).not.toMatch(/^setSearchEngine\(/);
  });
});
