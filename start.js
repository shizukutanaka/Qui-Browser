#!/usr/bin/env node

// Qui Browser - Quick Start
const LightweightServer = require('./server-lightweight');

async function start() {
  try {
    const server = new LightweightServer();
    await server.start();
    console.log('✅ Server started successfully');
  } catch (error) {
    console.error('❌ Start failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
