// Voice atoms CCC: EN transport/journey-end idioms + JA 終点/終電/回送/着岸 chains (pass CCC)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    closeTab: () => {},
    tabs: [{ title: 'Example Page' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // --- end of the line / terminus ---
  'end of the road',
  'dead end ahead', 'last stop', 'this is the last stop', 'final stop',
  'terminus', 'the terminus', 'train terminates here',
  'this train terminates', 'terminal station', 'end station',
  'last station', 'final station', 'the station is the end',
  // --- disembark / get off ---
  'all change', 'all change please', 'everyone off', 'off the train',
  'time to disembark', 'disembark now', 'disembarked',
  'please exit the train', 'exit the vehicle', 'leave the vehicle',
  'get off here', 'getting off here', 'this is where we get off',
  'this is our stop', 'our stop', 'my stop',
  'drop me off', 'drop me here',
  // --- arrival / destination ---
  'we have arrived', 'we arrived', 'you have arrived',
  'made it home', 'home at last', 'home again',
  'pulling into the station', 'pulled into the station',
  'pull into the station', 'arriving at the station',
  'destination reached', 'reached our destination',
  'final destination', 'the home stretch', 'homestretch',
  // --- road end / parking ---
  'last exit', 'take the last exit', 'the off ramp', 'take the off ramp',
  'exit here', 'pull off the road', 'park it', 'park the car', 'parked',
  'into the driveway', 'into the garage', 'in the garage', 'garage it',
  'kickstand down', 'kickstands down',
  // --- maritime arrival ---
  'landfall', 'make landfall', 'we made landfall', 'into port',
  'pull into port', 'into harbour', 'into the harbor', 'come into port',
  'dock it', 'dock the ship', 'docked', 'moor it', 'moored',
  'tie it up at the dock', 'tie up at the pier', 'berth it',
  'drop anchor', 'anchor down', 'voyage over', 'the voyage is over',
  'cruise over', 'go ashore', 'shores at last',
  // --- aviation arrival ---
  'landed', 'land it', 'touch down', 'touched down', 'final approach',
  'on final approach', 'wheels down', 'on the tarmac', 'at the gate',
  'arrived at the gate', 'gate arrival', 'deplane', 'deplane now',
  'deboard', 'powered down', 'engine off', 'engines off',
  'shut down the engines', 'taxi to the hangar', 'to the hangar',
  'hangar it', 'chocks down', 'chocks on',
  // --- journey/ride over ---
  'journey over', 'the journey is over', 'end of the journey',
  'trip over', 'the trip is over', 'ride over', 'the ride is over',
  'excursion over', 'tour over', 'the tour is over', 'sightseeing done',
  'scenic route done', 'last leg', 'the last leg', 'final leg',
  'service ends here', 'line ends here', 'end of service',
  'service is over', 'service suspended', 'service discontinued',
  'out of service', 'not in service', 'deadhead', 'deadhead run',
  'deadheading', 'off duty', 'shift is done',
  // --- depot / yard ---
  'roll into the depot', 'to the depot', 'into the yard', 'yard it',
  'rail yard it', 'siding it', 'onto the siding', 'roundhouse it',
  'to the roundhouse', 'to the barn', 'into the barn',
];

const closeTabJa = [
  // --- 終点/終着 ---
  '終点', '終点です', '終点駅', '終着駅', '終点につきます',
  'まもなく終点', 'この電車は終点です', 'このバスは終点です',
  '終点なので降りて', '終点についた', '終点につきました',
  'ここが終点', 'この駅が終点', '終わりの駅', '最後の駅',
  // --- 終電/終バス/最終便 ---
  '終電', '終電です', '終電だ', '終電にして', '最終電車',
  '最終列車', '終バス', '最終バス', '最終便', '最終便です',
  'ラストラン', 'ラストランです',
  // --- 降車 ---
  '全員降車', '降車してください', 'お降りください', '降りてください',
  'ここで降りる', 'ここで降ります', 'お客様はお降りください',
  'バスを降りて', '降車ボタンを押して', '出口はあちらです',
  'お出口は左側です', 'ご乗車ありがとうございました',
  'ご利用ありがとうございました',
  // --- 到着 ---
  '到着しました', '到着です', '目的地に到着', '目的地です',
  'まもなく到着', '着きました', '着いた', '定刻到着',
  '到着口へ', '到着ロビーに向かって',
  // --- 運行終了/回送 ---
  '運行終了', '営業終了', '本日の運行は終了しました', '運転終了',
  '終運転', '回送', '回送です', '回送にして', '回送車両',
  '運休', '運休です', '運休にして', '折り返し運転にして',
  '乗務終了', '乗務を終えて', '運転を終えて',
  // --- 車庫/留置 ---
  '車庫に入れて', '車庫入れ', '車庫に戻して', '車両基地へ',
  '留置線へ', '留置線に入れて', '電車区に入れて', '車両センターへ',
  '検車区に入れて',
  // --- 船舶 ---
  '着岸', '着岸しました', '入港', '入港しました', '接岸',
  '接岸しました', '停泊して', '係留して', '錨を下ろして',
  '岸壁につけて', '波止場につけて', '岸に着けて', '桟橋につけて',
  '埠頭につけて', '投錨', '錨泊', '静泊', '帰港', '帰港して',
  '母港へ', '母港に帰って', '母港に戻して',
  // --- 航空 ---
  '着陸', '着陸しました', '着陸した', '最終着陸',
  'ゲートに着いて', 'ターミナルに着いて', '駐機場へ',
  '駐機場に入れて', 'エンジン停止', 'エンジンを止めて',
  'シートベルトサイン消灯', '格納庫へ', '格納庫に入れて',
  'パーキングに入れて', '駐車して', '駐車しました',
  // --- 旅/行程終了 ---
  '旅の終わり', '旅を終えて', '旅は終わった', '終旅',
  '帰還して', '帰還しました', '帰投', '凱旋', '凱旋して',
  '行程終了', '行程を終えて', '巡業終わり', '行脚終わり',
  '行き止まり', 'デッドエンド', '袋小路', '突き当たり',
];

const closeAllTabs = [
  'all lines terminate', 'all services ended', 'terminate all services',
  '全線運休', '全線終了', '全車両回送',
];

const negate = [
  'stay on the train', 'stay aboard', 'keep riding',
  'remain seated', '乗り続けて', 'まだ降りないで', '降りないで',
  '乗せたまま', 'まだ乗ってる',
];

const nullPins = [
  'drive on', 'full speed ahead', 'continue the journey',
  'through service', 'nonstop to the city', '始発はまだ',
  '走り続けて', '継続運転', '通過します', '折り返し乗車',
  '乗り継ぎ', '各駅停車', '準急', '快速に乗って',
];

describe('Voice atoms CCC — transport/journey-end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeAllTabs.map((p) => [p]))('"%s" -> close-all-tabs', (p) => {
    expect(key(makeVC(), p)).toBe('close-all-tabs');
  });
});

describe('negate pins (stay aboard / keep riding)', () => {
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
});

describe('established pins kept', () => {
  test.each([
    ['keep going', 'resume-reading'],
    ['keep it moving', 'resume-reading'],
    ['stay on it', 'resume-reading'],
    ['carry on', 'resume-reading'],
    ['pull the plug on it', 'close-tab'],
    ['end of the line', 'caret-edge'],
    ['this is the end of the line', 'caret-edge'],
    ['go to the store', 'go-to'],
    ['畳んで', 'close-all-tabs'],
  ])('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});

describe('null pins (journey continues, no disposal)', () => {
  test.each(nullPins.map((p) => [p]))('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
