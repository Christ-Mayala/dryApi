/**
 * Tests d'integration — Pelerin / housePreaching : scheduler + sync YouTube.
 *
 * Couvre les 12 cas demandés :
 *   1. scheduler activé (cron planifié)
 *   2. scheduler désactivé (YOUTUBE_SYNC_ENABLED=false)
 *   3. NODE_ENV=test (scheduler ignoré)
 *   4. API key absente (message explicite, pas de crash)
 *   5. API YouTube disponible (vidéo importée)
 *   6. API YouTube indisponible (syncStatus=error, anciennes conservées)
 *   7. nouvelle vidéo → créée
 *   8. vidéo déjà existante → pas de doublon
 *   9. vidéo supprimée de la playlist → conservée en base (jamais de delete)
 *  10. source inactive → ignorée
 *  11. plusieurs sources → toutes traitées
 *  12. erreur sur une source → les autres continuent
 *
 * L'API YouTube est mockée via jest.mock('axios').
 *
 * @module tests/Pelerin/housePreachingSync.test
 */

jest.mock('axios');

const { setupPelerinTestDB, getPelerinModel } = require('./_helpers/pelerinTestUtils');

const HousePreachingSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreaching.schema');
const HousePreachingSourceSchema = require('../../dryApp/Pelerin/features/housePreaching/model/housePreachingSource.schema');

// Chargé APRÈS jest.mock : le require('axios') du service récupère le mock.
const syncService = require('../../dryApp/Pelerin/services/housePreachingSync.service');

