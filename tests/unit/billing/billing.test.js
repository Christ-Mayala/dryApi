/**
 * Tests unitaires — Module Billing
 */

const billing = require('../../../dry/modules/billing');

describe('Billing — Plans disponibles', () => {
  it('PLANS devrait contenir les 3 offres', () => {
    expect(billing.PLANS.community).toBeDefined();
    expect(billing.PLANS.pro).toBeDefined();
    expect(billing.PLANS.enterprise).toBeDefined();
  });

  it('PLANS.community devrait être gratuit', () => {
    expect(billing.PLANS.community.price).toBe(0);
    expect(billing.PLANS.community.id).toBe('community');
    expect(billing.PLANS.community.limits.requestsPerHour).toBe(100);
    expect(billing.PLANS.community.limits.apps).toBe(1);
  });

  it('PLANS.pro devrait être à 99€/mois', () => {
    expect(billing.PLANS.pro.price).toBe(99);
    expect(billing.PLANS.pro.currency).toBe('eur');
    expect(billing.PLANS.pro.interval).toBe('month');
    expect(billing.PLANS.pro.limits.requestsPerHour).toBe(1000);
    expect(billing.PLANS.pro.limits.apps).toBe(10);
  });

  it('PLANS.enterprise devrait avoir un prix null (sur devis)', () => {
    expect(billing.PLANS.enterprise.price).toBeNull();
    expect(billing.PLANS.enterprise.limits.requestsPerHour).toBe(-1);
    expect(billing.PLANS.enterprise.limits.apps).toBe(-1);
  });
});

describe('Billing — Création de session checkout', () => {
  it('createCheckoutSession() devrait rejeter un plan inconnu', async () => {
    await expect(
      billing.createCheckoutSession('invalid', 'user123', 'http://ok', 'http://cancel')
    ).rejects.toThrow(/Plan.*invalide/);
  });

  it('createCheckoutSession() devrait retourner une URL directe pour le plan gratuit', async () => {
    const result = await billing.createCheckoutSession('community', 'user_free', 'http://success', 'http://cancel');
    expect(result.free).toBe(true);
    expect(result.url).toBe('http://success');
    expect(result.planId).toBe('community');
  });

  it('createCheckoutSession() devrait lancer une erreur Stripe pour les plans payants', async () => {
    await expect(
      billing.createCheckoutSession('pro', 'user_paid', 'http://success', 'http://cancel')
    ).rejects.toThrow(/Stripe.*configur/);
  });
});

describe('Billing — Vérification des limites', () => {
  it("checkPlanLimit() devrait utiliser le plan 'community' par défaut", () => {
    const result = billing.checkPlanLimit({});
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(100);
  });

  it("checkPlanLimit() devrait respecter le plan de l'utilisateur", () => {
    const result = billing.checkPlanLimit({ plan: 'pro' }, 'requestsPerHour');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(1000);
  });

  it("checkPlanLimit() devrait donner l'illimité pour Enterprise", () => {
    const result = billing.checkPlanLimit({ plan: 'enterprise' }, 'requestsPerHour');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Infinity);
  });

  it('checkPlanLimit() devrait vérifier la limite d\'apps', () => {
    expect(billing.checkPlanLimit({ plan: 'community' }, 'apps').limit).toBe(1);
    expect(billing.checkPlanLimit({ plan: 'pro' }, 'apps').limit).toBe(10);
    expect(billing.checkPlanLimit({ plan: 'enterprise' }, 'apps').limit).toBe(Infinity);
  });

  it("checkPlanLimit() devrait retourner un refus pour un plan inconnu", () => {
    const result = billing.checkPlanLimit({ plan: 'unknown' });
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(0);
  });
});

describe('Billing — Fonctionnalités des plans', () => {
  it('Le plan Community devrait avoir les fonctionnalités de base', () => {
    const features = billing.PLANS.community.features;
    expect(features).toContain('API de base');
    expect(features).toContain('Documentation Swagger');
    expect(features).toContain('Support communautaire');
  });

  it('Le plan Pro devrait étendre Community', () => {
    const features = billing.PLANS.pro.features;
    expect(features).toContain('API complète');
    expect(features).toContain('Support prioritaire');
    expect(features).toContain('Clés API illimitées');
  });

  it('Le plan Enterprise devrait inclure SLA et support dédié', () => {
    const features = billing.PLANS.enterprise.features;
    expect(features).toContain('SLA 99.9%');
    expect(features).toContain('Support dédié 24/7');
    expect(features).toContain('Déploiement personnalisé');
  });
});
