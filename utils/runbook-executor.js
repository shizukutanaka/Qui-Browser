/**
 * Incident Runbook Executor
 * Automated incident response with standardized runbooks
 * Priority: H036 from improvement backlog
 *
 * Features:
 * - Standardized incident response procedures
 * - Automated step execution
 * - Progress tracking and logging
 * - Escalation management
 * - Post-incident reporting
 *
 * @module utils/runbook-executor
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');

const execAsync = promisify(exec);

class RunbookExecutor extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      runbooksFile: options.runbooksFile || './docs/incident-runbooks.json',
      logDir: options.logDir || './logs/incidents',
      enableAutoExecution: options.enableAutoExecution || false,
      dryRun: options.dryRun || false,
      ...options
    };

    this.runbooks = [];
    this.activeIncidents = new Map();
    this.incidentHistory = [];

    this.init();
  }

  /**
   * Initialize runbook executor
   */
  async init() {
    try {
      await fs.mkdir(this.options.logDir, { recursive: true });
      await this.loadRunbooks();

      console.log(`[Runbook] Executor initialized with ${this.runbooks.length} runbooks`);
    } catch (error) {
      console.error('[Runbook] Initialization failed:', error);
    }
  }

  /**
   * Load runbooks from configuration
   */
  async loadRunbooks() {
    try {
      const content = await fs.readFile(this.options.runbooksFile, 'utf8');
      const config = JSON.parse(content);

      this.runbooks = config.runbooks || [];
      this.commonTools = config.commonTools || {};
      this.contacts = config.contacts || {};

      console.log(`[Runbook] Loaded ${this.runbooks.length} runbooks`);
    } catch (error) {
      console.error('[Runbook] Failed to load runbooks:', error);
    }
  }

  /**
   * Execute runbook for incident
   * @param {string} runbookId - Runbook ID
   * @param {Object} context - Incident context
   * @returns {Promise<Object>} Execution result
   */
  async executeRunbook(runbookId, context = {}) {
    const runbook = this.runbooks.find(rb => rb.id === runbookId);

    if (!runbook) {
      throw new Error(`Runbook not found: ${runbookId}`);
    }

    console.log(`[Runbook] Executing: ${runbook.title} (${runbookId})`);

    const incidentId = `INC-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const execution = {
      incidentId,
      runbookId,
      title: runbook.title,
      severity: runbook.severity,
      startTime: Date.now(),
      endTime: null,
      status: 'in_progress',
      context,
      steps: [],
      errors: [],
      escalations: []
    };

    this.activeIncidents.set(incidentId, execution);
    this.emit('incidentStarted', { incidentId, runbook: runbook.title });

    try {
      // Execute each step
      for (const step of runbook.responseSteps) {
        const stepResult = await this.executeStep(step, execution);
        execution.steps.push(stepResult);

        // Check if escalation is needed
        const elapsed = Date.now() - execution.startTime;
        this.checkEscalation(runbook, elapsed, execution);

        // Stop if step failed critically
        if (!stepResult.success && stepResult.critical) {
          break;
        }
      }

      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.status = execution.steps.every(s => s.success) ? 'resolved' : 'failed';

      console.log(`[Runbook] Execution complete: ${execution.status} (${execution.duration}ms)`);

      this.emit('incidentCompleted', execution);
    } catch (error) {
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      execution.status = 'error';
      execution.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });

      console.error('[Runbook] Execution failed:', error);

      this.emit('incidentFailed', execution);
    } finally {
      // Move to history
      this.activeIncidents.delete(incidentId);
      this.incidentHistory.push(execution);

      // Save incident report
      await this.saveIncidentReport(execution);
    }

    return execution;
  }

  /**
   * Execute single step
   * @param {Object} step - Step configuration
   * @param {Object} execution - Execution context
   * @returns {Promise<Object>} Step result
   */
  async executeStep(step, execution) {
    console.log(`[Runbook] Step ${step.step}: ${step.action}`);

    const stepResult = {
      step: step.step,
      action: step.action,
      description: step.description,
      startTime: Date.now(),
      endTime: null,
      success: false,
      output: null,
      error: null,
      critical: step.critical || false
    };

    try {
      if (this.options.dryRun) {
        console.log(`[Runbook] [DRY RUN] Would execute: ${step.action}`);
        stepResult.success = true;
        stepResult.output = 'Dry run - not executed';
      } else if (step.commands && step.commands.length > 0) {
        // Execute commands
        const outputs = [];

        for (const command of step.commands) {
          try {
            const { stdout, stderr } = await execAsync(command, {
              timeout: 30000,
              maxBuffer: 1024 * 1024 * 10 // 10MB
            });

            outputs.push({ command, stdout, stderr });

            console.log(`[Runbook] Command output: ${stdout.substring(0, 200)}`);
          } catch (error) {
            outputs.push({
              command,
              error: error.message,
              stdout: error.stdout,
              stderr: error.stderr
            });

            if (step.critical) {
              throw error;
            }
          }
        }

        stepResult.output = outputs;
        stepResult.success = true;
      } else if (step.options) {
        // Handle option-based steps
        console.log(`[Runbook] Step has ${step.options.length} options available`);
        stepResult.success = true;
        stepResult.output = `Options available: ${step.options.map(o => o.scenario).join(', ')}`;
      } else {
        // Manual step
        console.log(`[Runbook] Manual step: ${step.description}`);
        stepResult.success = true;
        stepResult.output = 'Manual step - requires operator intervention';
      }

      stepResult.endTime = Date.now();
      stepResult.duration = stepResult.endTime - stepResult.startTime;

      this.emit('stepCompleted', { incidentId: execution.incidentId, step: stepResult });
    } catch (error) {
      stepResult.endTime = Date.now();
      stepResult.duration = stepResult.endTime - stepResult.startTime;
      stepResult.error = error.message;
      stepResult.success = false;

      console.error(`[Runbook] Step ${step.step} failed:`, error);

      this.emit('stepFailed', { incidentId: execution.incidentId, step: stepResult, error });
    }

    return stepResult;
  }

  /**
   * Check if escalation is needed
   * @param {Object} runbook - Runbook configuration
   * @param {number} elapsed - Elapsed time in ms
   * @param {Object} execution - Execution context
   */
  checkEscalation(runbook, elapsed, execution) {
    if (!runbook.escalationPath) return;

    for (const escalation of runbook.escalationPath) {
      const threshold = this.parseTimeToMs(escalation.timeElapsed);

      if (elapsed >= threshold && !execution.escalations.some(e => e.action === escalation.action)) {
        console.warn(`[Runbook] Escalation triggered: ${escalation.action} (${escalation.timeElapsed})`);

        execution.escalations.push({
          action: escalation.action,
          contact: escalation.contact,
          timestamp: Date.now(),
          elapsed
        });

        this.emit('escalation', {
          incidentId: execution.incidentId,
          escalation
        });

        // Send notification if available
        this.sendEscalationNotification(escalation, execution);
      }
    }
  }

  /**
   * Parse time string to milliseconds
   * @param {string} timeStr - Time string (e.g., "15 minutes")
   * @returns {number} Milliseconds
   */
  parseTimeToMs(timeStr) {
    const match = timeStr.match(/(\d+)\s*(minute|second|hour)s?/i);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'second':
        return value * 1000;
      case 'minute':
        return value * 60 * 1000;
      case 'hour':
        return value * 60 * 60 * 1000;
      default:
        return 0;
    }
  }

  /**
   * Send escalation notification
   * @param {Object} escalation - Escalation configuration
   * @param {Object} execution - Execution context
   */
  async sendEscalationNotification(escalation, execution) {
    try {
      // Try to use notification channel if available
      const NotificationChannel = require('./notification-channel');
      const notifier = new NotificationChannel();

      await notifier.critical(
        `Incident Escalation: ${execution.title}`,
        `Incident ${execution.incidentId} requires escalation: ${escalation.action}\nContact: ${escalation.contact}`,
        {
          incidentId: execution.incidentId,
          escalation: escalation.action,
          contact: escalation.contact
        }
      );
    } catch (error) {
      console.error('[Runbook] Failed to send escalation notification:', error);
    }
  }

  /**
   * Save incident report
   * @param {Object} execution - Execution result
   */
  async saveIncidentReport(execution) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const filename = `incident-${execution.incidentId}-${timestamp}.json`;
    const filepath = path.join(this.options.logDir, filename);

    const report = {
      ...execution,
      startTime: new Date(execution.startTime).toISOString(),
      endTime: execution.endTime ? new Date(execution.endTime).toISOString() : null,
      durationFormatted: execution.duration ? `${(execution.duration / 1000).toFixed(2)}s` : null
    };

    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`[Runbook] Incident report saved: ${filename}`);
  }

  /**
   * Get runbook by ID
   * @param {string} runbookId - Runbook ID
   * @returns {Object|null} Runbook
   */
  getRunbook(runbookId) {
    return this.runbooks.find(rb => rb.id === runbookId) || null;
  }

  /**
   * List all runbooks
   * @returns {Array} Runbooks
   */
  listRunbooks() {
    return this.runbooks.map(rb => ({
      id: rb.id,
      title: rb.title,
      severity: rb.severity,
      category: rb.category,
      totalTimeEstimate: rb.totalTimeEstimate
    }));
  }

  /**
   * Find runbook by trigger condition
   * @param {string} condition - Trigger condition
   * @returns {Array} Matching runbooks
   */
  findRunbooksByCondition(condition) {
    return this.runbooks.filter(rb =>
      rb.triggerConditions.some(tc =>
        tc.toLowerCase().includes(condition.toLowerCase())
      )
    );
  }

  /**
   * Get active incidents
   * @returns {Array} Active incidents
   */
  getActiveIncidents() {
    return Array.from(this.activeIncidents.values());
  }

  /**
   * Get incident history
   * @param {number} limit - Limit results
   * @returns {Array} Incident history
   */
  getIncidentHistory(limit = 50) {
    return this.incidentHistory.slice(-limit);
  }

  /**
   * Generate incident statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const resolved = this.incidentHistory.filter(i => i.status === 'resolved').length;
    const failed = this.incidentHistory.filter(i => i.status === 'failed').length;
    const avgDuration =
      this.incidentHistory.length > 0
        ? this.incidentHistory.reduce((sum, i) => sum + (i.duration || 0), 0) /
          this.incidentHistory.length
        : 0;

    const bySeverity = {};
    for (const incident of this.incidentHistory) {
      bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
    }

    return {
      totalRunbooks: this.runbooks.length,
      totalIncidents: this.incidentHistory.length,
      activeIncidents: this.activeIncidents.size,
      resolvedIncidents: resolved,
      failedIncidents: failed,
      resolutionRate:
        this.incidentHistory.length > 0
          ? ((resolved / this.incidentHistory.length) * 100).toFixed(2) + '%'
          : '0%',
      avgDuration: `${(avgDuration / 1000).toFixed(2)}s`,
      incidentsBySeverity: bySeverity
    };
  }
}

module.exports = RunbookExecutor;
