#!/usr/bin/env node

/**
 * Runner robuste: relance automatiquement monitor-health.js si crash.
 * Utile en production quand le process doit rester vivant.
 */

const { spawn } = require('child_process');

const START_DELAY_MS = Number(process.env.MONITOR_RESTART_DELAY_MS || 3000);
const SCRIPT = 'scripts/maintenance/monitor-health.js';

const start = () => {
  const child = spawn(process.execPath, [SCRIPT], { stdio: 'inherit' });

  child.on('exit', (code, signal) => {
    console.log(`[monitor-runner] exit code=${code} signal=${signal} -> restart in ${START_DELAY_MS}ms`);
    setTimeout(start, START_DELAY_MS);
  });
};

start();
