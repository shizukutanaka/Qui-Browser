/**
 * Unit tests for AIRecommendation — pure JS logic, no DOM or Three.js required.
 * Covers: categorization, visit tracking, interaction tracking, weight updates,
 * getRecommendations, statistics, and dispose.
 */

const { AIRecommendation, isNavigableUrl } = require('../src/ai/AIRecommendation.js');

describe('AIRecommendation.categorizeContent', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('video/game text maps to entertainment', () => {
    expect(ai.categorizeContent('watch video game')).toBe('entertainment');
  });

  test('work document maps to productivity', () => {
    expect(ai.categorizeContent('work on document')).toBe('productivity');
  });

  test('learn course maps to education', () => {
    expect(ai.categorizeContent('learn new course tutorial')).toBe('education');
  });

  test('shop buy maps to shopping', () => {
    expect(ai.categorizeContent('shop and buy product')).toBe('shopping');
  });

  test('news article maps to news', () => {
    expect(ai.categorizeContent('latest news article')).toBe('news');
  });

  test('no-match text falls back to general', () => {
    expect(ai.categorizeContent('xyzzy plugh no match here')).toBe('general');
  });

  test('case-insensitive matching', () => {
    expect(ai.categorizeContent('LEARN TUTORIAL')).toBe('education');
  });
});

describe('AIRecommendation.trackVisit', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('adds visit to visitHistory', () => {
    ai.trackVisit('https://example.com', 'Example', 5000);
    expect(ai.userProfile.visitHistory).toHaveLength(1);
  });

  test('visit entry has url, title, duration, category, timestamp', () => {
    ai.trackVisit('https://example.com', 'Example Site', 3000);
    const v = ai.userProfile.visitHistory[0];
    expect(v.url).toBe('https://example.com');
    expect(v.title).toBe('Example Site');
    expect(v.duration).toBe(3000);
    expect(typeof v.category).toBe('string');
    expect(typeof v.timestamp).toBe('number');
  });

  test('accumulates multiple visits', () => {
    ai.trackVisit('https://a.com', 'A', 100);
    ai.trackVisit('https://b.com', 'B', 200);
    expect(ai.userProfile.visitHistory).toHaveLength(2);
  });

  test('caps visit history at 100 entries', () => {
    for (let i = 0; i < 120; i++) {
      ai.trackVisit(`https://site-${i}.com`, `Site ${i}`, 0);
    }
    expect(ai.userProfile.visitHistory.length).toBeLessThanOrEqual(100);
  });
});

describe('AIRecommendation.trackInteraction', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('stores interaction with type and data', () => {
    ai.trackInteraction('click', { target: 'btn-1' });
    expect(ai.userProfile.interactions).toHaveLength(1);
    expect(ai.userProfile.interactions[0].type).toBe('click');
    expect(ai.userProfile.interactions[0].data).toEqual({ target: 'btn-1' });
  });

  test('caps interactions at 200', () => {
    for (let i = 0; i < 250; i++) {
      ai.trackInteraction('scroll', { x: i });
    }
    expect(ai.userProfile.interactions.length).toBeLessThanOrEqual(200);
  });
});

describe('AIRecommendation.updateCategoryWeights', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('increases weight for the specified category', () => {
    const before = ai.categories.entertainment.weight;
    ai.updateCategoryWeights('entertainment', 60000); // 1-minute visit
    expect(ai.categories.entertainment.weight).toBeGreaterThan(before);
  });

  test('weights remain normalized (sum = number of categories)', () => {
    ai.updateCategoryWeights('education', 60000);
    const total = Object.values(ai.categories).reduce((s, c) => s + c.weight, 0);
    const count = Object.keys(ai.categories).length;
    expect(total).toBeCloseTo(count, 5);
  });

  test('ignores unknown categories safely', () => {
    expect(() => ai.updateCategoryWeights('bogus', 1000)).not.toThrow();
  });
});

