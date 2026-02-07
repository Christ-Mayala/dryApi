const express = require('express');

const router = express.Router();
const rateLimit = require('express-rate-limit');
const Joi = require('joi');
const passwordResetService = require('../../services/auth/passwordReset.service');
const TenantValidationService = require('../../services/auth/tenantValidation.service');
const sendResponse = require('../../utils/http/response');
const logger = require('../../utils/logging/logger');

const tenantValidator = (req, res, next) => {
  return TenantValidationService.tenantValidator(req, res, next);
};

const resolveTenant = (req) => req.params.tenant || req.appName || req.validatedTenant;

// Middleware de rate limiting pour la securite
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Trop de tentatives de reinitialisation. Veuillez reessayer dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Schemas de validation Joi
const requestResetSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': "L'email est requis",
  }),
});

const verifyCodeSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': "L'email est requis",
  }),
  code: Joi.string().length(8).pattern(/^[A-Z0-9]+$/).required().messages({
    'string.length': 'Le code doit contenir 8 caracteres',
    'string.pattern.base': 'Le code ne doit contenir que des lettres majuscules et des chiffres',
    'any.required': 'Le code est requis',
  }),
});

const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email invalide',
    'any.required': "L'email est requis",
  }),
  code: Joi.string().length(8).pattern(/^[A-Z0-9]+$/).required().messages({
    'string.length': 'Le code doit contenir 8 caracteres',
    'string.pattern.base': 'Le code ne doit contenir que des lettres majuscules et des chiffres',
    'any.required': 'Le code est requis',
  }),
  newPassword: Joi.string().min(8).required().messages({
    'string.min': 'Le mot de passe doit contenir au moins 8 caracteres',
    'any.required': 'Le nouveau mot de passe est requis',
  }),
});

// Middleware de validation
const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    const message = error.details[0].message;
    return sendResponse(res, null, message, false);
  }
  next();
};

// Routes avec parametre tenant (compat)
router.post('/:tenant/password-reset/request', tenantValidator, passwordResetLimiter, validateRequest(requestResetSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.requestPasswordReset(email, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/:tenant/password-reset/verify', tenantValidator, validateRequest(verifyCodeSchema), async (req, res) => {
  try {
    const { email, code } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.verifyResetCode(email, code, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/:tenant/password-reset/reset', tenantValidator, validateRequest(resetPasswordSchema), async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.resetPassword(email, code, newPassword, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/:tenant/password-reset/status', tenantValidator, validateRequest(requestResetSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.getResetStatus(email, tenant);
    return sendResponse(res, result, 'Statut recupere avec succes', true);
  } catch (error) {
    logger(`Erreur verification statut: ${error.message}`, 'error');
    return sendResponse(res, null, error.message, false);
  }
});

// Routes sans parametre tenant (injecte par appRouter)
router.post('/password-reset/request', tenantValidator, passwordResetLimiter, validateRequest(requestResetSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.requestPasswordReset(email, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/password-reset/verify', tenantValidator, validateRequest(verifyCodeSchema), async (req, res) => {
  try {
    const { email, code } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.verifyResetCode(email, code, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/password-reset/reset', tenantValidator, validateRequest(resetPasswordSchema), async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.resetPassword(email, code, newPassword, tenant);
    return sendResponse(res, result, result.message, result.success);
  } catch (error) {
    return sendResponse(res, null, error.message, false);
  }
});

router.post('/password-reset/status', tenantValidator, validateRequest(requestResetSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const tenant = resolveTenant(req);
    const result = await passwordResetService.getResetStatus(email, tenant);
    return sendResponse(res, result, 'Statut recupere avec succes', true);
  } catch (error) {
    logger(`Erreur verification statut: ${error.message}`, 'error');
    return sendResponse(res, null, error.message, false);
  }
});

module.exports = router;
