/**
 * Tests unitaires — Validation Zod
 * @module tests/unit/validators/zod.test
 */

const { describe, it, expect } = require('@jest/globals');

describe('Validation Zod - Schémas utilisateur', () => {
  let createUserSchema;

  beforeAll(() => {
    createUserSchema = require('../../../dry/schemas/user.schema').createUserSchema;
  });

  it('devrait valider un utilisateur correct', () => {
    const result = createUserSchema.safeParse({
      name: 'Jean Dupont',
      email: 'jean@example.com',
      password: 'MonPassword123',
      role: 'user',
    });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un email invalide', () => {
    const result = createUserSchema.safeParse({
      name: 'Jean',
      email: 'pas-un-email',
      password: 'MonPassword123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('email');
    }
  });

  it('devrait rejeter un mot de passe trop faible', () => {
    const result = createUserSchema.safeParse({
      name: 'Jean',
      email: 'jean@test.com',
      password: '12345678',
    });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un nom trop court', () => {
    const result = createUserSchema.safeParse({
      name: 'J',
      email: 'jean@test.com',
      password: 'MonPassword123',
    });
    expect(result.success).toBe(false);
  });

  it('devrait définir le rôle par défaut à user', () => {
    const result = createUserSchema.safeParse({
      name: 'Jean',
      email: 'jean@test.com',
      password: 'MonPassword123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('user');
    }
  });
});

describe('Validation Zod - Schémas conversation', () => {
  let createConversationSchema;

  beforeAll(() => {
    createConversationSchema = require('../../../dry/schemas/conversation.schema').createConversationSchema;
  });

  it('devrait valider une conversation correcte', () => {
    const result = createConversationSchema.safeParse({
      title: 'Mon assistant IA',
      model: 'gpt-4',
    });
    expect(result.success).toBe(true);
  });

  it('devrait rejeter un modèle invalide', () => {
    const result = createConversationSchema.safeParse({
      title: 'Test',
      model: 'modele-inexistant',
    });
    expect(result.success).toBe(false);
  });

  it('devrait rejeter un titre vide', () => {
    const result = createConversationSchema.safeParse({
      title: '',
      model: 'gpt-4',
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation Zod - Schémas clé API', () => {
  let createApiKeySchema;

  beforeAll(() => {
    createApiKeySchema = require('../../../dry/schemas/apiKey.schema').createApiKeySchema;
  });

  it('devrait valider une clé API correcte', () => {
    const result = createApiKeySchema.safeParse({
      name: 'Ma clé de production',
      permissions: ['read', 'write'],
    });
    expect(result.success).toBe(true);
  });

  it('devrait définir les permissions par défaut à [read]', () => {
    const result = createApiKeySchema.safeParse({
      name: 'Clé test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.permissions).toEqual(['read']);
    }
  });

  it('devrait rejeter des permissions invalides', () => {
    const result = createApiKeySchema.safeParse({
      name: 'Test',
      permissions: ['superadmin'],
    });
    expect(result.success).toBe(false);
  });
});
