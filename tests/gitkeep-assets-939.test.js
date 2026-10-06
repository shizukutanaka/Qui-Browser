// Round 939: the two .gitkeep files double as shipped README docs for their
// asset directories — their content must describe what is actually shipped,
// not a stale plan (a doc that says "no assets" next to shipped files, or an
// API/class-name that does not exist, lies to every reader).
const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'assets', 'images');
const SOUNDS_DIR = path.join(__dirname, '..', 'public', 'assets', 'sounds');
const imagesKeep = fs.readFileSync(path.join(IMAGES_DIR, '.gitkeep'), 'utf8');
const soundsKeep = fs.readFileSync(path.join(SOUNDS_DIR, '.gitkeep'), 'utf8');
const vrAppSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

describe('public/assets/images/.gitkeep describes the shipped assets', () => {
  test('names every real file in the directory (excluding .gitkeep)', () => {
    const shipped = fs.readdirSync(IMAGES_DIR).filter((f) => f !== '.gitkeep');
    expect(shipped.length).toBeGreaterThan(0);
    for (const name of shipped) {
      expect(imagesKeep).toContain(name);
    }
  });

  test('does not claim the directory is empty', () => {
    expect(imagesKeep).not.toMatch(/No assets currently in this directory/i);
    expect(imagesKeep).not.toMatch(/このディレクトリにはアセットがありません/);
  });

  test('every basename listed as "to be added" is not already shipped', () => {
    // The doc must not list an existing file as still-missing.
    const todoSection = imagesKeep.match(/to be added[\s\S]*/i);
    if (todoSection) {
      for (const m of todoSection[0].matchAll(/([\w-]+\.(?:png|svg|jpg|jpeg|ico|webp))/g)) {
        const exists =
          fs.existsSync(path.join(IMAGES_DIR, m[1])) ||
          fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'icons', m[1]));
        expect(exists).toBe(false);
      }
    }
  });
});

describe('public/assets/sounds/.gitkeep describes the real audio pipeline', () => {
  test('names the real SpatialAudio class, not a phantom one', () => {
    expect(soundsKeep).not.toContain('VRSpatialAudio');
    expect(soundsKeep).toContain('SpatialAudio');
  });

  test('shows the real play() API, not a phantom playSound()', () => {
    expect(soundsKeep).not.toMatch(/playSound\(/);
    expect(soundsKeep).toMatch(/\.play\(/);
  });

  test('does not claim more loaded sound names than VRApp actually loads', () => {
    // Names VRApp.loadAudioAssets() fetches.
    const loaded = [...vrAppSrc.matchAll(/url: '\/assets\/sounds\/([\w-]+)\.mp3'/g)].map((m) => m[1]);
    expect(loaded.length).toBeGreaterThan(0);
    // The doc must not present an unloaded name as a required/current file.
    const phantom = ['navigate', 'notification', 'open', 'close', 'select', 'ambient'];
    for (const name of phantom) {
      if (!loaded.includes(name)) {
        expect(soundsKeep).not.toMatch(new RegExp(`\\b${name}\\.mp3\\b`));
      }
    }
  });

  test('documents every name VRApp loads', () => {
    const loaded = [...vrAppSrc.matchAll(/url: '\/assets\/sounds\/([\w-]+)\.mp3'/g)].map((m) => m[1]);
    for (const name of loaded) {
      expect(soundsKeep).toContain(`${name}.mp3`);
    }
  });
});
