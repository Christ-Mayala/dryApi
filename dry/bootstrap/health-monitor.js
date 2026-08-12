const config = require('../../config/database');
const logger = require('../utils/logging/logger');
const healthService = require('../services/health/health.service');
const { sendAlert } = require('../services/alert/alert.service');

const checkApiLatency = async () => {
  try {
    const start = Date.now();
    const baseUrl = config.SERVER_URL || `http://localhost:${config.PORT}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number(config.HEALTH_CHECK_API_LATENCY_MS || 5000));

    const response = await fetch(`${baseUrl}/health/ready`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    const threshold = Number(config.HEALTH_CHECK_API_LATENCY_MS || 5000);
    return {
      status: response.status,
      latency,
      ok: response.ok,
      state: latency > threshold ? 'WARN' : 'OK',
      value: `${latency}ms`,
    };
  } catch (error) {
    return { status: 0, latency: -1, ok: false, error: error.message, state: 'WARN', value: `Indisponible (${error.message})` };
  }
};

const checkDiskSpace = async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const checkPath = process.cwd();

    if (typeof fs.statfs === 'undefined' && typeof fs.statfsSync === 'undefined') {
      return { available: null, threshold: Number(config.HEALTH_CHECK_DISK_THRESHOLD_MB || 500), supported: false, state: 'INFO', value: 'Non supporté sur cette plateforme' };
    }

    let availableBytes = 0;
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(checkPath);
      availableBytes = stats.available || 0;
    } else if (typeof fs.statfs === 'function') {
      const stats = await fs.statfs(checkPath);
      availableBytes = stats.available || 0;
    } else {
      return { available: null, threshold: Number(config.HEALTH_CHECK_DISK_THRESHOLD_MB || 500), supported: false, state: 'INFO', value: 'Non supporté sur cette plateforme' };
    }

    const availableMB = Math.round(availableBytes / (1024 * 1024));
    const threshold = Number(config.HEALTH_CHECK_DISK_THRESHOLD_MB || 500);
    const ok = availableMB > threshold;
    return {
      available: availableBytes,
      availableMB,
      threshold,
      supported: true,
      ok,
      state: ok ? 'OK' : 'WARN',
      value: `${availableMB} MB disponibles`,
    };
  } catch (error) {
    return { available: null, threshold: Number(config.HEALTH_CHECK_DISK_THRESHOLD_MB || 500), supported: false, state: 'WARN', value: `Erreur: ${error.message}` };
  }
};

const checkQueueHealth = async () => {
  try {
    const queueEnabled = String(config.HEALTH_CHECK_QUEUE_ENABLED || 'false').toLowerCase() === 'true';
    if (!queueEnabled) {
      return { enabled: false, state: 'INFO', value: 'Désactivé' };
    }

    // Tentative de détection de la queue (RabbitMQ, Kafka, Bull, etc.)
    const queueTypes = ['amqplib', 'kafkajs', 'bull', 'bullmq'];
    let queueFound = false;
    let queueStatus = 'DOWN';

    for (const queueType of queueTypes) {
      try {
        const queueModule = require(queueType);
        if (queueModule && queueModule.connection) {
          queueFound = true;
          queueStatus = 'UP';
          break;
        }
      } catch {
        // Module non installé, on continue
      }
    }

    return {
      enabled: true,
      status: queueStatus,
      ok: queueStatus === 'UP',
      state: queueStatus === 'UP' ? 'OK' : 'WARN',
      value: queueFound ? (queueStatus === 'UP' ? 'Connectée' : 'Déconnectée') : 'Aucune queue détectée',
    };
  } catch (error) {
    return { enabled: false, state: 'WARN', value: `Erreur: ${error.message}` };
  }
};

const checkSyncQueue = async () => {
  try {
    const db = require('../../services/db/database').getDatabase();
    const result = await db.getFirstAsync('SELECT COUNT(*) as count FROM file_sync_queue');
    const pending = result?.count || 0;
    const threshold = Number(config.HEALTH_CHECK_SYNC_QUEUE_THRESHOLD || 1000);
    const ok = pending <= threshold;
    return {
      pending,
      threshold,
      ok,
      state: ok ? 'OK' : 'WARN',
      value: `${pending} opération(s) en attente`,
    };
  } catch (error) {
    return { pending: -1, threshold: Number(config.HEALTH_CHECK_SYNC_QUEUE_THRESHOLD || 1000), ok: false, state: 'WARN', value: `Erreur: ${error.message}` };
  }
};

const runExtendedChecks = async () => {
  const [apiLatency, diskSpace, queueHealth, syncQueue] = await Promise.all([
    checkApiLatency(),
    checkDiskSpace(),
    checkQueueHealth(),
    checkSyncQueue(),
  ]);

  return {
    apiLatency,
    diskSpace,
    queueHealth,
    syncQueue,
  };
};

const startHealthMonitor = () => {
  const intervalMs = Number(config.HEALTH_MONITOR_INTERVAL_MS || 0);
  if (!intervalMs || intervalMs < 10000) return null;

  const repeatAlerts = String(config.MONITOR_REPEAT_ALERTS || 'false').toLowerCase() === 'true';
  const repeatMs = Number(config.MONITOR_REPEAT_ALERT_MS || 900000);

  let lastStatus = null;
  let lastAlertAt = 0;
  let lastErrorAt = 0;
  let outageStart = null;
  let outageReported = false;

  return setInterval(async () => {
    try {
      const health = await healthService.getHealthStatus();
      const status = health.status;
      const now = Date.now();

      if (status !== 'OK') {
        if (!outageStart) outageStart = now;

        const shouldSend = !outageReported || (repeatAlerts && now - lastAlertAt >= repeatMs);
        if (shouldSend) {
          const downtimeSeconds = Math.floor((now - outageStart) / 1000);
          logger(
            `[monitor] status=${status} db=${health.services?.database?.status} redis=${health.services?.redis?.connected ? 'UP' : 'DOWN'}`,
            'warning'
          );

          await sendAlert({
            event: 'DRY_HEALTH_ALERT',
            status,
            severity: 'critical',
            timestamp: new Date().toISOString(),
            details: health.services,
            downtimeSeconds,
            downtimeStart: new Date(outageStart).toISOString(),
          });

          outageReported = true;
          lastAlertAt = now;
        }
      } else {
        if (lastStatus && lastStatus !== 'OK') {
          const downtimeSeconds = outageStart ? Math.floor((now - outageStart) / 1000) : 0;
          await sendAlert({
            event: 'DRY_HEALTH_RECOVERED',
            status: 'OK',
            severity: 'info',
            timestamp: new Date().toISOString(),
            details: health.services,
            downtimeSeconds,
            downtimeStart: outageStart ? new Date(outageStart).toISOString() : undefined,
            downtimeEnd: new Date().toISOString(),
          });
        }

        outageStart = null;
        outageReported = false;
        lastAlertAt = 0;
      }

      const extendedChecks = {
        apiLatency: await checkApiLatency(),
        diskSpace: await checkDiskSpace(),
        queueHealth: await checkQueueHealth(),
        syncQueue: await checkSyncQueue(),
      };

      const issues = [];
      
      if (extendedChecks.apiLatency && !extendedChecks.apiLatency.ok) {
        issues.push({
          check: 'api_latency',
          severity: extendedChecks.apiLatency.latency === -1 ? 'critical' : 'warning',
          message: `API latency: ${extendedChecks.apiLatency.latency}ms (status: ${extendedChecks.apiLatency.status})`,
          data: extendedChecks.apiLatency,
        });
      }
      
      if (extendedChecks.diskSpace && !extendedChecks.diskSpace.ok && !extendedChecks.diskSpace.supported === false) {
        issues.push({
          check: 'disk_space',
          severity: 'warning',
          message: `Disk space low: ${extendedChecks.diskSpace.availableMB}MB available (threshold: ${extendedChecks.diskSpace.threshold}MB)`,
          data: extendedChecks.diskSpace,
        });
      }
      
      if (extendedChecks.queueHealth && extendedChecks.queueHealth.enabled && extendedChecks.queueHealth.status === 'DOWN') {
        issues.push({
          check: 'queue_health',
          severity: 'critical',
          message: `Message queue is down`,
          data: extendedChecks.queueHealth,
        });
      }
      
      if (extendedChecks.syncQueue && extendedChecks.syncQueue.pending > (extendedChecks.syncQueue.threshold || 1000)) {
        issues.push({
          check: 'sync_queue',
          severity: 'warning',
          message: `Sync queue backlog: ${extendedChecks.syncQueue.pending} pending (threshold: ${extendedChecks.syncQueue.threshold})`,
          data: extendedChecks.syncQueue,
        });
      }

      for (const issue of issues) {
        const shouldSendIssue = !lastAlertAt || (repeatAlerts && now - lastAlertAt >= repeatMs);
        if (shouldSendIssue) {
          await sendAlert({
            event: 'DRY_HEALTH_EXTENDED_CHECK',
            status: 'WARN',
            severity: issue.severity,
            timestamp: new Date().toISOString(),
            details: { extendedChecks, issue },
            message: issue.message,
          });
        }
      }

      lastStatus = status;
    } catch (error) {
      logger(`[monitor] error: ${error.message}`, 'error');

      const now = Date.now();
      const shouldSendError = !lastErrorAt || (repeatAlerts && now - lastErrorAt >= repeatMs);
      if (shouldSendError) {
        await sendAlert({
          event: 'DRY_HEALTH_ERROR',
          error,
          severity: 'critical',
          details: { monitorPhase: 'health-check-loop' },
          timestamp: new Date().toISOString(),
        });
        lastErrorAt = now;
      }
    }
  }, intervalMs);
};

module.exports = {
  startHealthMonitor,
};
