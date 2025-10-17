const EventEmitter = require('events');

/**
 * Validation Rule
 */
class ValidationRule {
  constructor(name, validator, message) {
    this.name = name;
    this.validator = validator;
    this.message = message;
  }

  /**
   * Validate value
   */
  validate(value, context = {}) {
    try {
      const result = this.validator(value, context);
      return {
        valid: result === true || result === undefined,
        message: result === false || typeof result === 'string' ? this.message || result : null
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message
      };
    }
  }
}

/**
 * Schema Field
 */
class SchemaField {
  constructor(type, options = {}) {
    this.type = type;
    this.required = options.required || false;
    this.default = options.default;
    this.rules = options.rules || [];
    this.transform = options.transform;
    this.label = options.label || '';
  }

  /**
   * Add rule
   */
  addRule(rule) {
    this.rules.push(rule);
    return this;
  }

  /**
   * Validate value
   */
  validate(value, context = {}) {
    const errors = [];

    // Check required
    if (this.required && (value === undefined || value === null || value === '')) {
      errors.push(`${this.label || 'Field'} is required`);
      return { valid: false, errors };
    }

    // Use default if not provided
    if (value === undefined && this.default !== undefined) {
      value = typeof this.default === 'function' ? this.default() : this.default;
    }

    // Skip validation if value is empty and not required
    if ((value === undefined || value === null || value === '') && !this.required) {
      return { valid: true, errors: [], value };
    }

    // Transform value
    if (this.transform) {
      value = this.transform(value);
    }

    // Type validation
    if (!this.validateType(value)) {
      errors.push(`${this.label || 'Field'} must be of type ${this.type}`);
      return { valid: false, errors, value };
    }

    // Run rules
    for (const rule of this.rules) {
      const result = rule.validate(value, context);
      if (!result.valid) {
        errors.push(result.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      value
    };
  }

  /**
   * Validate type
   */
  validateType(value) {
    switch (this.type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'date':
        return value instanceof Date || !isNaN(Date.parse(value));
      case 'email':
        return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'any':
        return true;
      default:
        return true;
    }
  }
}

/**
 * Schema
 */
class Schema {
  constructor(definition = {}) {
    this.fields = new Map();

    for (const [name, field] of Object.entries(definition)) {
      if (field instanceof SchemaField) {
        this.fields.set(name, field);
      } else {
        // Auto-create field from simple definition
        this.fields.set(name, new SchemaField(field.type || 'any', field));
      }
    }
  }

  /**
   * Add field
   */
  addField(name, field) {
    this.fields.set(name, field);
    return this;
  }

  /**
   * Validate data
   */
  validate(data, context = {}) {
    const errors = {};
    const validated = {};
    let valid = true;

    // Validate defined fields
    for (const [name, field] of this.fields) {
      const result = field.validate(data[name], context);

      if (!result.valid) {
        valid = false;
        errors[name] = result.errors;
      }

      if (result.value !== undefined) {
        validated[name] = result.value;
      }
    }

    return {
      valid,
      errors,
      data: validated
    };
  }
}

/**
 * Built-in Rules
 */
class Rules {
  /**
   * Minimum length
   */
  static minLength(min) {
    return new ValidationRule(
      'minLength',
      (value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length >= min;
        }
        return true;
      },
      `Minimum length is ${min}`
    );
  }

  /**
   * Maximum length
   */
  static maxLength(max) {
    return new ValidationRule(
      'maxLength',
      (value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length <= max;
        }
        return true;
      },
      `Maximum length is ${max}`
    );
  }

  /**
   * Minimum value
   */
  static min(min) {
    return new ValidationRule(
      'min',
      (value) => typeof value === 'number' && value >= min,
      `Minimum value is ${min}`
    );
  }

  /**
   * Maximum value
   */
  static max(max) {
    return new ValidationRule(
      'max',
      (value) => typeof value === 'number' && value <= max,
      `Maximum value is ${max}`
    );
  }

  /**
   * Pattern match
   */
  static pattern(regex, message = 'Invalid format') {
    return new ValidationRule('pattern', (value) => regex.test(value), message);
  }

