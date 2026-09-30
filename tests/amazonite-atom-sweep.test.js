// Amazonite sweep — pass CCXCV
// EN finance/ledger/foreclosure idioms + JA 勘定締め/差押え/破産 chains
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVc() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 't', url: 'u' }),
    closeTab: () => {},
    tabs: [{ title: 't' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('amazonite atom sweep (pass CCXCV)', () => {
  const vc = makeVc();

  // ---- EN finance/ledger idioms -> close-tab ----
  const closeTab = [
    // ledger/books
    'balance the books', 'settle the books', 'close the books', 'the books are closed',
    'lock the ledger', 'close the ledger', 'the ledger is closed', 'end of the ledger',
    'the final ledger', 'reconcile the books', 'reconcile the accounts', 'square the ledger',
    'square the books', 'even the ledger', 'ledger balanced', 'books balanced',
    'the numbers add up', 'the tally is done', 'final tally', 'the count is done', 'count done',
    // accounts/settlement
    'final accounting', 'final settlement', 'close the account', 'shut the account',
    'the account is settled', 'statement closed', 'settle the tab', 'settle my tab',
    'settle up', 'settle the score', 'paid in full', 'debt forgiven', 'cancel the debt',
    'write off the debt', 'write it off as a loss', 'loss declared', 'cut losses',
    'cut my losses', 'stop loss', 'break even', 'retire the debt', 'forgive the loan',
    'loan forgiven', 'the bill is due', 'pay the piper', 'collect payment', 'payment due',
    'past due', 'the mortgage is due', 'the rent is due', 'rent collected',
    // foreclosure/seizure
    'foreclose on this tab', 'repo this tab', 'garnish it', 'levy a lien',
    'slap a lien on it', 'seize the assets', 'liquidate this tab',
    // bankruptcy/business-end
    'declare bankruptcy', 'insolvent', 'chapter eleven', 'chapter 11',
    'file for chapter 11', 'file for bankruptcy', 'receivership', 'the receiver is here',
    'default on it', 'default declared', 'shut the business down', 'shut the plant down',
    'wind up the company', 'dissolve the company', 'going out of business now',
    'out of business', 'fire sale', 'closeout sale', 'liquidation sale',
    'shut the warehouse', 'inventory done', 'final inventory', 'stocktaking done',
    // market/trading close
    'close of business', 'end of trading', 'the market closed', 'trading day done',
    'bell rang', 'closing bell', 'final bell', 'market close', 'the exchange is closed',
    'floor is closed', 'closing price set',
    // vault/register/transaction end
    'the vault is closed', 'lock the vault', 'cash out the register', 'close the register',
    'empty the register', 'night deposit', 'the bank is closed', 'close the bank',
    'transfer it all', 'final transfer', 'last transaction', 'transaction complete',
    'the drawer is balanced', 'register balanced',
    // misc closure frames
    'audit it', 'audit this tab', 'the auditors are here', 'the accountants are here',
    'tax time', 'checkout time', 'check out now', 'end of fiscal year', 'fiscal year end',
    'year end close', 'auction it off', 'auction the tab', 'sell it off',
  ];
  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });

  // ---- JA 勘定締め/差押え/破産 chains -> close-tab ----
  const closeTabJa = [
    // 帳簿/勘定/決算
    '勘定を締めて', '帳を締めて', '帳面を締めて', '帳簿を閉じて', '帳簿を閉める',
    '帳尻を合わせて', '決算だ', '決算をして', '精算して', 'お勘定を',
    '勘定を払って', '支払いを済ませて', '勘定済み', '払い済み', '借りを返して',
    '借金を返して', '債務を整理して', '締め日だ', '締めの時間', '監査して',
    '監査だ', '会計を締めて', '年度末だ', '期末だ', '月末締め', '在庫を締めて',
    '棚卸しだ', '棚卸して', '金庫を閉めて', '金庫をロック', '出納を締めて',
    'レジを締めて', 'レジ締め', '精算レジ', '売上を締めて',
    // 差押え/破産/倒産
    '差押え命令', '財産を差し押さえて', '資産を差し押さえて', '抵当に入れて',
    '抵当流れ', '質に入れて', '質流れ', '没収して', '破産して', '自己破産',
    '倒産して', '倒産宣告', '破たん', '経営破綻', '再建不能', '清算人',
    '管財人', '閉店清算',
    // 畳む/廃業
    '会社を畳んで', '店を畳んで', '商売を畳んで', '廃業して', '閉業して',
    '畳み込んで', '店じまい',
    // 競売/回収/督促
    '競売にかけて', '競売だ', '売り払って', '現金化して', '換金して',
    '処分して換金', '取り立てて', '取立てだ', '催促状', '督促状', '支払期限',
    '期限切れだ', '債権回収', '回収して',
    // 市場/取引終了
    '取引終了', '市場閉場', '取引所が閉まる', '引けだ', '引け値', '終値で確定',
    '大引け', '場が終わる', '持ち株を売って', '全額引き出して', '口座を閉じて',
    '口座凍結', '取引停止', '買収されて', '吸収合併',
    // 損失/財務悪化 declaratives
    '残高ゼロ', '赤字だ', '負債だらけ', '資金ショート', '倒れそう', '潰れそう',
    '貸し倒れ', '不良債権', '損切りして', '損失確定', '利確して',
    '塩漬けを処分', '評価損', '在庫一掃', '大処分市',
  ];
  test.each(closeTabJa)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });

  // ---- pins: misroutes fixed or kept ----
  test('"call in the debt" -> close-tab (was device-apps misroute)', () => {
    expect(key(vc, 'call in the debt')).toBe('close-tab');
  });
  test('"call in the loan" -> close-tab (was device-apps misroute)', () => {
    expect(key(vc, 'call in the loan')).toBe('close-tab');
  });
  test('"go bankrupt" -> close-tab (was go-to misroute)', () => {
    expect(key(vc, 'go bankrupt')).toBe('close-tab');
  });
  test('"going out of business" -> close-tab (was go-to misroute)', () => {
    expect(key(vc, 'going out of business')).toBe('close-tab');
  });
  test('"going concern no more" -> close-tab (was go-to misroute)', () => {
    expect(key(vc, 'going concern no more')).toBe('close-tab');
  });
  test('"seal the vault" -> close-tab (already green)', () => {
    expect(key(vc, 'seal the vault')).toBe('close-tab');
  });

  // ---- null pins: ambiguous / no disposal intent ----
  const pins = [
    ['check the balance', null],              // query intent, not disposal
    ['what is my balance', null],             // query
    ['audit the settings', null],             // object not a tab
    ['overdraft', null],                      // bare noun, no directive
  ];
  test.each(pins)('"%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
