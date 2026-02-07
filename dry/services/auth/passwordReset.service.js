const bcrypt = require('bcryptjs');
const { getTenantDB } = require('../../config/connection/dbConnection');
const getModel = require('../../core/factories/modelFactory');
const emailService = require('./email.service');
const logger = require('../../utils/logging/logger');
const redisService = require('../../services/cache/redis.service');

class PasswordResetService {
  constructor() {
    this.CODE_LENGTH = 8;
    this.CODE_EXPIRY = 15 * 60 * 1000; // 15 minutes
  }

  // Choix du stockage (Redis si connecte, sinon memoire)
  getStorage() {
    return redisService.getStatus().connected ? 'redis' : 'memory';
  }

  async storeResetData(userId, resetData) {
    const key = `reset:${userId}`;
    const storage = this.getStorage();

    if (storage === 'redis') {
      await redisService.client.setEx(key, Math.ceil(this.CODE_EXPIRY / 1000), JSON.stringify(resetData));
    } else {
      if (!this.resetCodes) this.resetCodes = new Map();
      this.resetCodes.set(userId, resetData);
    }
  }

  async getResetData(userId) {
    const key = `reset:${userId}`;
    const storage = this.getStorage();

    if (storage === 'redis') {
      const data = await redisService.client.get(key);
      return data ? JSON.parse(data) : null;
    }

    if (!this.resetCodes) this.resetCodes = new Map();
    return this.resetCodes.get(userId) || null;
  }

  async deleteResetData(userId) {
    const key = `reset:${userId}`;
    const storage = this.getStorage();

    if (storage === 'redis') {
      await redisService.client.del(key);
    } else {
      if (!this.resetCodes) this.resetCodes = new Map();
      this.resetCodes.delete(userId);
    }
  }

  generateResetCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async requestPasswordReset(email, tenantId) {
    try {
      if (!email || !email.includes('@')) {
        throw new Error('Email invalide');
      }

      const db = getTenantDB(tenantId);
      if (!db) {
        throw new Error('Tenant non trouve');
      }

      const UserSchema = require('../../modules/user/user.schema');
      let User;
      try {
        User = getModel(tenantId, 'User');
      } catch (error) {
        User = db.model('User', UserSchema);
      }

      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        status: 'active',
      });

      // Ne pas reveler si l'email existe ou non
      if (!user) {
        logger(`Tentative reset pour email non trouve: ${email}`, 'warning');
        return {
          success: true,
          message: 'Si cet email existe, un code de reinitialisation a ete envoye',
        };
      }

      const existingResetData = await this.getResetData(user._id.toString());
      if (existingResetData && new Date() <= new Date(existingResetData.expiresAt)) {
        const now = new Date();
        const expiresAt = new Date(existingResetData.expiresAt);
        const timeRemaining = Math.ceil((expiresAt - now) / (1000 * 60));

        logger(`Code reset deja envoye a ${user.email} - reste ${timeRemaining} min`, 'warning');

        return {
          success: true,
          message: `Un code de reinitialisation a deja ete envoye. Attendez ${timeRemaining} minute(s).`,
          codeAlreadySent: true,
          expiresAt: existingResetData.expiresAt,
          timeRemaining,
          email: user.email,
        };
      }

      const resetCode = this.generateResetCode();
      const hashedCode = await bcrypt.hash(resetCode, 12);

      logger(`Nouveau code reset genere pour ${user.email}`, 'info');