describe('AIRecommendation.getRecommendations', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('returns an array', () => {
    expect(Array.isArray(ai.getRecommendations())).toBe(true);
  });

  test('respects the count limit', () => {
    // Seed some history so the engine has something to work with.
    for (let i = 0; i < 10; i++) {
      ai.trackVisit(`https://site-${i}.com`, `Site ${i}`, 1000);
    }
    ai.generateRecommendations();
    const recs = ai.getRecommendations(3);
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  test('never surfaces a placeholder (url: "#") recommendation', async () => {
    // Every built-in source (content-based, collaborative, trending,
    // contextual, time-based) currently generates simulated demo entries
    // with url: '#'. Presenting one of these to a real "Recommended for
    // you" UI would be a dead link masquerading as a suggestion.
    for (let i = 0; i < 5; i++) {
      ai.trackVisit(`https://real-site-${i}.com`, `Real Site ${i}`, 2000);
    }
    ai.userProfile.currentContext = { type: 'video' };
    await ai.generateRecommendations();
    const recs = ai.getRecommendations(50);
    expect(recs.every(r => isNavigableUrl(r.url))).toBe(true);
  });
});

describe('isNavigableUrl', () => {
  test('true for a real http(s) URL', () => {
    expect(isNavigableUrl('https://example.com')).toBe(true);
  });

  test('false for the placeholder anchor "#"', () => {
    expect(isNavigableUrl('#')).toBe(false);
  });

  test('false for an empty or whitespace-only string', () => {
    expect(isNavigableUrl('')).toBe(false);
    expect(isNavigableUrl('   ')).toBe(false);
  });

  test('false for null/undefined/non-string values', () => {
    expect(isNavigableUrl(null)).toBe(false);
    expect(isNavigableUrl(undefined)).toBe(false);
    expect(isNavigableUrl(42)).toBe(false);
  });
});

describe('AIRecommendation.rankRecommendations filters placeholder entries', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('drops url:"#" entries, keeps real ones', () => {
    const ranked = ai.rankRecommendations([
      { title: 'Fake', url: '#', score: 0.9 },
      { title: 'Real', url: 'https://real.example', score: 0.5 }
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].title).toBe('Real');
  });

  test('returns an empty array when every candidate is a placeholder', () => {
    const ranked = ai.rankRecommendations([
      { title: 'Fake A', url: '#', score: 0.9 },
      { title: 'Fake B', url: '#', score: 0.8 }
    ]);
    expect(ranked).toEqual([]);
  });

  test('still de-duplicates and boosts scores among real entries', () => {
    const ranked = ai.rankRecommendations([
      { title: 'Real', url: 'https://real.example', score: 0.5 },
      { title: 'Real', url: 'https://real.example', score: 0.5 },
      { title: 'Fake', url: '#', score: 0.9 }
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].score).toBeCloseTo(0.6, 5); // 0.5 * 1.2 boost
  });
});

describe('AIRecommendation stats', () => {
  let ai;
  beforeEach(() => { ai = new AIRecommendation(); });

  test('initial stats are zeroed', () => {
    const s = ai.stats;
    expect(s.recommendationsGenerated).toBe(0);
    expect(s.recommendationsClicked).toBe(0);
    expect(s.accuracy).toBe(0);
  });

  test('getStats returns an object with expected keys', () => {
    const s = ai.getStats();
    expect(s).toHaveProperty('recommendationsAvailable');
    expect(s).toHaveProperty('averageScore');
  });
});

describe('AIRecommendation.dispose', () => {
  test('cancels update interval without throwing', () => {
    const ai = new AIRecommendation();
    ai.startUpdateLoop();
    expect(() => ai.dispose()).not.toThrow();
  });

  test('dispose is idempotent', () => {
    const ai = new AIRecommendation();
    ai.dispose();
    expect(() => ai.dispose()).not.toThrow();
  });
});
