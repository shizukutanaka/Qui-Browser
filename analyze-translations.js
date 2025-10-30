const fs = require('fs');
const path = require('path');

// 英語ファイルを基準として使用
const enFilePath = path.join(__dirname, 'locales', 'en.json');
const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf8'));

// 英語ファイルのトップレベルセクションを取得
const enSections = Object.keys(enData).filter(key => key !== 'meta');

// すべての言語ファイルのパスを取得
const localesDir = path.join(__dirname, 'locales');
const languageFiles = fs.readdirSync(localesDir)
  .filter(file => file.endsWith('.json'))
  .map(file => ({
    code: path.basename(file, '.json'),
    path: path.join(localesDir, file)
  }));

console.log('=== 翻訳完全性評価レポート ===\n');
console.log(`基準言語 (English): ${enSections.length} セクション`);
console.log(`セクション一覧: ${enSections.join(', ')}\n`);

// 各言語ファイルの分析
languageFiles.forEach(({ code, path: filePath }) => {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const sections = Object.keys(data).filter(key => key !== 'meta');
    const missingSections = enSections.filter(section => !sections.includes(section));

    console.log(`言語: ${code}`);
    console.log(`  セクション数: ${sections.length}/${enSections.length}`);
    console.log(`  ファイルサイズ: ${fs.statSync(filePath).size} bytes`);

    if (missingSections.length > 0) {
      console.log(`  ❌ 欠如セクション: ${missingSections.join(', ')}`);
    } else {
      console.log(`  ✅ すべてのセクションが含まれています`);
    }

    // 英語にない追加セクション
    const extraSections = sections.filter(section => !enSections.includes(section));
    if (extraSections.length > 0) {
      console.log(`  ➕ 追加セクション: ${extraSections.join(', ')}`);
    }

    console.log('');
  } catch (error) {
    console.error(`言語 ${code} の解析エラー: ${error.message}`);
  }
});

// ファイルサイズ順でソートした統計
console.log('\n=== ファイルサイズ統計 ===');
const stats = languageFiles.map(({ code, path: filePath }) => ({
  code,
  size: fs.statSync(filePath).size
})).sort((a, b) => b.size - a.size);

stats.forEach(({ code, size }) => {
  console.log(`${code}: ${size} bytes`);
});

console.log('\n=== 改善提案 ===');
const incompleteLanguages = stats.filter(s => s.size < 5000).map(s => s.code);
if (incompleteLanguages.length > 0) {
  console.log(`不完全な翻訳 (5KB未満): ${incompleteLanguages.join(', ')}`);
  console.log('これらの言語には主要なセクションが欠如しています。');
}
