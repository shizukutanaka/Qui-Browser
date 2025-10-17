#!/usr/bin/env node
/**
 * Qui Browser - Modular Server Entry Point
 *
 * Lightweight, secure, and feature-rich web server
 * Now using a modular architecture for better maintainability
 */

// Load environment variables first
require('dotenv').config();

const LightweightBrowserServer = require('./lib/server');
const { validateStartupConfiguration, printValidationResults } = require('./utils/startup-validator');

// Set global start time for uptime calculations
global.startTime = Date.now();

// Validate configuration before starting
const validation = validateStartupConfiguration();
printValidationResults(validation, { exitOnError: true });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WARNING] Unhandled Promise Rejection:', reason);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (global.serverInstance) {
    global.serverInstance.stop().finally(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function main() {
  try {
    const server = new LightweightBrowserServer();
    global.serverInstance = await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = LightweightBrowserServer;
