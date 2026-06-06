/**
 * Tests unitaires — Validation Joi
 * @module tests/unit/validators/joi.test
 */

const { describe, it, expect } = require('@jest/globals');
const Joi = require('joi');

describe('Validation Joi - Schémas courants', () => {
  const emailSchema = Joi.string().email().required();
  const passwordSchema = Joi.string().min(8).max(128).required();
  const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  });

  it('devrait valider un email correct', () => {
    const { error } = emailSchema.validate('user@example.com');
    expect(error).toBeUndefined();
  });

  it('devrait rejeter un email invalide', () => {
    const { error } = emailSchema.validate('email-invalide');
    expect(error).toBeDefined();
  });

  it('devrait valider un mot de passe de 8 caractères minimum', () => {
    const { error } = passwordSchema.validate('MonPassword123!');
    expect(error).toBeUndefined();
  });

  it('devrait rejeter un mot de passe trop court', () => {
    const { error } = passwordSchema.validate('Ab1');
    expect(error).toBeDefined();
  });

  it('devrait valider la pagination avec valeurs par défaut', () => {
    const { value, error } = paginationSchema.validate({});
    expect(error).toBeUndefined();
    expect(value.page).toBe(1);
    expect(value.limit).toBe(20);
  });

  it('devrait valider des paramètres de pagination explicites', () => {
    const { value, error } = paginationSchema.validate({ page: 3, limit: 50 });
    expect(error).toBeUndefined();
    expect(value.page).toBe(3);
    expect(value.limit).toBe(50);
  });

  it('devrait rejeter une page négative', () => {
    const { error } = paginationSchema.validate({ page: -1 });
    expect(error).toBeDefined();
  });
});
