/**
 * Domain-Specific Translation System
 * Provides specialized translations for technical, medical, business, and other professional domains
 */

class DomainSpecificTranslationSystem {
  constructor() {
    this.domainModels = new Map();
    this.domainVocabularies = new Map();
    this.contextAnalyzer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize domain-specific translation system
   */
  async initialize() {
    console.info('🏥 Domain-Specific Translation System initialized');
    await this.loadDomainModels();
    await this.buildContextAnalyzer();
    this.isInitialized = true;
    return true;
  }

  /**
   * Load domain-specific models and vocabularies
   */
  async loadDomainModels() {
    this.domainModels.set('medical', {
      name: 'Medical',
      priority: 'high',
      vocabulary: this.loadMedicalVocabulary(),
      contextRules: this.getMedicalContextRules(),
      styleGuide: this.getMedicalStyleGuide()
    });

    this.domainModels.set('technical', {
      name: 'Technical',
      priority: 'high',
      vocabulary: this.loadTechnicalVocabulary(),
      contextRules: this.getTechnicalContextRules(),
      styleGuide: this.getTechnicalStyleGuide()
    });

    this.domainModels.set('business', {
      name: 'Business',
      priority: 'medium',
      vocabulary: this.loadBusinessVocabulary(),
      contextRules: this.getBusinessContextRules(),
      styleGuide: this.getBusinessStyleGuide()
    });

    this.domainModels.set('legal', {
      name: 'Legal',
      priority: 'high',
      vocabulary: this.loadLegalVocabulary(),
      contextRules: this.getLegalContextRules(),
      styleGuide: this.getLegalStyleGuide()
    });

    this.domainModels.set('academic', {
      name: 'Academic',
      priority: 'medium',
      vocabulary: this.loadAcademicVocabulary(),
      contextRules: this.getAcademicContextRules(),
      styleGuide: this.getAcademicStyleGuide()
    });
  }

  /**
   * Detect domain from text content
   */
  detectDomain(text, context = {}) {
    const domains = Array.from(this.domainModels.keys());
    const scores = new Map();

    domains.forEach(domain => {
      const model = this.domainModels.get(domain);
      const score = this.calculateDomainScore(text, model, context);
      scores.set(domain, score);
    });

    // Return domain with highest score
    let bestDomain = 'general';
    let bestScore = 0;

    scores.forEach((score, domain) => {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain;
      }
    });

    return {
      domain: bestDomain,
      confidence: bestScore,
      allScores: Object.fromEntries(scores)
    };
  }

  /**
   * Calculate domain relevance score
   */
  calculateDomainScore(text, domainModel, context) {
    let score = 0;

    // Vocabulary match score
    const vocabMatches = this.countVocabularyMatches(text, domainModel.vocabulary);
    score += vocabMatches * 0.4;

    // Context rule matches
    const contextMatches = this.countContextMatches(text, domainModel.contextRules);
    score += contextMatches * 0.3;

    // Style pattern matches
    const styleMatches = this.countStyleMatches(text, domainModel.styleGuide);
    score += styleMatches * 0.2;

    // Context influence
    if (context.domain) {
      score += context.domain === domainModel.name.toLowerCase() ? 0.1 : -0.05;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Count vocabulary matches
   */
  countVocabularyMatches(text, vocabulary) {
    const words = text.toLowerCase().split(/\s+/);
    let matches = 0;

    words.forEach(word => {
      if (vocabulary.has(word)) {
        matches++;
      }
    });

    return matches / words.length;
  }

  /**
   * Count context rule matches
   */
  countContextMatches(text, contextRules) {
    let matches = 0;
    const lowerText = text.toLowerCase();

    contextRules.forEach(rule => {
      if (rule.pattern.test(lowerText)) {
        matches++;
      }
    });

    return matches / contextRules.length;
  }

  /**
   * Count style pattern matches
   */
  countStyleMatches(text, styleGuide) {
    let matches = 0;

    styleGuide.patterns.forEach(pattern => {
      if (pattern.regex.test(text)) {
        matches++;
      }
    });

    return matches / styleGuide.patterns.length;
  }

  /**
   * Translate with domain awareness
   */
  async translateWithDomain(text, targetLang, sourceLang = 'auto', context = {}) {
    // Detect domain
    const domainInfo = this.detectDomain(text, context);

    if (domainInfo.confidence > 0.3) {
      console.info(`🎯 Detected domain: ${domainInfo.domain} (${(domainInfo.confidence * 100).toFixed(1)}%)`);

      // Get domain-specific translation
      const domainTranslation = await this.getDomainSpecificTranslation(
        text,
        domainInfo.domain,
        targetLang,
        sourceLang
      );

      return {
        translation: domainTranslation,
        domain: domainInfo.domain,
        confidence: domainInfo.confidence,
        alternatives: await this.getDomainAlternatives(text, domainInfo.domain, targetLang, sourceLang)
      };
    }

    // Fall back to general translation
    return {
      translation: await window.machineTranslation.translate(text, targetLang, sourceLang),
      domain: 'general',
      confidence: 0,
      alternatives: []
    };
  }

  /**
   * Get domain-specific translation
   */
  async getDomainSpecificTranslation(text, domain, targetLang, sourceLang) {
    const domainModel = this.domainModels.get(domain);
    if (!domainModel) {
      return await window.machineTranslation.translate(text, targetLang, sourceLang);
    }

    // Apply domain-specific translation rules
    let translated = text;

    // Replace domain-specific terms
    domainModel.vocabulary.forEach((translation, term) => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(text)) {
        // This would use the domain-specific translation
        translated = translated.replace(regex, translation[targetLang] || term);
      }
    });

    // Apply domain-specific context rules
    translated = this.applyContextRules(translated, domainModel.contextRules, targetLang);

    return translated;
  }

