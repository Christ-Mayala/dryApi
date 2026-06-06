/**
 * Tests unitaires — Module Billing
 * Couvre : plans, création de session checkout, limites
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const billing = require('../../../dry/modules/billing');

describe('Billing — Plans disponibles', () => {
  it('PLANS devrait contenir les 3 offres', () => {
    assert.ok(billing.PLANS.community);
    assert.ok(billing.PLANS.pro);
    assert.ok(billing.PLANS.enterprise);
  });

  it('PLANS.community devrait être gratuit', () => {
    assert.equal(billing.PLANS.community.price, 0);
    assert.equal(billing.PLANS.community.id, 'community');
    assert.ok(billing.PLANS.community.features.length >= 3);
    assert.equal(billing.PLANS.community.limits.requestsPerHour, 100);
    assert.equal(billing.PLANS.community.limits.apps, 1);
  });

  it('PLANS.pro devrait être à 99€/mois', () => {
    assert.equal(billing.PLANS.pro.price, 99);
    assert.equal(billing.PLANS.pro.currency, 'eur');
    assert.equal(billing.PLANS.pro.interval, 'month');
    assert.ok(billing.PLANS.pro.features.includes('Monitoring Prometheus'));
    assert.equal(billing.PLANS.pro.limits.requestsPerHour, 1000);
    assert.equal(billing.PLANS.pro.limits.apps, 10);
  });

  it('PLANS.enterprise devrait avoir un prix null (sur devis)', () => {
    assert.equal(billing.PLANS.enterprise.price, null);
    assert.equal(billing.PLANS.enterprise.limits.requestsPerHour, -1);
    assert.equal(billing.PLANS.enterprise.limits.apps, -1);
  });
});

describe('Billing — Création de session checkout', () => {
  it('createCheckoutSession() devrait rejeter un plan inconnu (avant vérifier Stripe)', async () => {
    await assert.rejects(
      async () => {
        await billing.createCheckoutSession('invalid', 'user123', 'http://ok', 'http://cancel');
      },
      { message: /Plan.*invalide/ }
    );
  });

  it('createCheckoutSession() devrait retourner une URL directe pour le plan gratuit (sans Stripe)', async () => {
    const result = await billing.createCheckoutSession('community', 'user_free', 'http://success', 'http://cancel');
    assert.equal(result.free, true);
    assert.equal(result.url, 'http://success');
    assert.equal(result.planId, 'community');
  });

  it('createCheckoutSession() devrait lancer une erreur Stripe pour les plans payants', async () => {
    await assert.rejects(
      async () => {
        await billing.createCheckoutSession('pro', 'user_paid', 'http://success', 'http://cancel');
      },
      { message: /Stripe.*configur/ }
    );
  });
});

describe('Billing — Vérification des limites', () => {
  it("checkPlanLimit() devrait utiliser le plan 'community' par défaut", () => {
    const user = {};
    const result = billing.checkPlanLimit(user);
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 100);
  });

  it("checkPlanLimit() devrait respecter le plan de l'utilisateur", () => {
    const user = { plan: 'pro' };
    const result = billing.checkPlanLimit(user, 'requestsPerHour');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, 1000);
  });

  it("checkPlanLimit() devrait donner l'illimité pour Enterprise", () => {
    const user = { plan: 'enterprise' };
    const result = billing.checkPlanLimit(user, 'requestsPerHour');
    assert.equal(result.allowed, true);
    assert.equal(result.limit, Infinity);
  });

  it('checkPlanLimit() devrait vérifier la limite d\'apps', () => {
    const community = billing.checkPlanLimit({ plan: 'community' }, 'apps');
    assert.equal(community.limit, 1);

    const pro = billing.checkPlanLimit({ plan: 'pro' }, 'apps');
    assert.equal(pro.limit, 10);

    const enterprise = billing.checkPlanLimit({ plan: 'enterprise' }, 'apps');
    assert.equal(enterprise.limit, Infinity);
  });

  it("checkPlanLimit() devrait retourner un refus sûr pour un plan inconnu", () => {
    const result = billing.checkPlanLimit({ plan: 'unknown' });
    assert.equal(result.allowed, false);
    assert.equal(result.limit, 0);
  });
});

describe('Billing — Fonctionnalités des plans', () => {
  it("Le plan Community devrait avoir les fonctionnalités de base", () => {
    const features = billing.PLANS.community.features;
    assert.ok(features.includes('API de base'));
    assert.ok(features.includes('Documentation Swagger'));
    assert.ok(features.includes('Support communautaire'));
  });

  it("Le plan Pro devrait étendre Community", () => {
    const features = billing.PLANS.pro.features;
    assert.ok(features.includes('API complète'));
    assert.ok(features.includes('Support prioritaire'));
    assert.ok(features.includes('Clés API illimitées'));
  });

  it("Le plan Enterprise devrait inclure SLA et support dédié", () => {
    const features = billing.PLANS.enterprise.features;
    assert.ok(features.includes('SLA 99.9%'));
    assert.ok(features.includes('Support dédié 24/7'));
    assert.ok(features.includes('Déploiement personnalisé'));
  });
});
