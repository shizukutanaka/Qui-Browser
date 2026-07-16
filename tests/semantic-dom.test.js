/**
 * Unit tests for SemanticDOM — the hidden ARIA-live overlay that mirrors VR
 * captions/toasts/settings state for 2D and assistive-technology consumers
 * (Phase 2 roadmap item). A minimal DOM is stubbed so the tests run headless
 * under Jest's node test environment.
 */

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.attributes = {};
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name]; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    child.parentNode = null;
    return child;
  }
}

function makeFakeDocument() {
  return {
    body: new FakeElement('body'),
    createElement: (tag) => new FakeElement(tag)
  };
}

describe('SemanticDOM', () => {
  let realDocument;
  beforeEach(() => {
    realDocument = global.document;
    global.document = makeFakeDocument();
  });
  afterEach(() => {
    global.document = realDocument;
  });

  const { SemanticDOM } = require('../src/vr/accessibility/SemanticDOM.js');

  test('attaches a hidden container to document.body by default', () => {
    const dom = new SemanticDOM();
    expect(document.body.children).toContain(dom.container);
    // Visually hidden but not display:none (which would also hide it from AT).
    expect(dom.container.style.cssText).toMatch(/clip:rect\(0,0,0,0\)/);
    expect(dom.container.style.cssText).not.toMatch(/display:\s*none/);
  });

  test('attaches to a custom root when provided', () => {
    const customRoot = new FakeElement('main');
    const dom = new SemanticDOM({ root: customRoot });
    expect(customRoot.children).toContain(dom.container);
    expect(document.body.children).not.toContain(dom.container);
  });

  test('creates a polite status region for captions', () => {
    const dom = new SemanticDOM();
    expect(dom.captionRegion.getAttribute('role')).toBe('status');
    expect(dom.captionRegion.getAttribute('aria-live')).toBe('polite');
  });

  test('creates an assertive alert region for toasts', () => {
    const dom = new SemanticDOM();
    expect(dom.alertRegion.getAttribute('role')).toBe('alert');
    expect(dom.alertRegion.getAttribute('aria-live')).toBe('assertive');
  });

  test('creates a settings region defaulting to aria-expanded=false', () => {
    const dom = new SemanticDOM();
    expect(dom.settingsRegion.getAttribute('role')).toBe('region');
    expect(dom.settingsRegion.getAttribute('aria-expanded')).toBe('false');
  });

  test('announceCaption() sets the caption region text', () => {
    const dom = new SemanticDOM();
    dom.announceCaption('Tab closed');
    expect(dom.captionRegion.textContent).toBe('Tab closed');
  });

  test('announceCaption() ignores empty text (no-op, not a cleared region)', () => {
    const dom = new SemanticDOM();
    dom.announceCaption('first');
    dom.announceCaption('');
    expect(dom.captionRegion.textContent).toBe('first');
  });

  test('announceAlert() sets the alert region text', () => {
    const dom = new SemanticDOM();
    dom.announceAlert('✕ Foveation unavailable');
    expect(dom.alertRegion.textContent).toBe('✕ Foveation unavailable');
  });

  test('setSettingsExpanded(true/false) toggles aria-expanded', () => {
    const dom = new SemanticDOM();
    dom.setSettingsExpanded(true);
    expect(dom.settingsRegion.getAttribute('aria-expanded')).toBe('true');
    dom.setSettingsExpanded(false);
    expect(dom.settingsRegion.getAttribute('aria-expanded')).toBe('false');
  });

  test('setSettingsExpanded() coerces truthy/falsy values', () => {
    const dom = new SemanticDOM();
    dom.setSettingsExpanded(1);
    expect(dom.settingsRegion.getAttribute('aria-expanded')).toBe('true');
    dom.setSettingsExpanded(0);
    expect(dom.settingsRegion.getAttribute('aria-expanded')).toBe('false');
  });

  test('dispose() detaches the container from its parent', () => {
    const dom = new SemanticDOM();
    const container = dom.container;
    dom.dispose();
    expect(document.body.children).not.toContain(container);
    expect(dom.container).toBeNull();
  });

  test('dispose() is safe to call twice', () => {
    const dom = new SemanticDOM();
    dom.dispose();
    expect(() => dom.dispose()).not.toThrow();
  });

  test('methods no-op after dispose() instead of throwing', () => {
    const dom = new SemanticDOM();
    dom.dispose();
    expect(() => dom.announceCaption('late')).not.toThrow();
    expect(() => dom.announceAlert('late')).not.toThrow();
    expect(() => dom.setSettingsExpanded(true)).not.toThrow();
  });

  test('does not throw when document is unavailable (SSR / headless)', () => {
    global.document = undefined;
    expect(() => {
      const dom = new SemanticDOM();
      dom.announceCaption('x');
      dom.announceAlert('y');
      dom.setSettingsExpanded(true);
      dom.dispose();
    }).not.toThrow();
  });

  test('constructing without a document.body still does not throw', () => {
    global.document = { createElement: (tag) => new FakeElement(tag) }; // no body
    expect(() => new SemanticDOM()).not.toThrow();
  });
});
