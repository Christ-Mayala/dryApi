const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const logger = require('../../utils/logging/logger');
const config = require('../../../config/database');

class EmailService {
  constructor() {
    this.transporter = null;
    this.provider = 'none';
    this.templateDir = path.join(__dirname, '..', '..', 'templates', 'email');
    this.lastError = null;
    this.initializeTransporter();
  }

  resolveProvider() {
    const raw = (config.EMAIL_PROVIDER || 'auto').toLowerCase();
    if (raw === 'smtp' || raw === 'resend') return raw;
    return 'auto';
  }

  initializeTransporter() {
    try {
      const provider = this.resolveProvider();
      const emailConfig = {
        host: config.EMAIL_HOST || 'smtp.gmail.com',
        port: config.EMAIL_PORT || 587,
        secure: config.EMAIL_SECURE === 'true',
        auth: {
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASS,
        },
      };

      if (provider === 'resend') {
        if (!config.RESEND_API_KEY) {
          logger('Email service RESEND demande mais RESEND_API_KEY manquant', 'warning');
          this.provider = 'none';
          this.transporter = null;
          return;
        }
        this.provider = 'resend';
        this.transporter = null;
        logger('Email service configure avec Resend API', 'info');
        return;
      }

      if (config.NODE_ENV === 'development' && !config.EMAIL_USER && provider !== 'smtp') {
        this.transporter = nodemailer.createTestAccount().then((testAccount) => {
          return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
        });
        this.provider = 'ethereal';
        logger('Email service configure avec Ethereal (developpement)', 'info');
      } else if (config.EMAIL_USER && config.EMAIL_PASS) {
        this.transporter = nodemailer.createTransport(emailConfig);
        this.provider = 'smtp';
        logger('Email service configure avec SMTP', 'info');
      } else if (provider === 'auto' && config.RESEND_API_KEY) {
        this.provider = 'resend';
        this.transporter = null;
        logger('Email service configure avec Resend API', 'info');
      } else {
        logger('Email service non configure - mode simulation', 'warning');
        this.provider = 'none';
        this.transporter = null;
      }
    } catch (error) {
      logger(`Erreur initialisation email service: ${error.message}`, 'error');
      this.provider = 'none';
      this.transporter = null;
    }
  }

  loadTemplate(filename) {
    try {
      const filePath = path.join(this.templateDir, filename);
      if (!fs.existsSync(filePath)) return null;
      return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      return null;
    }
  }

