/**
 * Voice atoms CCCXIX — subscription/contract/license-end idioms (EN)
 * + 解約/退会/契約満了 (JA). Contract fulfilled = close the tab.
 * Active subscriptions, renewals, and signups stay out.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- cancelled subscriptions ---
  'cancel my subscription', 'subscription cancelled', 'subscription canceled',
  'cancelled the subscription', 'membership cancelled',
  'membership lapsed', 'membership ended', 'membership expired',
  'membership terminated', 'account closed', 'closed the account',
  'deactivated the account', 'opted out',
  'unsubscribed', 'unsubscribed from it', 'off the mailing list',
  'removed from the list', 'no longer subscribed',
  'free trial over', 'trial period ended', 'trial expired',
  'auto renew off', 'turned off auto renew', 'auto renewal cancelled',
  'billing stopped', 'last invoice paid', 'final bill settled',
  'refund issued', 'money refunded', 'charge reversed',
  // --- contract end ---
  'contract fulfilled', 'contract complete', 'contract ended',
  'contract expired', 'contract terminated', 'agreement ended',
  'agreement terminated', 'term of service ended', 'term expired',
  'lease ended', 'lease is up', 'lease expired', 'lease terminated',
  'moved out at lease end', 'notice period over', 'notice served',
  'final deliverable delivered', 'delivered the final deliverable',
  'client signed off', 'sign off received', 'signoff complete',
  'acceptance received', 'accepted by the client', 'handover done',
  'handover complete', 'transition done', 'maintenance period over',
  'warranty work done', 'defects liability period over',
  // --- license/warranty expiry ---
  'warranty expired', 'warranty void', 'out of warranty',
  'license revoked', 'license expired', 'license lapsed',
  'license surrendered', 'permit expired', 'certification lapsed',
  'registration expired', 'registration cancelled', 'bond expired',
  'policy lapsed', 'insurance lapsed', 'policy cancelled',
  'coverage ended', 'claim closed', 'case closed by the insurer',
  // --- fine print done ---
  'papers filed', 'paperwork done', 'fine print read',
  'contract signed sealed delivered', 'ink dry on the contract',
  'signature collected', 'notarized', 'seal affixed',
  'escrow closed', 'settlement done', 'closing done',
  'closing complete', 'keys exchanged', 'title transferred',
];

const closeTabJa = [
  // --- 解約/退会 ---
  '解約', '解約した', '解約して', '解約手続き', '解約完了',
  '退会', '退会した', '退会して', '退会手続き',
  '会員を退会して', '会員資格失効', '会員期限切れ',
  'アカウントを削除して', 'アカウント削除完了', '利用停止',
  '定期購読をやめて', '購読をやめて', '購読解除',
  'メルマガを解除して', '無料期間終了', 'トライアル終了',
  '自動更新を止めて', '自動更新オフ', '更新をやめて',
  '請求を止めて', '最終請求を払って', '返金処理完了',
  // --- 契約満了 ---
  '契約終了', '契約が終わって', '契約満了', '契約期間終了',
  '契約解除', '契約を解除して', '契約を破棄して', '破約',
  '中途解約', '解約金を払って', '違約金を払って',
  'リース終了', '賃貸契約終了', '賃貸契約満了',
  '引き渡し完了', '納品', '検収',
  '検収合格', '検収完了', '引き渡し終了', '保守契約終了',
  '瑕疵担保期間終了', '契約期間満了', '事業譲渡完了',
  // --- ライセンス/保証 ---
  'ライセンス失効', 'ライセンス期限切れ', '免許失効',
  '免許を返納して', '許可証失効', '認定失効', '資格失効',
  '登録抹消', '登録を抹消して', '保証期間切れ', '保証切れ',
  '保証期間終了', '保険失効', '保険解約', '補償終了',
  '手続き完了', '書類手続き終了', '捺印完了', '契印済み',
  '公正証書作成', 'エスクロー完了', '決済完了', '精算完了',
  '鍵の受け渡し', '名義変更完了', '譲渡完了',
];

const negate = [
  'keep the subscription', 'stay subscribed', 'keep the membership',
  'renew the lease', 'keep the contract going', 'stay under warranty',
  'まだ契約中', '契約を続けて', '購読を続けて',
];

const nullPins = [
  // active contract / renewal / signup
  'subscribe', 'subscribed', 'still subscribed', 'renewed',
  'renewal done', 'auto renew on', 'contract signed',
  'signed a new contract', 'lease signed', 'warranty active',
  'licensed', 'membership active', 'trial started',
  '契約中', '契約した', '契約更新', '更新した', '入会',
  '入会した', '会員登録', '購読中', '保証期間中',
];

const establishedPins = [
  ['cancel it', 'stop-everything'],
  ['納品完了', 'close-tab'],
  ['deleted my account', 'account'],
  ['off the list', 'close-tab'],
  ['退去して', 'close-tab'],
  ['明け渡して', 'close-tab'],
];

describe('Voice atoms CCCXIX — subscription/contract/license-end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
