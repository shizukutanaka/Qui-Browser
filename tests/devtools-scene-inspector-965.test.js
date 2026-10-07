/**
 * Round 965: DevTools scene-tab "Object Properties" pane is unreachable.
 *
 * createSceneTab renders a two-column inspector — a "Scene Graph" tree on the
 * left and an "Object Properties" region on the right — and tree rows are
 * styled `cursor: pointer`, but no click handler is ever attached and nothing
 * writes into `#object-properties`. The declared inspector is a tree you can
 * look at but never inspect: the properties pane stays empty forever.
 */
const { DevTools } = require('../src/dev/DevTools.js');

// Minimal DOM stub for the node testEnvironment.
class El {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.style = {};
    this.textContent = '';
    this.onclick = null;
  }
  appendChild(c) {
    this.children.push(c);
    return c;
  }
  allText() {
    return this.textContent + this.children.map((c) => (c.allText ? c.allText() : c.textContent || '')).join('');
  }
}

const byId = new Map();
const makeDoc = () => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  createElement: (tag) => new El(tag),
  createTextNode: (t) => ({ textContent: t }),
  createDocumentFragment: () => new El('#fragment'),
  getElementById: (id) => byId.get(id) || null,
  body: new El('body')
});

const scene = {
  type: 'Mesh',
  name: 'panel-a',
  uuid: 'u-1',
  visible: true,
  position: { x: 1.5, y: 2.5, z: -3.0 },
  material: { type: 'MeshBasicMaterial' },
  children: [
    { type: 'Group', name: 'rows', uuid: 'u-2', visible: true, children: [] },
    { type: 'Mesh', name: 'hit-box', uuid: 'u-3', visible: false, children: [] }
  ]
};

let dt;

beforeEach(() => {
  byId.set('object-properties', new El('div'));
  global.document = makeDoc();
  dt = new DevTools({ scene });
});

afterEach(() => {
  delete global.document;
  byId.clear();
});

describe('DevTools scene inspector — click-to-inspect', () => {
  test('tree rows are clickable', () => {
    const frag = dt.buildSceneTree(scene, 0);
    expect(frag.children[0].onclick).toEqual(expect.any(Function));
  });

  test('clicking a tree row populates the object-properties pane', () => {
    const frag = dt.buildSceneTree(scene, 0);
    const row = frag.children[0];
    row.onclick();
    const pane = byId.get('object-properties').allText();
    expect(pane).toContain('panel-a');
    expect(pane).toContain('Mesh');
    expect(pane).toContain('u-1');
    expect(pane).toContain('MeshBasicMaterial');
    expect(pane).toContain('1.50, 2.50, -3.00');
  });

  test('clicking a child row shows that child, not the root', () => {
    const frag = dt.buildSceneTree(scene, 0);
    const childRow = frag.children[1].children[0];
    childRow.onclick();
    const pane = byId.get('object-properties').allText();
    expect(pane).toContain('rows');
    expect(pane).toContain('Group');
    expect(pane).not.toContain('panel-a');
  });
});
