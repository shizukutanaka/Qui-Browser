/**
 * assignSettingsSections — the "what goes where" phase of the settings panel,
 * split out of VRApp.createSettingsPanel() so it runs without Three.js.
 */

const { assignSettingsSections } = require('../src/vr/ui/settingsLayout.js');

const toggle = (key) => [`L:${key}`, key, () => {}];
const action = (label) => [label, () => {}];

const pools = () => ({
  toggles: [toggle('a'), toggle('b'), toggle('c')],
  steppers: [toggle('s1'), toggle('s2')],
  cycles: [toggle('c1')],
  actions: [action('Act1'), action('Act2')]
});

const keys = (section, pool) => section[pool].map((e) => (pool === 'actions' ? e[0] : e[1]));

describe('assignSettingsSections', () => {
  test('places controls in spec order, per pool', () => {
    const out = assignSettingsSections(
      [
        { id: 'x', toggles: ['b', 'a'], steppers: ['s2'], cycles: ['c1'] },
        { id: 'y', toggles: ['c'], steppers: ['s1'], actions: ['Act2', 'Act1'] }
      ],
      pools()
    );
    expect(out.map((s) => s.id)).toEqual(['x', 'y']);
    expect(keys(out[0], 'toggles')).toEqual(['b', 'a']);
    expect(keys(out[0], 'steppers')).toEqual(['s2']);
    expect(keys(out[0], 'cycles')).toEqual(['c1']);
    expect(keys(out[0], 'actions')).toEqual([]);
    expect(keys(out[1], 'actions')).toEqual(['Act2', 'Act1']);
  });

  test('returns the original control tuples, not copies', () => {
    const p = pools();
    const [section] = assignSettingsSections([{ id: 'x', toggles: ['a'] }], p);
    expect(section.toggles[0]).toBe(p.toggles[0]);
  });

  test('a listed key with no control is skipped (e.g. bookmarks while the web panel is off)', () => {
    const out = assignSettingsSections(
      [
        {
          id: 'x',
          toggles: ['a', 'b', 'c'],
          steppers: ['s1', 's2'],
          cycles: ['c1'],
          actions: ['Act1', 'Missing', 'Act2']
        }
      ],
      pools()
    );
    expect(keys(out[0], 'actions')).toEqual(['Act1', 'Act2']);
    expect(out).toHaveLength(1);
  });

  test('unplaced controls land in a trailing leftover section instead of vanishing', () => {
    const out = assignSettingsSections([{ id: 'x', toggles: ['a'], actions: ['Act1'] }], pools());
    expect(out.map((s) => s.id)).toEqual(['x', 'settings.section.other']);
    const rest = out[1];
    expect(keys(rest, 'toggles')).toEqual(['b', 'c']);
    expect(keys(rest, 'steppers')).toEqual(['s1', 's2']);
    expect(keys(rest, 'cycles')).toEqual(['c1']);
    expect(keys(rest, 'actions')).toEqual(['Act2']);
  });

  test('no leftover section when everything is placed', () => {
    const out = assignSettingsSections(
      [{ id: 'x', toggles: ['a', 'b', 'c'], steppers: ['s1', 's2'], cycles: ['c1'], actions: ['Act1', 'Act2'] }],
      pools()
    );
    expect(out.map((s) => s.id)).toEqual(['x']);
  });

  test('a mistyped key does not count as placing the real control', () => {
    const out = assignSettingsSections([{ id: 'x', toggles: ['a', 'bb', 'c'] }], { toggles: pools().toggles });
    expect(keys(out[0], 'toggles')).toEqual(['a', 'c']);
    expect(keys(out[1], 'toggles')).toEqual(['b']);
  });

  test('tolerates missing pools and spec', () => {
    expect(assignSettingsSections(undefined, undefined)).toEqual([]);
    expect(assignSettingsSections([{ id: 'x' }], {})).toEqual([
      { id: 'x', toggles: [], steppers: [], cycles: [], actions: [] }
    ]);
  });
});
