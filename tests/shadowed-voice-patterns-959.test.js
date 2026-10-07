'use strict';
// Round 959: first-match dispatch means a pattern identical to one registered
// earlier can never fire — every duplicate slot is write-only surface left
// over from successive alias-pass merges.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function mk() {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [{ id: 't1', title: 'X', url: 'https://x' }],
    getActiveTab() {
      return this.tabs[0];
    },
    closeAllTabs() {
      return 1;
    }
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
}

describe('shadowed voice patterns', () => {
  const vc = mk();
  const literalOwner = new Map();
  const regexOwner = new Map();
  const literalDups = [];
  const regexDups = [];
  const intraDups = [];
  for (const [key, command] of vc.commands) {
    const seenInCommand = new Set();
    for (const pattern of command.patterns) {
      let id;
      let ownerMap;
      let dupList;
      if (typeof pattern === 'string') {
        id = pattern.toLowerCase();
        ownerMap = literalOwner;
        dupList = literalDups;
      } else if (pattern instanceof RegExp) {
        id = `${pattern.source}/${pattern.flags}`;
        ownerMap = regexOwner;
        dupList = regexDups;
      } else {
        continue;
      }
      if (seenInCommand.has(id)) {
        intraDups.push(`${key}: ${id}`);
      }
      seenInCommand.add(id);
      if (!ownerMap.has(id)) {
        ownerMap.set(id, key);
      } else if (ownerMap.get(id) !== key) {
        dupList.push(`'${id}': ${ownerMap.get(id)} (earlier) vs ${key} (unreachable)`);
      }
    }
  }

  it('every literal phrase is owned by exactly one command', () => {
    expect(literalDups).toEqual([]);
  });

  it('every regex is owned by exactly one command', () => {
    expect(regexDups).toEqual([]);
  });

  it('no command lists the same pattern twice', () => {
    expect(intraDups).toEqual([]);
  });
});
