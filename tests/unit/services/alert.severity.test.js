/**
 * Tests unitaires — Résolution de sévérité des alertes
 * @module tests/unit/services/alert.severity.test
 *
 * Régression : en production, une erreur API 500 (ex: YouTube "Sign in to confirm
 * you're not a bot") était envoyée en `warning` car sendAlert ignorait
 * `payload.severity` et ne déduisait pas la sévérité depuis l'erreur.
 */

jest.mock('../../../dry/utils/logging/logger', () => jest.fn());
jest.mock('../../../dry/services/auth/email.service', () => ({
  provider: 'none',
  sendGenericEmail: jest.fn().mockResolvedValue({ success: true }),
}));

describe('Résolution de sévérité des alertes', () => {
  let alertService;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.SESSION_SECRET = 'b'.repeat(32);
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_CHAT_ID = '';
    process.env.CALLMEBOT_API_KEY = '';
    process.env.CALLMEBOT_PHONE = '';
    process.env.ALERT_EMAIL_TO = '';
    process.env.ALERT_WEBHOOK_URL = '';
    process.env.ALERT_DEDUP_WINDOW_MS = '0';

    jest.resetModules();
    alertService = require('../../../dry/services/alert/alert.service');
  });

  describe('inferSeverity', () => {
    it('déduit critical pour une erreur 5xx sans sévérité fournie', () => {
      const sev = alertService.inferSeverity({
        event: 'DRY_API_EXCEPTION',
        errorDetails: { status: 500, name: 'Error' },
      });
      expect(sev).toBe('critical');
    });

    it('déduit critical pour une erreur réseau (ECONNREFUSED)', () => {
      const sev = alertService.inferSeverity({
        event: 'DRY_API_EXCEPTION',
        errorDetails: { code: 'ECONNREFUSED', name: 'MongoNetworkError' },
      });
      expect(sev).toBe('critical');
    });

    it('déduit critical pour les événements fatals', () => {
      expect(alertService.inferSeverity({ event: 'DRY_UNCAUGHT_EXCEPTION' })).toBe('critical');
      expect(alertService.inferSeverity({ event: 'DRY_UNHANDLED_REJECTION' })).toBe('critical');
      expect(alertService.inferSeverity({ event: 'DRY_HEALTH_ERROR' })).toBe('critical');
    });

    it('déduit info pour les rétablissements et résumés', () => {
      expect(alertService.inferSeverity({ event: 'DRY_HEALTH_RECOVERED' })).toBe('info');
      expect(alertService.inferSeverity({ event: 'DRY_DAILY_SUMMARY' })).toBe('info');
    });

    it('déduit warning pour une erreur client 4xx', () => {
      const sev = alertService.inferSeverity({
        event: 'DRY_API_EXCEPTION',
        errorDetails: { status: 400, name: 'Error' },
      });
      expect(sev).toBe('warning');
    });

    it('déduit warning par défaut quand rien ne signale une erreur serveur', () => {
      expect(alertService.inferSeverity({ event: 'DRY_API_EXCEPTION', status: 'ERROR' })).toBe('warning');
    });
  });

  describe('getSeverityChannels — résumés quotidiens par email', () => {
    it('active l\'email pour un résumé quotidien en sévérité info', async () => {
      const channels = await alertService.getSeverityChannels('info', 'DRY_DAILY_SUMMARY');
      expect(channels.email).toBe(true);
      expect(channels.telegram).toBe(true);
    });

    it('active l\'email pour un résumé de logs en sévérité info', async () => {
      const channels = await alertService.getSeverityChannels('info', 'DRY_LOGS_SUMMARY');
      expect(channels.email).toBe(true);
    });

    it('ne réactive PAS l\'email pour une info simple (anti-spam conservé)', async () => {
      const channels = await alertService.getSeverityChannels('info', 'DRY_HEALTH_RECOVERED');
      expect(channels.email).toBe(false);
      expect(channels.telegram).toBe(true);
    });

    it('garde l\'email pour les warning et critical', async () => {
      const warn = await alertService.getSeverityChannels('warning', 'DRY_API_EXCEPTION');
      const crit = await alertService.getSeverityChannels('critical', 'DRY_API_EXCEPTION');
      expect(warn.email).toBe(true);
      expect(crit.email).toBe(true);
    });
  });

  describe('shouldSendBySeverity — heures calmes', () => {
    it('envoie les résumés quotidiens même pendant les heures calmes', () => {
      // Vérifie le bypass inconditionnel : un résumé planifié doit partir
      // quel que soit l'état des heures calmes (dépendantes de l'horloge).
      expect(alertService.shouldSendBySeverity('info', 'DRY_DAILY_SUMMARY')).toBe(true);
    });
  });

  describe('sendAlert', () => {
    it('respecte la sévérité passée explicitement (2e argument)', async () => {
      const result = await alertService.sendAlert(
        { event: 'DRY_API_EXCEPTION', dedupKey: 'sev-explicit', timestamp: new Date().toISOString() },
        'info'
      );
      expect(result.severity).toBe('info');
    });

    it("respecte payload.severity quand l'argument est absent (cas health-monitor)", async () => {
      const result = await alertService.sendAlert({
        event: 'DRY_HEALTH_ALERT',
        severity: 'critical',
        dedupKey: 'sev-in-payload',
        timestamp: new Date().toISOString(),
      });
      expect(result.severity).toBe('critical');
    });

    it("déduit critical depuis l'erreur 5xx quand rien n'est fourni (cas MediaDL)", async () => {
      const result = await alertService.sendAlert({
        event: 'DRY_API_EXCEPTION',
        dedupKey: 'sev-media-500',
        status: 'ERROR',
        error: Object.assign(new Error('Sign in to confirm you are not a bot'), { status: 500 }),
        timestamp: new Date().toISOString(),
      });
      expect(result.severity).toBe('critical');
    });
  });

  describe('inferProbableCause — blocage YouTube', () => {
    it("explique le CAPTCHA anti-bot de YouTube", () => {
      const cause = alertService.inferProbableCause({
        name: 'Error',
        code: '',
        status: 500,
        message: 'Sign in to confirm you are not a bot',
      });
      expect(cause).toContain('YouTube');
      expect(cause.toLowerCase()).toContain('proxy');
    });
  });
});
