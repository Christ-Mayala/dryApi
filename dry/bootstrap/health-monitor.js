const config = require('../../config/database');
const logger = require('../utils/logging/logger');
const healthService = require('../services/health/health.service');
const { sendAlert } = require('../services/alert/alert.service');

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

      lastStatus = status;
    } catch (error) {
      logger(`[monitor] error: ${error.message}`, 'error');

      const now = Date.now();
      const shouldSendError = !lastErrorAt || (repeatAlerts && now - lastErrorAt >= repeatMs);
      if (shouldSendError) {
        await sendAlert({
          event: 'DRY_HEALTH_ERROR',
          error,
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
