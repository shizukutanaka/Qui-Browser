const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

// pass CCLXXXIX: EN afterlife/hospice/funeral idioms + JA 門出/葬儀/追い出し
// frames → close-tab; 'go into the light' go-to misroute absorbed by literal.
function makeVc() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    tabs: [{ title: 'Example Page' }],
    closeTab: () => {},
  });
  return vc;
}
function route(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('morganite atom sweep — EN afterlife/hospice/funeral idioms', () => {
  const vc = makeVc();
  const cases = [
    'send it to heaven close it', 'sent to the farm', 'off to the farm',
    'put out to pasture', 'retire it to the country',
    'gone to a better place', 'it went to a better place',
    'peace be with it', 'rip for the tab', 'vigil for it',
    'hold a vigil', 'amen close it', 'extreme unction',
    'hospice for it', 'comfort care for it',
    'pull the plug on the patient', 'its flatlined', 'call the code',
    'no pulse for it', 'time of death for it', 'heavenward it goes',
    'send it home to heaven', 'send it upstairs close it',
    'up to heaven close it', 'fly away close it', 'fly away little tab',
    'off to heaven close it', 'meet your maker', 'meet its maker',
    'gone to meet its maker', 'has gone to meet its maker',
    'seeing angels', 'through the pearly gates', 'valhalla awaits',
    'into the great beyond', 'crossing over', 'it crossed over',
    'send it to the light', 'into the light', 'walk into the light',
    'follow the light', 'go into the light', 'a small step for it',
    'one small step', 'bodhisattva it', 'send it off in style',
    'pyre for it', 'funeral pyre close it', 'twenty one guns for it',
    '21 gun salute', 'taps for it', 'play taps', 'reveal the tomb',
    'lay it in state', 'lying in state', 'entomb the tab',
  ];
  test.each(cases)('%s → close-tab', (p) => {
    expect(route(vc, p)).toBe('close-tab');
  });
});

describe('morganite atom sweep — JA 門出/葬儀/追い出し frames', () => {
  const vc = makeVc();
  const cases = [
    '成仏して', '成仏しろや', '昇天させる', 'あの世行き', '冥土行き',
    '冥土に送る', '極楽送り', '天国に帰れ', '天国へ帰れ',
    '天国送りにする', '天国に送る',
    '門出だ', '門出とする', '門出にする',
    '葬式をあげて', '葬式を上げて', '葬儀にする', '告別式にする',
    '火葬にして', '火葬にする', '荼毘に付す', '荼毘に付して',
    '葬りにする', 'お通夜だ', 'お通夜にする', '通夜だ', '葬送だ',
    '弔いにする', '墓に入れ', '墓に送れ', '墓穴だ', '永眠だ',
    '眠りに就かせて', '眠らせて', '眠りなさい', '眠れ眠れ',
    'お眠りなさい', '安らかに眠って', '鎮まれ', '鎮まって',
    '追っ払え', '追っ払って', '出ていって', '明け渡せ', '明け渡して',
    '退去させて', '退去して', '退出して', '外に出せ',
  ];
  test.each(cases)('%s → close-tab', (p) => {
    expect(route(vc, p)).toBe('close-tab');
  });
});

describe('morganite atom sweep — established pins stay intact', () => {
  const vc = makeVc();
  const cases = [
    ['go to sleep', 'sleep-mode'],
    ['go to the store', 'go-to'],
    ['go to github', 'go-to'],
    ['成仏できない', 'negate'],
    ['眠ります', null],
    ['close it', 'close-tab'],
    ['畳んで', 'close-all-tabs'],
  ];
  test.each(cases)('%s → %s', (p, k) => {
    expect(route(vc, p)).toBe(k);
  });
});
