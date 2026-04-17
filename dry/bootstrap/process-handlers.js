const config = require('../../config/database');
const logger = require('../utils/logging/logger');
const { sendAlert } = require('../services/alert/alert.service');

const boolFromEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const fatalExitDelayMs = Number(config.FATAL_ERROR_EXIT_DELAY_MS || 3500);
const crashOnUnhandledRejection = boolFromEnv(config.CRASH_ON_UNHANDLED_REJECTION, false);

let fatalExitScheduled = false;

const toErrorObject = (raw, fallbackMessage = 'Erreur inconnue') => {
  if (raw instanceof Error) return raw;
  const message = typeof raw === 'string' ? raw : fallbackMessage;
  const error = new Error(message);
  error.raw = raw;
  return error;
};

const scheduleFatalExit = (origin) => {
  if (fatalExitScheduled) return;
  fatalExitScheduled = true;

  const safeDelayMs =
    Number.isFinite(fatalExitDelayMs) && fatalExitDelayMs > 0 ? fatalExitDelayMs : 3500;
  logger(`[fatal] Process exit(1) programme dans ${safeDelayMs}ms (${origin})`, 'error');

  setTimeout(() => {
    process.exit(1);
  }, safeDelayMs).unref();
};

const sendProcessAlert = async (event, error, details = {}) => {
  try {
    const normalizedError = toErrorObject(error);
    const dedupKey = `process:${event}:${normalizedError.name || 'Error'}:${normalizedError.code || ''}:${normalizedError.message || ''}`;
    const memory = process.memoryUsage();

    await sendAlert({
      event,
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: normalizedError,
      dedupKey,
      details: {
        ...details,
        pid: process.pid,
        nodeVersion: process.version,
        uptime: Math.round(process.uptime()),
        memory: {
          rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        },
      },
    });
  } catch (alertError) {
    logger(
      `[global] Echec envoi alerte process: ${alertError?.message || String(alertError)}`,
      'error'
    );
  }
};

const registerProcessHandlers = () => {
  process.on('unhandledRejection', async (reason) => {
    const error = toErrorObject(reason, 'Promesse rejetee non geree');
    logger(`[global] unhandledRejection: ${error.stack || error.message}`, 'error');

    if (crashOnUnhandledRejection) {
      scheduleFatalExit('unhandledRejection');
    }

    await sendProcessAlert('DRY_UNHANDLED_REJECTION', error, {
      reasonType: typeof reason,
    });
  });

  process.on('uncaughtException', async (error, origin) => {
    const normalizedError = toErrorObject(error, 'Exception fatale non interceptee');
    logger(
      `[global] uncaughtException (${origin || 'unknown'}): ${normalizedError.stack || normalizedError.message}`,
      'error'
    );

    scheduleFatalExit('uncaughtException');

    await sendProcessAlert('DRY_UNCAUGHT_EXCEPTION', normalizedError, {
      origin: origin || 'unknown',
    });
  });
};

module.exports = {
  registerProcessHandlers,
  scheduleFatalExit,
  sendProcessAlert,
};
