#!/usr/bin/env node

/**
 * Monitoring simple: ping /health/ready et alerte optionnelle.
 * Variables:
 * - SERVER_URL (defaut http://localhost:5000)
 * - ALERT_WEBHOOK_URL (optionnel)
 * - INTERVAL_MS (defaut 60000)
 */

require('dotenv').config();

const BASE = process.env.SERVER_URL || 'http://localhost:5000';
const INTERVAL_MS = Number(process.env.HEALTH_MONITOR_INTERVAL_MS || process.env.INTERVAL_MS || 60000);
const TENANT_NAME = process.env.MONITOR_TENANT || process.env.APP_NAME || 'DRY API';
const ENABLE_DAILY_SUMMARY = process.env.MONITOR_DAILY_SUMMARY !== 'false';
const DAILY_SUMMARY_MS = Number(process.env.MONITOR_DAILY_SUMMARY_MS || 24 * 60 * 60 * 1000);
const LOGS_EVERY_DAYS = Number(process.env.MONITOR_LOGS_EVERY_DAYS || 3);
const LOGS_SUMMARY_MS = Number(process.env.MONITOR_LOGS_EVERY_MS || LOGS_EVERY_DAYS * 24 * 60 * 60 * 1000);
const REPEAT_ALERTS = process.env.MONITOR_REPEAT_ALERTS === 'true';
const REPEAT_ALERT_MS = Number(process.env.MONITOR_REPEAT_ALERT_MS || 15 * 60 * 1000);
const SUMMARY_ON_START = process.env.MONITOR_SUMMARY_ON_START === 'true';
const { sendAlert } = require('../../dry/services/alert/alert.service');

let downSince = null;
let lastState = 'UNKNOWN'; // UP | DOWN | UNKNOWN
let lastAlertAt = 0;
const incidents = [];

const secondsSince = (ts) => Math.max(0, Math.floor((Date.now() - ts) / 1000));
const formatDuration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const probableCauseFromError = (err) => {
  const code = err && err.cause && err.cause.code;
  if (code === 'ENOTFOUND') return 'DNS introuvable (URL invalide ou probleme DNS)';
  if (code === 'ECONNREFUSED') return 'Serveur arrete ou port bloque';
  if (code === 'ETIMEDOUT') return 'Timeout reseau';
  return 'Erreur reseau ou serveur injoignable';
};

const probableCauseFromResponse = (status, json) => {
  if (status === 503) return 'Service indisponible (maintenance ou dependance KO)';
  if (status >= 500) return 'Erreur serveur interne ou dependance indisponible';
  if (json && json.status && json.status !== 'READY') return 'Application en demarrage ou check interne KO';
  return 'Etat non pret';
};

const recordIncident = (payload) => {
  incidents.push(payload);
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  while (incidents.length && new Date(incidents[0].timestamp).getTime() < cutoff) {
    incidents.shift();
  }
};

const summarizeIncidents = (windowMs) => {
  const since = Date.now() - windowMs;
  const items = incidents.filter((i) => new Date(i.timestamp).getTime() >= since);
  const counts = items.reduce((acc, i) => {
    acc[i.event] = (acc[i.event] || 0) + 1;
    return acc;
  }, {});
  const totalDowntimeSeconds = items.reduce((sum, i) => sum + (i.downtimeSeconds || 0), 0);
  const last = items[items.length - 1] || null;
  const summaryLines = Object.keys(counts).map((k) => `${k}: ${counts[k]}`);
  return { items, counts, totalDowntimeSeconds, last, summaryLines };
};

const sendSummary = async (eventName, windowMs, label) => {
  const summary = summarizeIncidents(windowMs);
  const payload = {
    event: eventName,
    status: 'SUMMARY',
    server: BASE,
    url: `${BASE}/health/ready`,
    tenant: TENANT_NAME,
    summaryWindow: label,
    summaryCount: summary.items.length,
    downtimeSeconds: summary.totalDowntimeSeconds,
    downtimeHuman: formatDuration(summary.totalDowntimeSeconds),
    summaryLines: summary.summaryLines,
    lastIncident: summary.last ? summary.last.event : 'NONE',
    timestamp: new Date().toISOString(),
  };
  console.log(`[monitor] SUMMARY ${label}`, payload);
  const result = await sendAlert(payload);
  if (result && result.email !== null) {
    console.log(result.email ? '[monitor] EMAIL ENVOYE' : '[monitor] EMAIL ECHEC');
  }
};