  /**
   * Get domain-specific translation alternatives
   */
  async getDomainAlternatives(text, domain, targetLang, sourceLang) {
    const alternatives = [];

    // Generate alternatives using different domain contexts
    const domainModel = this.domainModels.get(domain);

    if (domainModel) {
      // Formal vs informal
      if (domainModel.styleGuide.formality) {
        const formalTranslation = this.applyFormality(text, 'formal', targetLang);
        const informalTranslation = this.applyFormality(text, 'informal', targetLang);

        alternatives.push({
          text: formalTranslation,
          style: 'formal',
          reason: 'Formal tone for professional context'
        });

        alternatives.push({
          text: informalTranslation,
          style: 'informal',
          reason: 'Informal tone for casual context'
        });
      }
    }

    return alternatives;
  }

  /**
   * Apply context rules to translation
   */
  applyContextRules(text, contextRules, targetLang) {
    let modifiedText = text;

    contextRules.forEach(rule => {
      if (rule.pattern.test(text)) {
        // Apply rule transformation
        modifiedText = modifiedText.replace(rule.pattern, rule.replacement[targetLang] || '$1');
      }
    });

    return modifiedText;
  }

  /**
   * Apply formality level
   */
  applyFormality(text, formality, targetLang) {
    // This would apply formality-specific translations
    // For now, return the original text
    return text;
  }

  /**
   * Load medical vocabulary
   */
  loadMedicalVocabulary() {
    const medicalTerms = new Map();

    // English -> Other languages medical terms
    medicalTerms.set('patient', {
      es: 'paciente',
      fr: 'patient',
      de: 'Patient',
      ja: '患者',
      zh: '患者',
      ar: 'مريض',
      hi: 'मरीज़',
      pt: 'paciente',
      ru: 'пациент',
      ko: '환자'
    });

    medicalTerms.set('diagnosis', {
      es: 'diagnóstico',
      fr: 'diagnostic',
      de: 'Diagnose',
      ja: '診断',
      zh: '诊断',
      ar: 'تشخيص',
      hi: 'निदान',
      pt: 'diagnóstico',
      ru: 'диагноз',
      ko: '진단'
    });

    medicalTerms.set('treatment', {
      es: 'tratamiento',
      fr: 'traitement',
      de: 'Behandlung',
      ja: '治療',
      zh: '治疗',
      ar: 'علاج',
      hi: 'इलाज',
      pt: 'tratamento',
      ru: 'лечение',
      ko: '치료'
    });

    return medicalTerms;
  }

  /**
   * Load technical vocabulary
   */
  loadTechnicalVocabulary() {
    const technicalTerms = new Map();

    technicalTerms.set('algorithm', {
      es: 'algoritmo',
      fr: 'algorithme',
      de: 'Algorithmus',
      ja: 'アルゴリズム',
      zh: '算法',
      ar: 'خوارزمية',
      hi: 'अल्गोरिद्म',
      pt: 'algoritmo',
      ru: 'алгоритм',
      ko: '알고리즘'
    });

    technicalTerms.set('database', {
      es: 'base de datos',
      fr: 'base de données',
      de: 'Datenbank',
      ja: 'データベース',
      zh: '数据库',
      ar: 'قاعدة بيانات',
      hi: 'डेटाबेस',
      pt: 'base de dados',
      ru: 'база данных',
      ko: '데이터베이스'
    });

    return technicalTerms;
  }

