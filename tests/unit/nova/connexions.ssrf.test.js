jest.mock('dns', () => ({
  promises: { lookup: jest.fn() },
}));

const dns = require('dns').promises;
const {
  estUrlWebhookAutorisee,
  estAdressePrivee,
} = require('../../../dryApp/Nova/features/connexions/services/connexions.service');

describe('connexions.service — protection SSRF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dns.lookup.mockResolvedValue([{ address: '1.1.1.1' }]);
  });

  it('autorise un webhook HTTPS sur un hôte explicitement autorisé', async () => {
    await expect(estUrlWebhookAutorisee('https://hooks.slack.com/services/T/B/X')).resolves.toBe(
      true
    );
  });

  it('refuse HTTP, un hôte inconnu et des identifiants intégrés', async () => {
    await expect(estUrlWebhookAutorisee('http://hooks.slack.com/x')).resolves.toBe(false);
    await expect(estUrlWebhookAutorisee('https://evil.example/x')).resolves.toBe(false);
    await expect(estUrlWebhookAutorisee('https://user:pass@hooks.slack.com/x')).resolves.toBe(
      false
    );
  });

  it('refuse une résolution DNS vers une adresse privée', async () => {
    dns.lookup.mockResolvedValue([{ address: '169.254.169.254' }]);
    await expect(estUrlWebhookAutorisee('https://hooks.slack.com/x')).resolves.toBe(false);
  });

  it('détecte les plages privées et metadata', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '::1',
    ]) {
      expect(estAdressePrivee(ip)).toBe(true);
    }
    expect(estAdressePrivee('1.1.1.1')).toBe(false);
  });
});