  /**
   * Email validation
   */
  static email() {
    return new ValidationRule(
      'email',
      (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      'Invalid email address'
    );
  }

  /**
   * URL validation
   */
  static url() {
    return new ValidationRule(
      'url',
      (value) => {
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      'Invalid URL'
    );
  }

  /**
   * Enum validation
   */
  static enum(values) {
    return new ValidationRule(
      'enum',
      (value) => values.includes(value),
      `Value must be one of: ${values.join(', ')}`
    );
  }

  /**
   * Custom validation
   */
  static custom(validator, message = 'Validation failed') {
    return new ValidationRule('custom', validator, message);
  }

  /**
   * Alpha (letters only)
   */
  static alpha() {
    return new ValidationRule(
      'alpha',
      (value) => /^[a-zA-Z]+$/.test(value),
      'Only letters are allowed'
    );
  }

  /**
   * Alphanumeric
   */
  static alphanumeric() {
    return new ValidationRule(
      'alphanumeric',
      (value) => /^[a-zA-Z0-9]+$/.test(value),
      'Only letters and numbers are allowed'
    );
  }

  /**
   * Numeric
   */
  static numeric() {
    return new ValidationRule('numeric', (value) => /^[0-9]+$/.test(value), 'Only numbers are allowed');
  }

  /**
   * Integer
   */
  static integer() {
    return new ValidationRule(
      'integer',
      (value) => Number.isInteger(value),
      'Value must be an integer'
    );
  }

  /**
   * Positive
   */
  static positive() {
    return new ValidationRule('positive', (value) => value > 0, 'Value must be positive');
  }

  /**
   * Negative
   */
  static negative() {
    return new ValidationRule('negative', (value) => value < 0, 'Value must be negative');
  }

  /**
   * Date (past)
   */
  static datePast() {
    return new ValidationRule(
      'datePast',
      (value) => new Date(value) < new Date(),
      'Date must be in the past'
    );
  }

  /**
   * Date (future)
   */
  static dateFuture() {
    return new ValidationRule(
      'dateFuture',
      (value) => new Date(value) > new Date(),
      'Date must be in the future'
    );
  }
}

/**
 * Data Validator
 */
class DataValidator extends EventEmitter {
  constructor() {
    super();

    this.schemas = new Map();
    this.rules = new Map();
    this.validationCount = 0;
    this.errorCount = 0;
  }

  /**
   * Register schema
   */
  registerSchema(name, schema) {
    if (!(schema instanceof Schema)) {
      schema = new Schema(schema);
    }

    this.schemas.set(name, schema);
    this.emit('schema-registered', name);
    return this;
  }

  /**
   * Register custom rule
   */
  registerRule(name, validator, message) {
    const rule = new ValidationRule(name, validator, message);
    this.rules.set(name, rule);
    this.emit('rule-registered', name);
    return this;
  }

  /**
   * Get rule
   */
  getRule(name) {
    return this.rules.get(name);
  }

  /**
   * Validate with schema
   */
  validate(schemaName, data, context = {}) {
    const schema = this.schemas.get(schemaName);

    if (!schema) {
      throw new Error(`Schema not found: ${schemaName}`);
    }

    this.validationCount++;

    const result = schema.validate(data, context);

    if (!result.valid) {
      this.errorCount++;
      this.emit('validation-failed', {
        schema: schemaName,
        errors: result.errors
      });
    } else {
      this.emit('validation-success', {
        schema: schemaName
      });
    }

    return result;
  }

  /**
   * Validate single value
   */
  validateValue(value, rules = []) {
    const errors = [];

    for (const rule of rules) {
      const result = rule.validate(value);
      if (!result.valid) {
        errors.push(result.message);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create schema
   */
  createSchema(definition) {
    return new Schema(definition);
  }

  /**
   * Create field
   */
  createField(type, options) {
    return new SchemaField(type, options);
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      schemas: this.schemas.size,
      customRules: this.rules.size,
      validationCount: this.validationCount,
      errorCount: this.errorCount,
      successRate:
        this.validationCount > 0 ? (this.validationCount - this.errorCount) / this.validationCount : 0
    };
  }

  /**
   * Clear all
   */
  clear() {
    this.schemas.clear();
    this.rules.clear();
    this.validationCount = 0;
    this.errorCount = 0;
  }

  /**
   * Destroy validator
   */
  destroy() {
    this.clear();
    this.removeAllListeners();
  }
}

module.exports = {
  ValidationRule,
  SchemaField,
  Schema,
  Rules,
  DataValidator
};