  /**
   * Load business vocabulary
   */
  loadBusinessVocabulary() {
    const businessTerms = new Map();

    businessTerms.set('revenue', {
      es: 'ingresos',
      fr: 'revenus',
      de: 'Einnahmen',
      ja: '収益',
      zh: '收入',
      ar: 'إيرادات',
      hi: 'राजस्व',
      pt: 'receita',
      ru: 'доход',
      ko: '수익'
    });

    businessTerms.set('profit', {
      es: 'beneficio',
      fr: 'profit',
      de: 'Gewinn',
      ja: '利益',
      zh: '利润',
      ar: 'ربح',
      hi: 'लाभ',
      pt: 'lucro',
      ru: 'прибыль',
      ko: '이익'
    });

    return businessTerms;
  }

  /**
   * Load legal vocabulary
   */
  loadLegalVocabulary() {
    const legalTerms = new Map();

    legalTerms.set('contract', {
      es: 'contrato',
      fr: 'contrat',
      de: 'Vertrag',
      ja: '契約',
      zh: '合同',
      ar: 'عقد',
      hi: 'अनुबंध',
      pt: 'contrato',
      ru: 'контракт',
      ko: '계약'
    });

    legalTerms.set('liability', {
      es: 'responsabilidad',
      fr: 'responsabilité',
      de: 'Haftung',
      ja: '責任',
      zh: '责任',
      ar: 'مسؤولية',
      hi: 'दायित्व',
      pt: 'responsabilidade',
      ru: 'ответственность',
      ko: '책임'
    });

    return legalTerms;
  }

  /**
   * Load academic vocabulary
   */
  loadAcademicVocabulary() {
    const academicTerms = new Map();

    academicTerms.set('research', {
      es: 'investigación',
      fr: 'recherche',
      de: 'Forschung',
      ja: '研究',
      zh: '研究',
      ar: 'بحث',
      hi: 'अनुसंधान',
      pt: 'pesquisa',
      ru: 'исследование',
      ko: '연구'
    });

    academicTerms.set('hypothesis', {
      es: 'hipótesis',
      fr: 'hypothèse',
      de: 'Hypothese',
      ja: '仮説',
      zh: '假设',
      ar: 'فرضية',
      hi: 'परिकल्पना',
      pt: 'hipótese',
      ru: 'гипотеза',
      ko: '가설'
    });

    return academicTerms;
  }

  /**
   * Get medical context rules
   */
  getMedicalContextRules() {
    return [
      {
        pattern: /\b(patient|client)\s+(history|record)\b/gi,
        replacement: {
          en: '$1 $2',
          es: 'historia clínica del $1',
          fr: 'historique du $1',
          de: '$1 $2',
          ja: '$1の$2'
        }
      }
    ];
  }

  /**
   * Get technical context rules
   */
  getTechnicalContextRules() {
    return [
      {
        pattern: /\b(implement|deploy)\s+(solution|system)\b/gi,
        replacement: {
          en: '$1 $2',
          es: 'implementar $2',
          fr: 'mettre en œuvre $2',
          de: '$2 $1ieren'
        }
      }
    ];
  }

  /**
   * Get business context rules
   */
  getBusinessContextRules() {
    return [
      {
        pattern: /\b(quarterly|annual)\s+(report|earnings)\b/gi,
        replacement: {
          en: '$1 $2',
          es: 'informe $1',
          fr: 'rapport $1'
        }
      }
    ];
  }

  /**
   * Get legal context rules
   */
  getLegalContextRules() {
    return [
      {
        pattern: /\bparty\s+(of\s+the\s+)?(first|second)\s+part\b/gi,
        replacement: {
          en: '$1$2 party',
          es: 'parte $2',
          fr: 'partie $2'
        }
      }
    ];
  }

  /**
   * Get academic context rules
   */
  getAcademicContextRules() {
    return [
      {
        pattern: /\b(peer\s+reviewed|scholarly)\s+(article|journal)\b/gi,
        replacement: {
          en: '$1 $2',
          es: 'artículo $1',
          fr: 'article $1'
        }
      }
    ];
  }

  /**
   * Get medical style guide
   */
  getMedicalStyleGuide() {
    return {
      formality: 'formal',
      precision: 'high',
      patterns: [
        { regex: /\b(patient|doctor|nurse|hospital|clinic)\b/i, type: 'medical_terms' }
      ]
    };
  }