const makePlaylistItem = (vid, title = `Vidéo ${vid}`) => ({
  contentDetails: { videoId: vid },
  snippet: {
    title,
    description: `Description de ${title}`,
    publishedAt: '2026-08-01T10:00:00.000Z',
    thumbnails: { high: { url: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` } },
  },
});

const makeAxiosMock = ({ channels = {}, playlistBySource = {}, durations = {} } = {}) => {
  const axios = require('axios');
  axios.get.mockImplementation(async (url, { params = {} } = {}) => {
    if (url.endsWith('/channels')) {
      if (params.forHandle) {
        const chan = channels[params.forHandle] || { id: 'CHAN-1' };
        return { data: { items: [{ id: chan.id }] } };
      }
      const chan = channels[params.id] || { uploads: 'UPLOADS-1' };
      return { data: { items: [{ contentDetails: { relatedPlaylists: { uploads: chan.uploads } } }] } };
    }
    if (url.endsWith('/playlistItems')) {
      const items = playlistBySource[params.playlistId] || [];
      return { data: { items, nextPageToken: null } };
    }
    if (url.endsWith('/videos')) {
      const ids = String(params.id || '').split(',');
      return {
        data: {
          items: ids.map((id) => ({
            id,
            contentDetails: { duration: durations[id] || 'PT10M0S' },
          })),
        },
      };
    }
    return { data: { items: [] } };
  });
};

const createSource = async (overrides = {}) => {
  const Source = getPelerinModel('HousePreachingSource', HousePreachingSourceSchema);
  return Source.create({
    name: 'ICCTV',
    platform: 'youtube',
    channelHandle: '@ICCTV',
    channelId: 'CHAN-1',
    playlistId: 'UPLOADS-1',
    preacher: 'Pasteur Yves Castanou',
    category: 'predication',
    autoPublish: true,
    isActive: true,
    ...overrides,
  });
};

describe('Pelerin — housePreaching sync YouTube', () => {
  setupPelerinTestDB();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. sync: aucune API key → message explicite, sans crash (cas 4)', async () => {
    const oldKey = process.env.YOUTUBE_API_KEY;
    delete process.env.YOUTUBE_API_KEY;
    try {
      const result = await syncService.syncFromYouTube(
        getPelerinModel('HousePreaching', HousePreachingSchema),
        getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
      );
      expect(result.message).toBe('YOUTUBE_API_KEY manquant');
      expect(result.synced).toBe(0);
    } finally {
      if (oldKey !== undefined) process.env.YOUTUBE_API_KEY = oldKey;
    }
  });

  it('2. sync: aucune source active → message explicite, sans crash', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const result = await syncService.syncFromYouTube(
      getPelerinModel('HousePreaching', HousePreachingSchema),
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );
    expect(result.message).toBe('Aucune source active');
  });

  it('3. API disponible : nouvelle vidéo créée (cas 5 + 7)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const source = await createSource();
    makeAxiosMock({ playlistBySource: { 'UPLOADS-1': [makePlaylistItem('VID-1')] } });

    const result = await syncService.syncFromYouTube(
      getPelerinModel('HousePreaching', HousePreachingSchema),
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    expect(result.created).toBe(1);
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    const doc = await Preaching.findOne({ youtubeVideoId: 'VID-1' }).lean();
    expect(doc).toBeTruthy();
    expect(doc.title).toBe('Vidéo VID-1');
    expect(doc.preacher).toBe('Pasteur Yves Castanou');
    expect(doc.channelHandle).toBe('@ICCTV');
    expect(String(doc.sourceId)).toBe(String(source._id));
  });

  it('4. vidéo déjà existante → pas de doublon, mise à jour backfill (cas 8)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const source = await createSource();
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    await Preaching.create({
      title: 'Ancien titre',
      description: '',
      preacher: 'Ancien prêcheur',
      category: 'predication',
      youtubeVideoId: 'VID-1',
      youtubeUrl: 'https://www.youtube.com/watch?v=VID-1',
      publishedAt: new Date(),
      isPublished: true,
      isActive: true,
    });

    makeAxiosMock({
      playlistBySource: { 'UPLOADS-1': [makePlaylistItem('VID-1', 'Titre mis à jour')] },
    });

    const result = await syncService.syncFromYouTube(
      Preaching,
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    const total = await Preaching.countDocuments({ youtubeVideoId: 'VID-1' });
    expect(total).toBe(1); // pas de doublon
    const doc = await Preaching.findOne({ youtubeVideoId: 'VID-1' }).lean();
    expect(doc.title).toBe('Titre mis à jour');
    expect(doc.preacher).toBe('Pasteur Yves Castanou'); // backfill depuis la source
    expect(String(doc.sourceId)).toBe(String(source._id));
    expect(result.updated).toBeGreaterThanOrEqual(1);
  });

  it('5. vidéo supprimée de la playlist → conservée en base (jamais de delete) (cas 9)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const source = await createSource();
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    await Preaching.create({
      title: 'Ancienne vidéo',
      description: '',
      preacher: 'Pasteur Yves Castanou',
      category: 'predication',
      youtubeVideoId: 'VID-SUPPRIMEE',
      youtubeUrl: 'https://www.youtube.com/watch?v=VID-SUPPRIMEE',
      publishedAt: new Date(),
      isPublished: true,
      isActive: true,
      sourceId: source._id,
      sourceName: source.name,
      channelHandle: source.channelHandle,
    });

    // La playlist ne contient plus cette vidéo
    makeAxiosMock({ playlistBySource: { 'UPLOADS-1': [makePlaylistItem('VID-2')] } });

    await syncService.syncFromYouTube(
      Preaching,
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    const stillThere = await Preaching.findOne({ youtubeVideoId: 'VID-SUPPRIMEE' }).lean();
    expect(stillThere).toBeTruthy(); // jamais supprimée
  });

  it('6. API YouTube indisponible → syncStatus=error, anciennes conservées (cas 6)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    const source = await createSource();
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    await Preaching.create({
      title: 'Existant',
      description: '',
      preacher: 'Pasteur Yves Castanou',
      category: 'predication',
      youtubeVideoId: 'VID-KEEP',
      youtubeUrl: 'https://www.youtube.com/watch?v=VID-KEEP',
      publishedAt: new Date(),
      isPublished: true,
      isActive: true,
      sourceId: source._id,
    });

    const axios = require('axios');
    axios.get.mockRejectedValue(new Error('YouTube down'));

    const result = await syncService.syncFromYouTube(
      Preaching,
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    expect(result.errors).toBeGreaterThanOrEqual(1);
    const Source = getPelerinModel('HousePreachingSource', HousePreachingSourceSchema);
    const sourceAfter = await Source.findById(source._id).lean();
    expect(sourceAfter.syncStatus).toBe('error');
    expect(sourceAfter.syncError).toContain('YouTube down');
    // Les anciennes prédications sont conservées
    expect(await Preaching.findOne({ youtubeVideoId: 'VID-KEEP' })).toBeTruthy();
  });

  it('7. source inactive → ignorée (cas 10)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    await createSource({ isActive: false, channelHandle: '@inactive', playlistId: 'UPLOADS-INACTIVE' });
    makeAxiosMock({ playlistBySource: { 'UPLOADS-INACTIVE': [makePlaylistItem('VID-INACTIVE')] } });

    const result = await syncService.syncFromYouTube(
      getPelerinModel('HousePreaching', HousePreachingSchema),
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    expect(result.created).toBe(0);
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    expect(await Preaching.findOne({ youtubeVideoId: 'VID-INACTIVE' })).toBeNull();
  });

  it('8. plusieurs sources → toutes traitées (cas 11)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    await createSource(); // ICCTV / UPLOADS-1
    await createSource({
      name: 'ICCTV Congo',
      channelHandle: '@icctvcongo',
      channelId: 'CHAN-2',
      playlistId: 'UPLOADS-2',
      preacher: 'Pasteur Yvan Castanou',
    });
    makeAxiosMock({
      channels: {
        'CHAN-2': { id: 'CHAN-2', uploads: 'UPLOADS-2' },
      },
      playlistBySource: {
        'UPLOADS-1': [makePlaylistItem('VID-A')],
        'UPLOADS-2': [makePlaylistItem('VID-B')],
      },
    });

    const result = await syncService.syncFromYouTube(
      getPelerinModel('HousePreaching', HousePreachingSchema),
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    expect(result.created).toBe(2);
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    const docA = await Preaching.findOne({ youtubeVideoId: 'VID-A' }).lean();
    const docB = await Preaching.findOne({ youtubeVideoId: 'VID-B' }).lean();
    expect(docA.preacher).toBe('Pasteur Yves Castanou');
    expect(docB.preacher).toBe('Pasteur Yvan Castanou');
  });

  it('9. erreur sur une source → les autres continuent (cas 12)', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    // Pas de channelId ni playlistId : la résolution se fait via le handle
    // (@broken) qui échoue dans le mock → la source doit passer en erreur.
    await createSource({ channelHandle: '@broken', channelId: null, playlistId: null });
    await createSource({
      name: 'ICCTV Congo',
      channelHandle: '@icctvcongo',
      channelId: 'CHAN-2',
      playlistId: 'UPLOADS-2',
      preacher: 'Pasteur Yvan Castanou',
    });

    const axios = require('axios');
    axios.get.mockImplementation(async (url, { params = {} } = {}) => {
      // La première source (@broken) échoue à la résolution du channelId
      if (params.forHandle === '@broken') throw new Error('Handle introuvable');
      if (params.forHandle) return { data: { items: [{ id: 'CHAN-X' }] } };
      if (url.endsWith('/channels')) {
        return { data: { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UPLOADS-2' } } }] } };
      }
      if (url.endsWith('/playlistItems')) {
        return { data: { items: [makePlaylistItem('VID-OK')], nextPageToken: null } };
      }
      if (url.endsWith('/videos')) {
        return { data: { items: [{ id: 'VID-OK', contentDetails: { duration: 'PT10M' } }] } };
      }
      return { data: { items: [] } };
    });

    const result = await syncService.syncFromYouTube(
      getPelerinModel('HousePreaching', HousePreachingSchema),
      getPelerinModel('HousePreachingSource', HousePreachingSourceSchema)
    );

    // La source saine a importé sa vidéo malgré l'échec de l'autre
    expect(result.created).toBe(1);
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    expect(await Preaching.findOne({ youtubeVideoId: 'VID-OK' })).toBeTruthy();

    const Source = getPelerinModel('HousePreachingSource', HousePreachingSourceSchema);
    const broken = await Source.findOne({ channelHandle: '@broken' }).lean();
    expect(broken.syncStatus).toBe('error');
  });

  it('10. déduplication par youtubeVideoId : deux syncs ne créent jamais de doublons', async () => {
    process.env.YOUTUBE_API_KEY = 'test-key';
    await createSource();
    makeAxiosMock({ playlistBySource: { 'UPLOADS-1': [makePlaylistItem('VID-UNIQUE')] } });
    const Preaching = getPelerinModel('HousePreaching', HousePreachingSchema);
    const Source = getPelerinModel('HousePreachingSource', HousePreachingSourceSchema);

    await syncService.syncFromYouTube(Preaching, Source);
    await syncService.syncFromYouTube(Preaching, Source);

    expect(await Preaching.countDocuments({ youtubeVideoId: 'VID-UNIQUE' })).toBe(1);
  });
});

describe('Pelerin — scheduler housePreachingSync', () => {
  let cronMock;
  let schedulerModule;

  beforeEach(() => {
    jest.resetModules();
    cronMock = { schedule: jest.fn(), validate: jest.fn(() => true) };
    jest.doMock('node-cron', () => cronMock);
    // DoMock axios pour que le re-require du service soit cohérent
    jest.doMock('axios', () => ({ get: jest.fn() }));
    schedulerModule = require('../../dryApp/Pelerin/services/housePreachingSync.scheduler');
  });

  afterEach(() => {
    jest.unmock('node-cron');
    jest.unmock('axios');
    delete process.env.YOUTUBE_SYNC_ENABLED;
    delete process.env.YOUTUBE_SYNC_CRON;
    process.env.NODE_ENV = 'development';
  });

  it('1. scheduler activé : cron planifié avec la fréquence par défaut (1h)', () => {
    process.env.NODE_ENV = 'development';
    schedulerModule.startHousePreachingSyncScheduler();
    expect(cronMock.schedule).toHaveBeenCalledWith(
      '0 * * * *',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('2. scheduler activé : cron planifié avec une fréquence custom', () => {
    process.env.NODE_ENV = 'development';
    process.env.YOUTUBE_SYNC_CRON = '0 */2 * * *';
    schedulerModule.startHousePreachingSyncScheduler();
    expect(cronMock.schedule).toHaveBeenCalledWith(
      '0 */2 * * *',
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('3. scheduler désactivé (YOUTUBE_SYNC_ENABLED=false) : aucun cron', () => {
    process.env.NODE_ENV = 'development';
    process.env.YOUTUBE_SYNC_ENABLED = 'false';
    schedulerModule.startHousePreachingSyncScheduler();
    expect(cronMock.schedule).not.toHaveBeenCalled();
  });

  it('4. NODE_ENV=test : scheduler ignoré (cas 3)', () => {
    process.env.NODE_ENV = 'test';
    schedulerModule.startHousePreachingSyncScheduler();
    expect(cronMock.schedule).not.toHaveBeenCalled();
  });

  it('5. expression cron invalide : pas de planification, pas de crash', () => {
    process.env.NODE_ENV = 'development';
    cronMock.validate.mockReturnValue(false);
    process.env.YOUTUBE_SYNC_CRON = 'pas-une-cron';
    schedulerModule.startHousePreachingSyncScheduler();
    expect(cronMock.schedule).not.toHaveBeenCalled();
  });

  it('6. runHousePreachingSyncNow : gère les erreurs sans throw (clé absente)', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const result = await schedulerModule.runHousePreachingSyncNow();
    expect(result.message).toBe('YOUTUBE_API_KEY manquant');
  });
});
