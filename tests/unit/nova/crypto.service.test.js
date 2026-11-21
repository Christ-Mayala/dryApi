const crypto = require('crypto');

describe('crypto.service — secrets NOVA au repos', () => {
  let service;

  beforeEach(() => {
    jest.resetModules();
    process.env.NOVA_CONNECTION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    service = require('../../../dryApp/Nova/services/crypto.service');
  });

  it('chiffre les secrets et les déchiffre pour les services internes', () => {
    const config = {
      webhook: 'https://hooks.slack.com/services/T/B/XYZ',
      jeton: 'secret-token',
      type: 'slack',
    };
    const chiffree = service.chiffrerConfig(config);

    expect(JSON.stringify(chiffree)).not.toContain('secret-token');
    expect(JSON.stringify(chiffree)).not.toContain('hooks.slack.com');
    expect(service.dechiffrerConfig(chiffree)).toEqual(config);
  });

  it('chiffre aussi les secrets imbriqués', () => {
    const config = { titre: 'Slack', details: { accessToken: 'nested-secret' } };
    const chiffree = service.chiffrerConfig(config);
    expect(JSON.stringify(chiffree)).not.toContain('nested-secret');
    expect(service.dechiffrerConfig(chiffree)).toEqual(config);
    expect(service.masquerConfig(chiffree)).toEqual({
      titre: 'Slack',
      details: { accessToken: '••••••••' },
    });
  });

  it('masque les secrets dans les réponses API', () => {
    const masquee = service.masquerConfig({ webhook: 'https://secret', nom: 'Slack' });
    expect(masquee).toEqual({ webhook: '••••••••', nom: 'Slack' });
  });

  it('refuse d’écrire ou lire un secret sans clé de chiffrement', () => {
    jest.resetModules();
    delete process.env.NOVA_CONNECTION_ENCRYPTION_KEY;
    const sansCle = require('../../../dryApp/Nova/services/crypto.service');
    expect(() => sansCle.chiffrer('secret')).toThrow(/NOVA_CONNECTION_ENCRYPTION_KEY/);

    jest.resetModules();
    process.env.NOVA_CONNECTION_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    const avecCle = require('../../../dryApp/Nova/services/crypto.service');
    const chiffree = avecCle.chiffrer('secret');
    jest.resetModules();
    delete process.env.NOVA_CONNECTION_ENCRYPTION_KEY;
    const sansCleRelue = require('../../../dryApp/Nova/services/crypto.service');
    expect(() => sansCleRelue.dechiffrer(chiffree)).toThrow(/NOVA_CONNECTION_ENCRYPTION_KEY/);
  });
});