      const resetData = {
        userId: user._id.toString(),
        email: user.email,
        code: hashedCode,
        tenantId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.CODE_EXPIRY),
        attempts: 0,
        maxAttempts: 3,
      };

      await this.deleteResetData(user._id.toString());
      await this.storeResetData(user._id.toString(), resetData);

      // Envoi email (template commun pour toutes les apps)
      try {
        const emailResult = await emailService.sendPasswordResetEmail(user.email, resetCode, tenantId);

        if (emailResult && emailResult.success) {
          logger(`Email reset envoye a ${user.email}`, 'success');
        } else {
          logger(`Email non envoye (mode simulation) - Code: ${resetCode} pour ${user.email}`, 'warning');
        }
      } catch (emailError) {
        logger(`Erreur envoi email: ${emailError.message} - Code secours: ${resetCode} pour ${user.email}`, 'error');
      }

      return {
        success: true,
        message: 'Un code de reinitialisation a ete envoye a votre email',
        codeAlreadySent: false,
        expiresAt: resetData.expiresAt,
        timeRemaining: 15,
        email: user.email,
      };
    } catch (error) {
      logger(`Erreur demande reset: ${error.message}`, 'error');
      throw new Error('Erreur lors de la demande de reinitialisation');
    }
  }

  async verifyResetCode(email, code, tenantId) {
    try {
      const db = getTenantDB(tenantId);
      if (!db) {
        throw new Error('Tenant non trouve');
      }

      const UserSchema = require('../../modules/user/user.schema');
      let User;
      try {
        User = getModel(tenantId, 'User');
      } catch (error) {
        User = db.model('User', UserSchema);
      }

      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        status: 'active',
      });

      if (!user) {
        throw new Error('Utilisateur non trouve');
      }

      const resetData = await this.getResetData(user._id.toString());
      if (!resetData) {
        throw new Error('Code invalide ou expire');
      }

      if (new Date() > new Date(resetData.expiresAt)) {
        await this.deleteResetData(user._id.toString());
        throw new Error('Code expire');
      }

      if (resetData.attempts >= resetData.maxAttempts) {
        await this.deleteResetData(user._id.toString());
        throw new Error('Nombre de tentatives depasse');
      }

      const isValidCode = await bcrypt.compare(code, resetData.code);
      if (!isValidCode) {
        resetData.attempts++;
        await this.storeResetData(user._id.toString(), resetData);
        const remaining = resetData.maxAttempts - resetData.attempts;
        throw new Error(`Code invalide. ${remaining} tentative(s) restante(s)`);
      }

      resetData.verified = true;
      resetData.verifiedAt = new Date();
      await this.storeResetData(user._id.toString(), resetData);

      return {
        success: true,
        message: 'Code verifie avec succes',
        userId: user._id,
      };
    } catch (error) {
      logger(`Erreur verification code: ${error.message}`, 'error');
      throw error;
    }
  }

  async resetPassword(email, code, newPassword, tenantId) {
    try {
      if (!newPassword || newPassword.length < 8) {
        throw new Error('Le mot de passe doit contenir au moins 8 caracteres');
      }

      const verification = await this.verifyResetCode(email, code, tenantId);
      if (!verification.success) {
        throw new Error('Code invalide');
      }

      const db = getTenantDB(tenantId);
      const UserSchema = require('../../modules/user/user.schema');
      let User;
      try {
        User = getModel(tenantId, 'User');
      } catch (error) {
        User = db.model('User', UserSchema);
      }

      const user = await User.findById(verification.userId);
      if (!user) {
        throw new Error('Utilisateur non trouve');
      }

      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();

      await this.deleteResetData(user._id.toString());

      await emailService.sendPasswordResetConfirmationEmail(user.email, tenantId);

      logger(`Mot de passe reinitialise pour ${user.email}`, 'success');

      return {
        success: true,
        message: 'Mot de passe reinitialise avec succes',
      };
    } catch (error) {
      logger(`Erreur reinitialisation mot de passe: ${error.message}`, 'error');
      throw error;
    }
  }

  // Nettoyage (memoire uniquement)
  cleanupExpiredCodes() {
    if (this.getStorage() === 'redis') {
      return;
    }

    const now = new Date();
    let cleanedCount = 0;

    if (!this.resetCodes) this.resetCodes = new Map();

    for (const [userId, resetData] of this.resetCodes.entries()) {
      if (now > new Date(resetData.expiresAt)) {
        this.resetCodes.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger(`Nettoyage de ${cleanedCount} codes expires`, 'info');
    }
  }

  cleanupUserCodes(userId) {
    this.deleteResetData(userId);
  }

  async getResetStatus(email, tenantId) {
    try {
      const db = getTenantDB(tenantId);
      const UserSchema = require('../../modules/user/user.schema');
      let User;
      try {
        User = getModel(tenantId, 'User');
      } catch (error) {
        User = db.model('User', UserSchema);
      }

      const user = await User.findOne({
        email: email.toLowerCase().trim(),
        status: 'active',
      });

      if (!user) {
        return { exists: false };
      }

      const resetData = await this.getResetData(user._id.toString());
      if (!resetData) {
        return { exists: true, hasPendingReset: false };
      }

      const isExpired = new Date() > new Date(resetData.expiresAt);
      if (isExpired) {
        await this.deleteResetData(user._id.toString());
        return { exists: true, hasPendingReset: false };
      }

      return {
        exists: true,
        hasPendingReset: true,
        expiresAt: resetData.expiresAt,
        attempts: resetData.attempts,
        maxAttempts: resetData.maxAttempts,
        verified: resetData.verified || false,
      };
    } catch (error) {
      logger(`Erreur verification statut: ${error.message}`, 'error');
      throw error;
    }
  }
}

const passwordResetService = new PasswordResetService();
setInterval(() => {
  passwordResetService.cleanupExpiredCodes();
}, 5 * 60 * 1000);

module.exports = passwordResetService;