  renderTemplate(raw, vars = {}) {
    let out = raw || '';
    Object.keys(vars).forEach((key) => {
      const value = vars[key] == null ? '' : String(vars[key]);
      out = out.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return out;
  }

  async sendViaResend(options) {
    const apiKey = config.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY manquant');

    const from = config.EMAIL_FROM || 'onboarding@resend.dev';
    const payload = {
      from,
      to: [options.email],
      subject: options.subject || 'Notification',
      html: options.html || '<p>Notification</p>',
      text: options.text,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const message = data && (data.message || data.error);
      const err = new Error(message || `Resend HTTP ${response.status}`);
      err.code = 'RESEND_HTTP_ERROR';
      err.httpStatus = response.status;
      err.responseBody = data;
      throw err;
    }

    return true;
  }

  async sendGenericEmail(options) {
    try {
      if (!options || !options.email) {
        const err = new Error('Adresse email destination manquante');
        err.code = 'EMAIL_MISSING_DESTINATION';
        throw err;
      }

      this.lastError = null;

      if (this.provider === 'resend') {
        await this.sendViaResend(options);
        logger(`Email envoye via Resend a ${options.email}`, 'info');
        return true;
      }

      if (!this.transporter) {
        logger(`Email simulation -> ${options.email} | ${options.subject || 'Sans sujet'}`, 'info');
        return true;
      }

      const mailOptions = {
        from:
          config.EMAIL_FROM ||
          `"${config.APP_NAME || 'DRY API'}" <${config.EMAIL_USER}>`,
        to: options.email,
        subject: options.subject || 'Notification',
        html: options.html || '<p>Notification</p>',
        text: options.text,
      };

      let transporter = this.transporter;
      if (transporter && typeof transporter.then === 'function') {
        transporter = await transporter;
      }

      const result = await transporter.sendMail(mailOptions);

      if (config.NODE_ENV === 'development' && result.messageId) {
        logger(`Email envoye (preview): ${nodemailer.getTestMessageUrl(result)}`, 'info');
      } else {
        logger(`Email envoye a ${options.email}`, 'info');
      }

      return true;
    } catch (error) {
      this.lastError = {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        code: error?.code || error?.errno || error?.type,
        status: error?.status || error?.statusCode || error?.httpStatus,
        stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 12).join('\n') : undefined,
        responseBody: error?.responseBody || error?.response?.data,
      };

      const details = [
        this.lastError.message,
        this.lastError.code ? `code=${this.lastError.code}` : null,
        this.lastError.status ? `status=${this.lastError.status}` : null,
      ].filter(Boolean).join(' | ');

      logger(`Erreur envoi email: ${details}`, 'error');

      if (options?.throwOnError) {
        throw error;
      }
      return false;
    }
  }

  getLastError() {
    return this.lastError;
  }

  async sendPasswordResetEmail(email, resetCode, tenantId) {
    try {
      if (!email || !resetCode) return { success: false, message: 'Parametres invalides' };

      const subject = 'Reinitialisation de votre mot de passe';
      const html = this.generatePasswordResetTemplate(resetCode, tenantId);

      const ok = await this.sendGenericEmail({
        email,
        subject,
        html,
        text: `Votre code de reinitialisation de mot de passe est: ${resetCode}. Ce code expire dans 15 minutes.`,
      });

      return { success: !!ok, messageId: ok ? 'sent' : 'failed' };
    } catch (error) {
      logger(`Erreur envoi email reinitialisation: ${error.message}`, 'error');
      logger(`CODE RESET (fallback): ${resetCode}`, 'info');
      return { success: true, messageId: 'fallback-mode', code: resetCode };
    }
  }

  async sendPasswordResetConfirmationEmail(email, tenantId) {
    try {
      if (!email) return { success: false, message: 'Email requis' };

      const subject = 'Votre mot de passe a ete reinitialise';
      const html = this.generatePasswordResetConfirmationTemplate(tenantId);

      const ok = await this.sendGenericEmail({
        email,
        subject,
        html,
        text: 'Votre mot de passe a ete reinitialise avec succes. Si vous n\'avez pas effectue cette action, contactez le support.',
      });

      return { success: !!ok, messageId: ok ? 'sent' : 'failed' };
    } catch (error) {
      logger(`Erreur envoi email confirmation: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  generatePasswordResetTemplate(resetCode, tenantId) {
    const appName = config.APP_NAME || 'DRY API';
    const appUrl = config.FRONTEND_URL || 'http://localhost:4200';
    const raw = this.loadTemplate('password-reset.html');

    if (!raw) {
      return `<p>Code reset: ${resetCode}</p>`;
    }

    return this.renderTemplate(raw, {
      APP_NAME: appName,
      APP_URL: appUrl,
      TENANT_ID: tenantId || 'APP',
      RESET_CODE: resetCode,
      YEAR: new Date().getFullYear(),
    });
  }

  generatePasswordResetConfirmationTemplate(tenantId) {
    const appName = config.APP_NAME || 'DRY API';
    const appUrl = config.FRONTEND_URL || 'http://localhost:4200';
    const raw = this.loadTemplate('password-reset-confirmation.html');

    if (!raw) {
      return `<p>Mot de passe reinitialise</p>`;
    }

    return this.renderTemplate(raw, {
      APP_NAME: appName,
      APP_URL: appUrl,
      TENANT_ID: tenantId || 'APP',
      YEAR: new Date().getFullYear(),
    });
  }

  async verifyConfiguration() {
    try {
      if (this.provider === 'resend') {
        if (!config.RESEND_API_KEY) {
          return { configured: false, error: 'RESEND_API_KEY manquant' };
        }
        return { configured: true };
      }

      if (!this.transporter) {
        return { configured: false, error: 'Transporteur non configure' };
      }

      let transporter = this.transporter;
      if (transporter && typeof transporter.then === 'function') {
        transporter = await transporter;
      }

      await transporter.verify();
      return { configured: true };
    } catch (error) {
      return { configured: false, error: error.message };
    }
  }
}

module.exports = new EmailService();
