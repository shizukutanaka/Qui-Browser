/**
 * _requestVRKeyboardInput's desktop fallback must honour the `prompt` argument.
 *
 * Callers pass localized labels (vr.prompt.proxyUrl / vr.prompt.videoUrl) and
 * the parameter's own default is t('vr.prompt.url'). Hard-coding 'Enter URL'
 * inside the window.prompt branch drops both the caller's label and the active
 * language — a Japanese desktop session would see English, and proxy/video
 * prompts would be mislabeled (WCAG 3.1.2).
 */

jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

global.document = { documentElement: { lang: 'en' } };

const { readFileSync } = require('fs');
const { join } = require('path');
const { setLanguage, t } = require('../src/i18n/i18n.js');
const { VRApp } = require('../src/vr/VRApp.js');

const src = readFileSync(join(__dirname, '../src/vr/VRApp.js'), 'utf8');

describe('VRApp._requestVRKeyboardInput — window.prompt fallback', () => {
  beforeEach(() => {
    global.window = { prompt: jest.fn(() => 'https://example.com') };
  });
  afterEach(() => {
    delete global.window;
    setLanguage('en');
  });

  test('default prompt is localized for the fallback too', () => {
    setLanguage('ja');
    const onConfirm = jest.fn();
    VRApp.prototype._requestVRKeyboardInput.call({ vrKeyboard: undefined }, 'https://', onConfirm);
    expect(global.window.prompt).toHaveBeenCalledWith(t('vr.prompt.url'), 'https://');
    expect(onConfirm).toHaveBeenCalledWith('https://example.com');
  });

  test('a caller-supplied prompt reaches window.prompt unchanged', () => {
    const onConfirm = jest.fn();
    VRApp.prototype._requestVRKeyboardInput.call({ vrKeyboard: undefined }, 'http://', onConfirm, 'Enter video URL');
    expect(global.window.prompt).toHaveBeenCalledWith('Enter video URL', 'http://');
  });

  test('a falsy prompt() return does not fire onConfirm', () => {
    global.window.prompt.mockReturnValue(null);
    const onConfirm = jest.fn();
    VRApp.prototype._requestVRKeyboardInput.call({ vrKeyboard: undefined }, 'https://', onConfirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('no raw English literal remains in the fallback call', () => {
    expect(src).not.toContain("window.prompt('Enter URL'");
  });
});
