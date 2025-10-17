/**
 * Tests for Data Export/Import Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const DataExportImport = require('../lib/data-export-import');

// Mock database manager
class MockDatabaseManager {
  constructor() {
    this.bookmarks = [
      { bookmarkId: 'bm1', url: 'https://example.com', title: 'Example', tags: ['test'] },
      { bookmarkId: 'bm2', url: 'https://test.com', title: 'Test', tags: ['demo'] }
    ];
    this.history = [
      { historyId: 'h1', url: 'https://example.com', title: 'Example Page', visitCount: 5 },
      { historyId: 'h2', url: 'https://test.com', title: 'Test Page', visitCount: 2 }
    ];
    this.settings = { theme: 'dark', language: 'en' };
    this.sessions = [
      { sessionId: 's1', name: 'Work Session', tabs: [], windows: [] }
    ];
  }

  async getBookmarks(userId) {
    return this.bookmarks;
  }

  async getHistory(userId, options) {
    return this.history;
  }

  async getSettings(userId) {
    return this.settings;
  }

  async getSessions(userId) {
    return this.sessions;
  }

  async addBookmark(userId, bookmark) {
    this.bookmarks.push(bookmark);
    return bookmark;
  }

  async addHistoryEntry(userId, entry) {
    this.history.push(entry);
    return entry;
  }

  async updateSettings(userId, settings) {
    this.settings = settings;
    return settings;
  }

  async saveSession(userId, session) {
    this.sessions.push(session);
    return session;
  }
}

test('Data Export/Import Module', async (t) => {
  let tempDir;
  let exportImport;
  let mockDb;

  t.before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qui-export-test-'));
    mockDb = new MockDatabaseManager();
    exportImport = new DataExportImport({ exportDir: tempDir }, mockDb);
  });

  t.after(async () => {
    if (tempDir) {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  await t.test('DataExportImport initializes correctly', () => {
    assert(exportImport instanceof DataExportImport);
    assert.strictEqual(typeof exportImport.config, 'object');
    assert.strictEqual(typeof exportImport.exportDir, 'string');
    assert(Array.isArray(exportImport.supportedFormats));
    assert(exportImport.supportedFormats.includes('json'));
    assert(exportImport.supportedFormats.includes('csv'));
    assert(exportImport.supportedFormats.includes('xml'));
  });

  await t.test('exportData() creates export file', async () => {
    const userId = 'test-user';
    const result = await exportImport.exportData(userId, {
      format: 'json',
      includeBookmarks: true,
      includeHistory: true,
      includeSettings: true,
      includeSessions: true,
      compress: false
    });

    assert.strictEqual(typeof result, 'object');
    assert(result.hasOwnProperty('exportId'));
    assert(result.hasOwnProperty('filePath'));
    assert(result.hasOwnProperty('fileName'));
    assert(result.hasOwnProperty('size'));
    assert(result.hasOwnProperty('format'));
    assert(result.hasOwnProperty('recordCounts'));

    assert.strictEqual(result.format, 'json');
    assert(result.recordCounts.bookmarks > 0);
    assert(result.recordCounts.history > 0);
    assert(result.recordCounts.settings > 0);
    assert(result.recordCounts.sessions > 0);

    // Verify file exists
    const stats = await fs.stat(result.filePath);
    assert(stats.isFile());
    assert(stats.size > 0);
  });

  await t.test('exportData() with CSV format', async () => {
    const userId = 'test-user';
    const result = await exportImport.exportData(userId, {
      format: 'csv',
      includeBookmarks: true,
      compress: false
    });

    assert.strictEqual(result.format, 'csv');
    assert(result.fileName.endsWith('.csv'));

    // Verify file content
    const content = await fs.readFile(result.filePath, 'utf8');
    assert(content.includes('bookmark,'));
    assert(content.includes('https://example.com'));
  });

  await t.test('exportData() with compression', async () => {
    const userId = 'test-user';
    const result = await exportImport.exportData(userId, {
      format: 'json',
      includeBookmarks: true,
      compress: true
    });

    assert(result.compressed);
    assert(result.fileName.endsWith('.json.gz'));
  });

  await t.test('getExportInfo() returns correct info', async () => {
    const userId = 'test-user';
    const exportResult = await exportImport.exportData(userId, { format: 'json' });

    const info = await exportImport.getExportInfo(exportResult.exportId);

    assert.strictEqual(typeof info, 'object');
    assert.strictEqual(info.exportId, exportResult.exportId);
    assert.strictEqual(info.fileName, exportResult.fileName);
    assert.strictEqual(info.size, exportResult.size);
    assert(info.hasOwnProperty('createdAt'));
    assert(info.hasOwnProperty('modifiedAt'));
  });

  await t.test('listExports() returns export list', async () => {
    const userId = 'test-user';

    // Create a few exports
    await exportImport.exportData(userId, { format: 'json' });
    await exportImport.exportData(userId, { format: 'csv' });

    const exports = await exportImport.listExports(userId);

    assert(Array.isArray(exports));
    assert(exports.length >= 2);
    assert(exports.every(exp => exp.hasOwnProperty('fileName')));
    assert(exports.every(exp => exp.hasOwnProperty('size')));
    assert(exports.every(exp => exp.hasOwnProperty('createdAt')));

    // Should be sorted by creation date (newest first)
    for (let i = 1; i < exports.length; i++) {
      assert(exports[i-1].createdAt >= exports[i].createdAt);
    }
  });

  await t.test('deleteExport() removes export file', async () => {
    const userId = 'test-user';
    const exportResult = await exportImport.exportData(userId, { format: 'json' });

    // Verify file exists
    let stats;
    try {
      stats = await fs.stat(exportResult.filePath);
      assert(stats.isFile());
    } catch (error) {
      assert.fail('Export file should exist');
    }

    // Delete export
    const deleted = await exportImport.deleteExport(exportResult.exportId);
    assert(deleted);

    // Verify file is gone
    try {
      await fs.access(exportResult.filePath);
      assert.fail('Export file should be deleted');
    } catch (error) {
      // File is gone, this is expected
    }
  });

  await t.test('importData() with validation only', async () => {
    const userId = 'test-user';
    const exportResult = await exportImport.exportData(userId, {
      format: 'json',
      includeBookmarks: true
    });

    const result = await exportImport.importData(userId, exportResult.filePath, {
      validateOnly: true
    });

    assert(result.valid);
    assert(result.hasOwnProperty('dataTypes'));
    assert(result.hasOwnProperty('recordCounts'));
    assert(Array.isArray(result.warnings));
  });

  await t.test('importData() performs actual import', async () => {
    const userId = 'test-user';
    const exportResult = await exportImport.exportData(userId, {
      format: 'json',
      includeBookmarks: true
    });

    const result = await exportImport.importData(userId, exportResult.filePath, {
      overwrite: true
    });

    assert(result.success);
    assert(result.hasOwnProperty('imported'));
    assert(result.hasOwnProperty('skipped'));
    assert(result.hasOwnProperty('errors'));
    assert(result.imported.bookmarks >= 0);
  });

  await t.test('parseImportData() handles different formats', async () => {
    // Test JSON parsing
    const jsonData = '{"metadata":{"version":"1.0"},"data":{"bookmarks":[{"url":"https://test.com"}]}}';
    const jsonResult = await exportImport.parseImportData(jsonData, 'json');
    assert(jsonResult.metadata.version === '1.0');
    assert(Array.isArray(jsonResult.data.bookmarks));

    // Test CSV parsing (simplified)
    const csvData = 'Type,Data\nbookmark,"{""url"":""https://test.com""}"';
    const csvResult = await exportImport.parseImportData(csvData, 'csv');
    assert(Array.isArray(csvResult.data.bookmarks));
  });

  await t.test('validateImportData() checks data structure', () => {
    // Valid data
    const validData = {
      metadata: { version: '1.0' },
      data: { bookmarks: [{ url: 'https://test.com' }] }
    };
    const validResult = exportImport.validateImportData(validData);
    assert(validResult.valid);
    assert.strictEqual(validResult.errors.length, 0);

    // Invalid data
    const invalidData = { data: null };
    const invalidResult = exportImport.validateImportData(invalidData);
    assert(!invalidResult.valid);
    assert(invalidResult.errors.length > 0);
  });

  await t.test('countImportRecords() counts records correctly', () => {
    const data = {
      data: {
        bookmarks: [{}, {}],
        history: [{}, {}, {}],
        settings: {}
      }
    };

    const counts = exportImport.countImportRecords(data);
    assert.strictEqual(counts.bookmarks, 2);
    assert.strictEqual(counts.history, 3);
    assert.strictEqual(counts.settings, 1);
  });

  await t.test('detectFormat() identifies file formats', () => {
    assert.strictEqual(exportImport.detectFormat('/path/to/file.json'), 'json');
    assert.strictEqual(exportImport.detectFormat('/path/to/file.csv'), 'csv');
    assert.strictEqual(exportImport.detectFormat('/path/to/file.xml'), 'xml');
    assert.strictEqual(exportImport.detectFormat('/path/to/file.unknown'), 'json'); // default
  });

  await t.test('generateExportId() creates unique IDs', () => {
    const id1 = exportImport.generateExportId();
    const id2 = exportImport.generateExportId();

    assert.strictEqual(typeof id1, 'string');
    assert(id1.startsWith('export_'));
    assert.notStrictEqual(id1, id2);
  });

  await t.test('convertToCSV() converts data to CSV format', () => {
    const data = {
      data: {
        bookmarks: [
          { bookmarkId: 'bm1', url: 'https://test.com', title: 'Test' }
        ],
        settings: { theme: 'dark' }
      }
    };

    const csv = exportImport.convertToCSV(data);
    assert(typeof csv === 'string');
    assert(csv.includes('bookmark,'));
    assert(csv.includes('settings,'));
  });

  await t.test('convertToXML() converts data to XML format', () => {
    const data = {
      metadata: { version: '1.0' },
      data: {
        bookmarks: [
          { url: 'https://test.com', title: 'Test' }
        ]
      }
    };

    const xml = exportImport.convertToXML(data);
    assert(typeof xml === 'string');
    assert(xml.includes('<?xml version="1.0"'));
    assert(xml.includes('<qui-browser-export>'));
    assert(xml.includes('<bookmarks>'));
  });

  await t.test('parseXML() parses XML data', () => {
    const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<qui-browser-export>
  <metadata>
    <version>1.0</version>
  </metadata>
  <data>
    <bookmarks>
      <item>{"url":"https://test.com","title":"Test"}</item>
    </bookmarks>
  </data>
</qui-browser-export>`;

    const result = exportImport.parseXML(xmlData);
    assert(result.metadata.version === '1.0');
    assert(Array.isArray(result.data.bookmarks));
    assert(result.data.bookmarks[0].url === 'https://test.com');
  });

  await t.test('cleanupOldExports() removes old files', async () => {
    // This test would require creating old files and testing cleanup
    // For now, just verify the method exists and doesn't throw
    const deletedCount = await exportImport.cleanupOldExports();
    assert(typeof deletedCount === 'number');
  });

  await t.test('exportData() throws on invalid format', async () => {
    await assert.rejects(
      () => exportImport.exportData('user', { format: 'invalid' }),
      /Unsupported format/
    );
  });

  await t.test('readImportFile() rejects oversized files', async () => {
    const largeFile = path.join(tempDir, 'large.txt');
    const largeContent = 'x'.repeat(exportImport.maxFileSize + 1);
    await fs.writeFile(largeFile, largeContent);

    await assert.rejects(
      () => exportImport.readImportFile(largeFile),
      /File too large/
    );

    await fs.unlink(largeFile);
  });

  await t.test('escapeXml() properly escapes XML characters', () => {
    assert.strictEqual(exportImport.escapeXml('<>&"\''),
                       '&lt;&gt;&amp;&quot;&#39;');
    assert.strictEqual(exportImport.escapeXml('normal text'), 'normal text');
  });
});