const shouldSendRepeatedAlert = () => {
  if (!REPEAT_ALERTS) return false;
  const now = Date.now();
  if (!lastAlertAt) return true;
  return now - lastAlertAt >= REPEAT_ALERT_MS;
};

const markAlertSent = () => {
  lastAlertAt = Date.now();
};

const check = async () => {
  try {
    const res = await fetch(`${BASE}/health/ready`);
    const json = await res.json().catch(() => ({}));
    if (res.status >= 400 || json.status !== 'READY') {
      if (!downSince) downSince = Date.now();
      const downtimeSeconds = secondsSince(downSince);
      const payload = {
        event: 'DRY_HEALTH_NOT_READY',
        status: json.status || 'UNKNOWN',
        http: res.status,
        server: BASE,
        url: `${BASE}/health/ready`,
        tenant: TENANT_NAME,
        downtimeSeconds,
        downtimeHuman: formatDuration(downtimeSeconds),
        downtimeStart: new Date(downSince).toISOString(),
        causeProbable: probableCauseFromResponse(res.status, json),
        timestamp: new Date().toISOString(),
      };
      const isFirstDown = lastState !== 'DOWN';
      const shouldRepeat = shouldSendRepeatedAlert();
      console.log('[monitor] NOT READY', payload);
      recordIncident(payload);
      if (isFirstDown || shouldRepeat) {
        const result = await sendAlert(payload);
        markAlertSent();
        if (result && result.email !== null) {
          console.log(result.email ? '[monitor] EMAIL ENVOYE' : '[monitor] EMAIL ECHEC');
        }
      }
      lastState = 'DOWN';
    } else {
      if (downSince) {
        const downtimeSeconds = secondsSince(downSince);
        const payload = {
          event: 'DRY_HEALTH_RECOVERED',
          status: 'READY',
          http: res.status,
          server: BASE,
          url: `${BASE}/health/ready`,
          tenant: TENANT_NAME,
          downtimeSeconds,
          downtimeHuman: formatDuration(downtimeSeconds),
          downtimeStart: new Date(downSince).toISOString(),
          downtimeEnd: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        };
        console.log('[monitor] RECOVERED', payload);
        recordIncident(payload);
        const result = await sendAlert(payload);
        markAlertSent();
        if (result && result.email !== null) {
          console.log(result.email ? '[monitor] EMAIL ENVOYE' : '[monitor] EMAIL ECHEC');
        }
        downSince = null;
      }
      console.log('[monitor] OK', new Date().toISOString());
      lastState = 'UP';
    }
  } catch (e) {
    if (!downSince) downSince = Date.now();
    const downtimeSeconds = secondsSince(downSince);
    const payload = {
      event: 'DRY_HEALTH_ERROR',
      error: e.message,
      server: BASE,
      url: `${BASE}/health/ready`,
      tenant: TENANT_NAME,
      downtimeSeconds,
      downtimeHuman: formatDuration(downtimeSeconds),
      downtimeStart: new Date(downSince).toISOString(),
      causeProbable: probableCauseFromError(e),
      timestamp: new Date().toISOString(),
    };
    const isFirstDown = lastState !== 'DOWN';
    const shouldRepeat = shouldSendRepeatedAlert();
    console.log('[monitor] ERROR', payload);
    recordIncident(payload);
    if (isFirstDown || shouldRepeat) {
      const result = await sendAlert(payload);
      markAlertSent();
      if (result && result.email !== null) {
        console.log(result.email ? '[monitor] EMAIL ENVOYE' : '[monitor] EMAIL ECHEC');
      }
    }
    lastState = 'DOWN';
  }
};

setInterval(check, INTERVAL_MS);
check();

if (ENABLE_DAILY_SUMMARY) {
  setInterval(() => sendSummary('DRY_DAILY_SUMMARY', DAILY_SUMMARY_MS, '24h'), DAILY_SUMMARY_MS);
  if (SUMMARY_ON_START) {
    sendSummary('DRY_DAILY_SUMMARY', DAILY_SUMMARY_MS, '24h');
  }
}

if (LOGS_EVERY_DAYS > 0) {
  setInterval(() => sendSummary('DRY_LOGS_SUMMARY', LOGS_SUMMARY_MS, `${LOGS_EVERY_DAYS}j`), LOGS_SUMMARY_MS);
}