  /**
   * Get technical style guide
   */
  getTechnicalStyleGuide() {
    return {
      formality: 'formal',
      precision: 'high',
      patterns: [
        { regex: /\b(function|variable|class|object|method|api)\b/i, type: 'technical_terms' }
      ]
    };
  }

  /**
   * Get business style guide
   */
  getBusinessStyleGuide() {
    return {
      formality: 'formal',
      precision: 'medium',
      patterns: [
        { regex: /\b(revenue|profit|loss|market|strategy)\b/i, type: 'business_terms' }
      ]
    };
  }

  /**
   * Get legal style guide
   */
  getLegalStyleGuide() {
    return {
      formality: 'formal',
      precision: 'very_high',
      patterns: [
        { regex: /\b(contract|agreement|terms|conditions|liability)\b/i, type: 'legal_terms' }
      ]
    };
  }

  /**
   * Get academic style guide
   */
  getAcademicStyleGuide() {
    return {
      formality: 'formal',
      precision: 'high',
      patterns: [
        { regex: /\b(research|study|analysis|conclusion|methodology)\b/i, type: 'academic_terms' }
      ]
    };
  }

  /**
   * Build context analyzer
   */
  async buildContextAnalyzer() {
    this.contextAnalyzer = {
      domains: Array.from(this.domainModels.keys()),
      keywords: this.extractDomainKeywords(),
      patterns: this.buildDomainPatterns()
    };
  }

  /**
   * Extract keywords from all domain vocabularies
   */
  extractDomainKeywords() {
    const keywords = new Set();

    this.domainModels.forEach(domainModel => {
      domainModel.vocabulary.forEach((translations, term) => {
        keywords.add(term.toLowerCase());
      });
    });

    return Array.from(keywords);
  }

  /**
   * Build domain detection patterns
   */
  buildDomainPatterns() {
    const patterns = new Map();

    this.domainModels.forEach((domainModel, domainName) => {
      const domainKeywords = [];

      domainModel.vocabulary.forEach((translations, term) => {
        domainKeywords.push(term.toLowerCase());
      });

      patterns.set(domainName, {
        keywords: domainKeywords,
        regex: new RegExp(`\\b(${domainKeywords.join('|')})\\b`, 'gi'),
        weight: domainModel.priority === 'high' ? 1.5 : 1.0
      });
    });

    return patterns;
  }

  /**
   * Get domain-specific suggestions
   */
  getDomainSuggestions(text, targetLang, context = {}) {
    const domainInfo = this.detectDomain(text, context);

    if (domainInfo.confidence > 0.2) {
      const domainModel = this.domainModels.get(domainInfo.domain);
      const suggestions = [];

      // Suggest domain-specific terminology
      domainModel.vocabulary.forEach((translations, term) => {
        if (text.toLowerCase().includes(term.toLowerCase())) {
          suggestions.push({
            term,
            translation: translations[targetLang] || term,
            domain: domainInfo.domain,
            type: 'terminology'
          });
        }
      });

      return {
        domain: domainInfo.domain,
        confidence: domainInfo.confidence,
        suggestions,
        styleGuide: domainModel.styleGuide
      };
    }

    return {
      domain: 'general',
      confidence: 0,
      suggestions: []
    };
  }

  /**
   * Get translation statistics by domain
   */
  getDomainStatistics() {
    const stats = {
      totalTranslations: 0,
      domainBreakdown: {},
      accuracyByDomain: {},
      improvementAreas: []
    };

    // This would be populated from usage data
    this.domainModels.forEach((model, domain) => {
      stats.domainBreakdown[domain] = {
        translations: 0,
        accuracy: 0.85 + Math.random() * 0.1, // Simulated accuracy
        commonIssues: this.getCommonIssues(domain)
      };
    });

    return stats;
  }

  /**
   * Get common issues for a domain
   */
  getCommonIssues(domain) {
    const issues = {
      medical: ['terminology accuracy', 'cultural sensitivity'],
      technical: ['technical precision', 'version compatibility'],
      business: ['tone consistency', 'cultural adaptation'],
      legal: ['legal accuracy', 'jurisdictional differences'],
      academic: ['citation format', 'formal tone']
    };

    return issues[domain] || ['general accuracy'];
  }

  /**
   * Export domain models for external use
   */
  exportDomainModels() {
    const exportData = {
      domains: Array.from(this.domainModels.entries()),
      contextAnalyzer: this.contextAnalyzer,
      exportDate: new Date().toISOString(),
      version: '2.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qui-browser-domain-models-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Initialize domain-specific translation system
window.domainTranslation = new DomainSpecificTranslationSystem();

// Export for use in other modules
export { DomainSpecificTranslationSystem };
