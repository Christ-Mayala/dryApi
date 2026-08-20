/**
 * Tests d'intégration — Pelerin / module Podcast (RSS + Podcast Index).
 *
 * Couvre :
 *   - parsing + normalisation du flux RSS (durée, guid, saison/épisode) ;
 *   - import RSS (aperçu sans écriture, import réel, déduplication par guid) ;
 *   - synchronisation (nouvel épisode détecté, RSS invalide → statut error) ;
 *   - abonnements (suivre / liste / ne plus suivre) ;
 *   - progression d'écoute + historique + favoris d'épisodes ;
 *   - découverte Podcast Index (mocked : credentials backend, jamais publiée).
 *
 * @module tests/Pelerin/podcastRss.test
 */

const http = require('http');
const {
  setupPelerinTestDB,
  getPelerinModel,
  buildReq,
  buildRes,
  fakeUserId,
} = require('./_helpers/pelerinTestUtils');

const PodcastShowSchema = require('../../dryApp/Pelerin/features/podcastShow/model/podcastShow.schema');
const PodcastEpisodeSchema = require('../../dryApp/Pelerin/features/podcastEpisode/model/podcastEpisode.schema');
const { fetchAndNormalizeFeed } = require('../../dryApp/Pelerin/services/podcastRss.service');
const podcastIndexService = require('../../dryApp/Pelerin/services/podcastIndex.service');
const { searchPodcastIndex } = podcastIndexService;

const importPreview = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.importPreview.controller');
const importShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.import.controller');
const syncShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.sync.controller');
const subscriptions = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.subscriptions.controller');
const progress = require('../../dryApp/Pelerin/features/podcastEpisode/controller/podcastEpisode.progress.controller');
const historyController = require('../../dryApp/Pelerin/features/podcastEpisode/controller/podcastEpisode.history.controller');
const favorites = require('../../dryApp/Pelerin/features/podcastEpisode/controller/podcastEpisode.favorites.controller');
const discover = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.discover.controller');
const getAllAdmin = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.getAllAdmin.controller');
const moderateShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.moderate.controller');
const pipelineHistory = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.pipeline.controller');
const podcastConfig = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.config.controller');
const configScoring = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.configScoring.controller');
const configTest = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.configTest.controller');
const discoverRun = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.discoverRun.controller');
const schedulerModule = require('../../dryApp/Pelerin/services/podcastRss.scheduler');
const { getDiscoveryKeywords } = schedulerModule;
const PodcastImportDecisionSchema = require('../../dryApp/Pelerin/features/podcastShow/model/podcastImportDecision.schema');
const {
  computePodcastScore,
  decideAutoPublish,
  setScoringOverrides,
} = require('../../dryApp/Pelerin/services/podcastScoring.service');
const { seedDefaultPodcasts, DEFAULT_PODCASTS } = require('../../dryApp/Pelerin/services/podcastSeed.service');

/** Construit un flux RSS minimal avec les épisodes passés (+ override channel). */
function buildFeedXml(episodes, channel = {}) {
  const items = episodes
    .map(
      (e, i) => `    <item>
      <title>${e.title}</title>
      <description>${e.description || 'Desc'}</description>
      <guid isPermaLink="false">${e.guid}</guid>
      <pubDate>${e.pubDate || 'Mon, 03 Mar 2025 08:00:00 GMT'}</pubDate>
      <enclosure url="${e.audioUrl}" type="audio/mpeg" length="100000" />
      <itunes:duration>${e.duration || '3600'}</itunes:duration>
      <itunes:episode>${e.episodeNumber ?? i + 1}</itunes:episode>
      <itunes:season>${e.season ?? 1}</itunes:season>
      <link>https://example.com/ep${i + 1}</link>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${channel.title ?? 'Podcast Test'}</title>
    <description>${channel.description ?? 'Un podcast chrétien de test'}</description>
    <link>https://example.com</link>
    <language>${channel.language ?? 'fr-fr'}</language>
    <itunes:author>Auteur Test</itunes:author>
    <image><url>https://example.com/cover.jpg</url></image>
    <itunes:image href="https://example.com/cover.jpg" />
${items}
  </channel>
</rss>`;
}

const EP1 = {
  guid: 'guid-1',
  title: 'Épisode un',
  description: 'Premier épisode',
  audioUrl: 'https://cdn.example.com/ep1.mp3',
  duration: '45:30',
};
const EP2 = {
  guid: 'guid-2',
  title: 'Épisode deux',
  audioUrl: 'https://cdn.example.com/ep2.mp3',
  duration: '3600',
};

describe('Pelerin — module Podcast (RSS + Podcast Index)', () => {
  setupPelerinTestDB();

  let server;
  let baseUrl;
  let feedXml = buildFeedXml([EP1, EP2]);

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
      res.end(feedXml);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/feed.xml`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const authReq = (overrides = {}) => {
    const id = fakeUserId();
    return buildReq({ user: { id, _id: id }, ...overrides });
  };

  it('parse et normalise un flux RSS (durée, guid, saison, épisode)', async () => {
    const { show, episodes } = await fetchAndNormalizeFeed(baseUrl);

    expect(show.title).toBe('Podcast Test');
    expect(show.author).toBe('Auteur Test');
    expect(show.language).toBe('fr-fr');
    expect(show.websiteUrl).toBe('https://example.com');
    expect(show.coverUrl).toBe('https://example.com/cover.jpg');

    expect(episodes).toHaveLength(2);
    expect(episodes[0].guid).toBe('guid-1');
    expect(episodes[0].duration).toBe('45:30');
    expect(episodes[1].duration).toBe('1:00:00'); // 3600s normalisé
    expect(episodes[0].episodeNumber).toBe(1);
    expect(episodes[0].season).toBe(1);
    expect(episodes[0].audioUrl).toBe('https://cdn.example.com/ep1.mp3');
  });

  it('aperçu RSS (import/preview) ne crée rien en base', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const res = buildRes();
    await importPreview(authReq({ body: { rssUrl: baseUrl } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Podcast Test');
    expect(res.body.data.episodeCount).toBe(2);
    expect(res.body.data.alreadyImported).toBe(false);
    expect(res.body.data.episodes).toHaveLength(2);

    expect(await Show.countDocuments({})).toBe(0);
  });

  it('rejette un aperçu avec une rssUrl invalide', async () => {
    await expect(importPreview(authReq({ body: { rssUrl: 'pas-une-url' } }), buildRes())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('importe un podcast : crée l’émission + 2 épisodes, puis déduplique (guid)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Episode = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);

    const res = buildRes();
    await importShow(authReq({ body: { rssUrl: baseUrl, category: 'foi-spiritualite' } }), res);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rssUrl).toBe(baseUrl);
    expect(res.body.data.category).toBe('foi-spiritualite');

    expect(await Show.countDocuments({})).toBe(1);
    expect(await Episode.countDocuments({ showId: res.body.data._id })).toBe(2);

    // Second import : aucune duplication.
    const res2 = buildRes();
    await importShow(authReq({ body: { rssUrl: baseUrl } }), res2);
    expect(await Show.countDocuments({})).toBe(1);
    expect(await Episode.countDocuments({ showId: res.body.data._id })).toBe(2);
  });

  it('détecte un nouvel épisode à la resynchronisation (sans doublon)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Episode = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);

    const res = buildRes();
    await importShow(authReq({ body: { rssUrl: baseUrl } }), res);
    const showId = res.body.data._id;

    // Ajoute un 3e épisode au flux puis resynchronise.
    feedXml = buildFeedXml([EP1, EP2, { guid: 'guid-3', title: 'Épisode trois', audioUrl: 'https://cdn.example.com/ep3.mp3' }]);
    const syncRes = buildRes();
    await syncShow(authReq({ params: { id: String(showId) } }), syncRes);

    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.data.syncStatus).toBe('ok');
    expect(syncRes.body.data.lastSyncedAt).toBeTruthy();
    expect(await Episode.countDocuments({ showId })).toBe(3);

    // Retour du flux à 2 épisodes + re-sync : pas de doublon non plus.
    feedXml = buildFeedXml([EP1, EP2]);
    await syncShow(authReq({ params: { id: String(showId) } }), buildRes());
    expect(await Episode.countDocuments({ showId })).toBe(3);
  });

  it('RSS inaccessible → statut error mémorisé (sync maintenant)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const show = await Show.create({
      title: 'Podcast mort',
      description: 'Desc',
      rssUrl: 'http://127.0.0.1:1/feed.xml', // port fermé
    });

    const res = buildRes();
    await syncShow(authReq({ params: { id: String(show._id) } }), res);

    expect(res.body.success).toBe(false);
    expect(res.statusCode).toBe(502);

    const reloaded = await Show.findById(show._id);
    expect(reloaded.syncStatus).toBe('error');
    expect(reloaded.syncError).toBeTruthy();
  });

  it('abonnements : suivre, lister, ne plus suivre', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const show = await Show.create({ title: 'À suivre', description: 'Desc' });
    const req = authReq();

    const followRes = buildRes();
    await subscriptions.follow({ ...req, params: { id: String(show._id) } }, followRes);
    expect(followRes.body.data.following).toBe(true);

    const listRes = buildRes();
    await subscriptions.listMine(req, listRes);
    expect(listRes.body.data).toHaveLength(1);
    expect(String(listRes.body.data[0]._id)).toBe(String(show._id));

    const unfollowRes = buildRes();
    await subscriptions.unfollow({ ...req, params: { id: String(show._id) } }, unfollowRes);
    expect(unfollowRes.body.data.following).toBe(false);

    const listRes2 = buildRes();
    await subscriptions.listMine(req, listRes2);
    expect(listRes2.body.data).toHaveLength(0);
  });

  it('progression d’écoute : upsert, reprise, historique, completion', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Episode = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);
    const show = await Show.create({ title: 'Écoutable', description: 'Desc' });
    const episode = await Episode.create({
      showId: show._id,
      episodeNumber: 1,
      title: 'Ep 1',
      audioUrl: 'https://cdn.example.com/a.mp3',
    });
    const req = authReq();

    const upRes = buildRes();
    await progress.upsert(
      { ...req, params: { id: String(episode._id) }, body: { positionMs: 1397000, durationMs: 2730000 } },
      upRes,
    );
    expect(upRes.body.data.saved).toBe(true);

    const getRes = buildRes();
    await progress.getOne({ ...req, params: { id: String(episode._id) } }, getRes);
    expect(getRes.body.data.positionMs).toBe(1397000);
    expect(getRes.body.data.completed).toBe(false);

    // Terminé : position >= 98% → completed auto.
    await progress.upsert(
      { ...req, params: { id: String(episode._id) }, body: { positionMs: 2729000, durationMs: 2730000 } },
      buildRes(),
    );
    const getRes2 = buildRes();
    await progress.getOne({ ...req, params: { id: String(episode._id) } }, getRes2);
    expect(getRes2.body.data.completed).toBe(true);

    const histRes = buildRes();
    await historyController(req, histRes);
    expect(histRes.body.data).toHaveLength(1);
    expect(histRes.body.data[0].episode.title).toBe('Ep 1');
    expect(String(histRes.body.data[0].show._id)).toBe(String(show._id));

    // Un autre utilisateur n'a pas accès à cette progression (isolation).
    const otherReq = authReq();
    const otherRes = buildRes();
    await progress.getOne({ ...otherReq, params: { id: String(episode._id) } }, otherRes);
    expect(otherRes.body.data).toBeNull();
    const otherHist = buildRes();
    await historyController(otherReq, otherHist);
    expect(otherHist.body.data).toHaveLength(0);
  });

  it('favoris d’épisodes : ajouter, lister, retirer', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Episode = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);
    const show = await Show.create({ title: 'Favoris', description: 'Desc' });
    const episode = await Episode.create({
      showId: show._id,
      episodeNumber: 1,
      title: 'Ep favori',
      audioUrl: 'https://cdn.example.com/f.mp3',
    });
    const req = authReq();

    const addRes = buildRes();
    await favorites.add({ ...req, params: { id: String(episode._id) } }, addRes);
    expect(addRes.body.data.favorite).toBe(true);

    const listRes = buildRes();
    await favorites.listMine(req, listRes);
    expect(listRes.body.data).toHaveLength(1);
    expect(String(listRes.body.data[0].show._id)).toBe(String(show._id));

    await favorites.remove({ ...req, params: { id: String(episode._id) } }, buildRes());
    const listRes2 = buildRes();
    await favorites.listMine(req, listRes2);
    expect(listRes2.body.data).toHaveLength(0);
  });

  it('découverte Podcast Index : résultats jamais publiés, déjà-importés signalés', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    await Show.create({
      title: 'Déjà importé',
      description: 'Desc',
      rssUrl: 'https://feeds.example.com/imported.xml',
    });

    jest.spyOn(podcastIndexService, 'searchPodcastIndex').mockResolvedValue([
      {
        feedId: 1,
        title: 'Déjà importé',
        author: 'A',
        description: 'D',
        imageUrl: '',
        language: 'fr-fr',
        websiteUrl: '',
        rssUrl: 'https://feeds.example.com/imported.xml',
        categories: ['Religion & Spirituality'],
        score: 9,
        isFrancophone: true,
        isSpiritual: true,
      },
      {
        feedId: 2,
        title: 'Nouveau podcast',
        author: 'B',
        description: 'D',
        imageUrl: 'https://example.com/c.jpg',
        language: 'fr-fr',
        websiteUrl: 'https://example.com',
        rssUrl: 'https://feeds.example.com/new.xml',
        categories: ['Christianity'],
        score: 8,
        isFrancophone: true,
        isSpiritual: true,
      },
    ]);

    const res = buildRes();
    await discover(authReq({ query: { q: 'chrétien' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].alreadyImported).toBe(true);
    expect(res.body.data[0].existingId).toBeTruthy();
    expect(res.body.data[1].alreadyImported).toBe(false);
    expect(res.body.data[1].existingId).toBeNull();

    // Aucune publication automatique : toujours 1 seul podcast en base.
    expect(await Show.countDocuments({})).toBe(1);
    podcastIndexService.searchPodcastIndex.mockRestore();
  });

  it('découverte sans credentials → 503 (jamais de fuite côté client)', async () => {
    const originalKey = process.env.PODCASTINDEX_API_KEY;
    const originalSecret = process.env.PODCASTINDEX_API_SECRET;
    delete process.env.PODCASTINDEX_API_KEY;
    delete process.env.PODCASTINDEX_API_SECRET;

    try {
      await expect(searchPodcastIndex({ q: 'prière' })).rejects.toMatchObject({
        code: 'PODCAST_INDEX_NOT_CONFIGURED',
      });
    } finally {
      if (originalKey !== undefined) process.env.PODCASTINDEX_API_KEY = originalKey;
      if (originalSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = originalSecret;
    }
  });

  // ── Pipeline de score (auto-pub ≥ 80 / validation 50–79 / rejet < 50) ──

  it('score : pondérations du titre, de la description, de la langue et du flux', () => {
    // Langue FR + 3 mots-clés forts du titre + RSS valide → plafonné à 100.
    const strong = computePodcastScore({
      title: 'Bible chrétienne — Jésus',
      description: '',
      language: 'fr-fr',
      categories: ['Religion & Spirituality'],
      rssValid: true,
    });
    expect(strong.score).toBeGreaterThanOrEqual(80);
    expect(strong.breakdown.length).toBeGreaterThan(3);

    // Titre moyen + évangile/prière en description → 50–79 (validation admin).
    const medium = computePodcastScore({
      title: 'Prière et spiritualité',
      description: 'Méditation sur l\'évangile du dimanche',
      language: 'fr-fr',
      categories: [],
      rssValid: true,
    });
    expect(medium.score).toBeGreaterThanOrEqual(50);
    expect(medium.score).toBeLessThan(80);

    // Aucun signal chrétien → < 50 (rejet automatique).
    const weak = computePodcastScore({
      title: "L'heure du thé",
      description: 'Tout sur les thés et infusions',
      language: 'fr-fr',
      categories: ['Society & Culture'],
      rssValid: true,
    });
    expect(weak.score).toBeLessThan(50);
  });

  it('score : la langue non-francophone et les catégories neutres font chuter le score', () => {
    const english = computePodcastScore({
      title: 'Bible Study',
      description: 'Christian teaching',
      language: 'en-us',
      categories: ['Christianity'],
      rssValid: true,
    });
    expect(english.score).toBeLessThan(80); // pas de bonus FR → pas d\'auto-pub
  });

  it('décision : seuils 80 / 50 appliqués (auto / pending / rejected)', () => {
    expect(decideAutoPublish(80)).toEqual({ status: 'auto', isPublished: true });
    expect(decideAutoPublish(95)).toEqual({ status: 'auto', isPublished: true });
    expect(decideAutoPublish(50)).toEqual({ status: 'pending', isPublished: false });
    expect(decideAutoPublish(79)).toEqual({ status: 'pending', isPublished: false });
    expect(decideAutoPublish(49)).toEqual({ status: 'rejected', isPublished: false });
  });

  it('import source=discover : score élevé → auto-publié (isPublished=true)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const previous = feedXml;
    feedXml = buildFeedXml([EP1], { title: 'Bible chrétienne — Jésus au quotidien', description: 'Enseignement' });
    try {
      const res = buildRes();
      await importShow(authReq({ body: { rssUrl: baseUrl, source: 'discover' } }), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data.autoPublishStatus).toBe('auto');
      expect(res.body.data.isPublished).toBe(true);
      expect(res.body.data.score).toBeGreaterThanOrEqual(80);
    } finally {
      feedXml = previous;
      await Show.deleteMany({});
    }
  });

  it('import source=discover : score moyen → en attente de validation (non publié)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const previous = feedXml;
    feedXml = buildFeedXml([EP1], { title: 'Prière du matin', description: 'Méditation et partage évangélique' });
    try {
      const res = buildRes();
      await importShow(authReq({ body: { rssUrl: baseUrl, source: 'discover' } }), res);
      expect(res.body.data.autoPublishStatus).toBe('pending');
      expect(res.body.data.isPublished).toBe(false);
    } finally {
      feedXml = previous;
      await Show.deleteMany({});
    }
  });

  it('import source=discover : score faible → rejeté (non publié)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const previous = feedXml;
    feedXml = buildFeedXml([EP1], { title: "L'heure du thé", description: 'Tout sur le thé' });
    try {
      const res = buildRes();
      await importShow(authReq({ body: { rssUrl: baseUrl, source: 'discover' } }), res);
      expect(res.body.data.autoPublishStatus).toBe('rejected');
      expect(res.body.data.isPublished).toBe(false);
    } finally {
      feedXml = previous;
      await Show.deleteMany({});
    }
  });

  it('import manuel (sans source) : action admin explicite → publié quel que soit le score', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const previous = feedXml;
    feedXml = buildFeedXml([EP1], { title: 'Contenu atypique', description: 'Sans lien évident avec la foi' });
    try {
      const res = buildRes();
      await importShow(authReq({ body: { rssUrl: baseUrl } }), res);
      expect(res.body.data.autoPublishStatus).toBe('manual');
      expect(res.body.data.isPublished).toBe(true);
      expect(res.body.data.score).toBeLessThan(50); // score stocké pour info
    } finally {
      feedXml = previous;
      await Show.deleteMany({});
    }
  });

  it('admin : filtre par statut du pipeline (autoStatus)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    await Show.create({ title: 'Auto', description: 'D', autoPublishStatus: 'auto', isPublished: true });
    await Show.create({ title: 'Pending', description: 'D', autoPublishStatus: 'pending', isPublished: false });
    await Show.create({ title: 'Rejeté', description: 'D', autoPublishStatus: 'rejected', isPublished: false });

    const res = buildRes();
    await getAllAdmin(authReq({ query: { autoStatus: 'pending' } }), res);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Pending');

    const res2 = buildRes();
    await getAllAdmin(authReq({ query: { autoStatus: 'auto' } }), res2);
    expect(res2.body.data).toHaveLength(1);
    expect(res2.body.data[0].title).toBe('Auto');
  });

  it('seed : catalogue non vide → skip (aucune importation)', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Episode = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);
    await Show.create({ title: 'Existant', description: 'D', rssUrl: 'https://example.com/x.xml' });

    const result = await seedDefaultPodcasts({ Show, Episode });
    expect(result.skipped).toBe(true);
    expect(result.seeded).toBe(0);
  });

  it('seed : la liste par défaut contient des flux RSS http(s) valides', () => {
    expect(DEFAULT_PODCASTS.length).toBeGreaterThanOrEqual(5);
    for (const p of DEFAULT_PODCASTS) {
      expect(p.title).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.rssUrl).toMatch(/^https?:\/\//i);
    }
  });

  // ── Modération fine + historique du pipeline ──

  it('modération : rejeter avec motif puis réactiver, consignées dans l’historique', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Decision = getPelerinModel('PodcastImportDecision', PodcastImportDecisionSchema);
    const show = await Show.create({
      title: 'Auto publié',
      description: 'D',
      autoPublishStatus: 'auto',
      isPublished: true,
      score: 85,
      scoreBreakdown: [{ label: 'Langue française', points: 20 }],
    });

    const rejectRes = buildRes();
    await moderateShow(
      authReq({ params: { id: String(show._id) }, body: { action: 'reject', reason: 'Contenu hors sujet' } }),
      rejectRes,
    );
    expect(rejectRes.body.data.autoPublishStatus).toBe('rejected');
    expect(rejectRes.body.data.isPublished).toBe(false);
    expect(rejectRes.body.data.moderationReason).toBe('Contenu hors sujet');

    const reactivateRes = buildRes();
    await moderateShow(authReq({ params: { id: String(show._id) }, body: { action: 'reactivate' } }), reactivateRes);
    expect(reactivateRes.body.data.autoPublishStatus).toBe('manual');
    expect(reactivateRes.body.data.isPublished).toBe(true);
    expect(reactivateRes.body.data.moderationReason).toBeNull();

    const entries = await Decision.find({}).sort({ createdAt: 1 }).lean();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      action: 'reject',
      decision: 'rejected',
      reason: 'Contenu hors sujet',
      source: 'moderation',
      score: 85,
      isPublished: false,
    });
    expect(entries[1]).toMatchObject({
      action: 'reactivate',
      decision: 'manual',
      reason: null,
      source: 'moderation',
      isPublished: true,
    });
  });

  it('modération : action invalide → 400', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const show = await Show.create({ title: 'X', description: 'D' });
    await expect(
      moderateShow(authReq({ params: { id: String(show._id) }, body: { action: 'explose' } }), buildRes()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('historique du pipeline : consigné à l’import discover, détail par critère, filtrable par statut', async () => {
    const Show = getPelerinModel('PodcastShow', PodcastShowSchema);
    const Decision = getPelerinModel('PodcastImportDecision', PodcastImportDecisionSchema);
    const previous = feedXml;
    feedXml = buildFeedXml([EP1], { title: 'Bible chrétienne — Jésus au quotidien', description: 'Enseignement' });
    try {
      await importShow(authReq({ body: { rssUrl: baseUrl, source: 'discover' } }), buildRes());

      const entries = await Decision.find({}).lean();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ source: 'discover', action: 'import', decision: 'auto' });
      expect(entries[0].score).toBeGreaterThanOrEqual(80);
      expect(entries[0].scoreBreakdown.length).toBeGreaterThan(0);
      expect(entries[0].isPublished).toBe(true);

      const res = buildRes();
      await pipelineHistory(authReq({ query: { status: 'auto' } }), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].decision).toBe('auto');
      expect(res.body.data[0].scoreBreakdown.length).toBeGreaterThan(0);

      // Filtre sans correspondance → liste vide.
      const emptyRes = buildRes();
      await pipelineHistory(authReq({ query: { status: 'rejected' } }), emptyRes);
      expect(emptyRes.body.data).toHaveLength(0);
    } finally {
      feedXml = previous;
      await Show.deleteMany({});
    }
  });

  // ── Scoring configurable via variables d'environnement (PODCAST_SCORE_*) ──

  it('seuils configurables via PODCAST_SCORE_AUTO_PUBLISH / PODCAST_SCORE_PENDING_MIN', () => {
    const prevAuto = process.env.PODCAST_SCORE_AUTO_PUBLISH;
    const prevPending = process.env.PODCAST_SCORE_PENDING_MIN;
    try {
      process.env.PODCAST_SCORE_AUTO_PUBLISH = '90';
      process.env.PODCAST_SCORE_PENDING_MIN = '60';
      expect(decideAutoPublish(85)).toEqual({ status: 'pending', isPublished: false });
      expect(decideAutoPublish(60)).toEqual({ status: 'pending', isPublished: false });
      expect(decideAutoPublish(59)).toEqual({ status: 'rejected', isPublished: false });
      expect(decideAutoPublish(90)).toEqual({ status: 'auto', isPublished: true });
    } finally {
      if (prevAuto !== undefined) process.env.PODCAST_SCORE_AUTO_PUBLISH = prevAuto;
      else delete process.env.PODCAST_SCORE_AUTO_PUBLISH;
      if (prevPending !== undefined) process.env.PODCAST_SCORE_PENDING_MIN = prevPending;
      else delete process.env.PODCAST_SCORE_PENDING_MIN;
    }
  });

  it('config admin : expose l’état réel du module (clés, crons, seuils, mots-clés)', async () => {
    const prevKey = process.env.PODCASTINDEX_API_KEY;
    const prevSecret = process.env.PODCASTINDEX_API_SECRET;
    const prevBase = process.env.PODCASTINDEX_API_BASE;
    const prevMax = process.env.PODCAST_AUTO_DISCOVER_MAX;
    try {
      process.env.PODCASTINDEX_API_KEY = 'key-test';
      process.env.PODCASTINDEX_API_SECRET = 'secret-test';
      process.env.PODCASTINDEX_API_BASE = 'https://api.podcastindex.org/api/1.0/';
      process.env.PODCAST_AUTO_DISCOVER_MAX = '12';

      const res = buildRes();
      await podcastConfig(authReq(), res);

      expect(res.body.success).toBe(true);
      expect(res.body.data.appName).toBe('Pelerin');
      expect(res.body.data.podcastIndex.configured).toBe(true);
      expect(res.body.data.podcastIndex.apiBase).toBe('https://api.podcastindex.org/api/1.0');
      expect(res.body.data.schedulers.rssSync.enabled).toBe(true);
      expect(res.body.data.schedulers.rssSync.cronValid).toBe(true);
      expect(res.body.data.schedulers.autoDiscover.enabled).toBe(true);
      expect(res.body.data.schedulers.autoDiscover.maxPerRun).toBe(12);
      expect(res.body.data.seedEnabled).toBe(true);
      expect(res.body.data.discovery.keywords.length).toBeGreaterThan(0);
      expect(typeof res.body.data.scoring.thresholds.autoPublish).toBe('number');
      expect(res.body.data.scoring.thresholds.autoPublish).toBeGreaterThan(0);
      expect(res.body.data.scoring.thresholds.pendingMin).toBeGreaterThan(0);
      expect(res.body.data.scoring.weights.titre.length).toBeGreaterThan(0);
      expect(res.body.data.scoring.weights.description.length).toBeGreaterThan(0);
      expect(res.body.data.scoring.weights.titre[0]).toHaveProperty('env');
      expect(res.body.data.scoring.weights.titre[0]).toHaveProperty('points');
    } finally {
      if (prevKey !== undefined) process.env.PODCASTINDEX_API_KEY = prevKey;
      else delete process.env.PODCASTINDEX_API_KEY;
      if (prevSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = prevSecret;
      else delete process.env.PODCASTINDEX_API_SECRET;
      if (prevBase !== undefined) process.env.PODCASTINDEX_API_BASE = prevBase;
      else delete process.env.PODCASTINDEX_API_BASE;
      if (prevMax !== undefined) process.env.PODCAST_AUTO_DISCOVER_MAX = prevMax;
      else delete process.env.PODCAST_AUTO_DISCOVER_MAX;
    }
  });

  it('config admin : credentials absents → podcastIndex.configured=false', async () => {
    const prevKey = process.env.PODCASTINDEX_API_KEY;
    const prevSecret = process.env.PODCASTINDEX_API_SECRET;
    try {
      delete process.env.PODCASTINDEX_API_KEY;
      delete process.env.PODCASTINDEX_API_SECRET;
      const res = buildRes();
      await podcastConfig(authReq(), res);
      expect(res.body.data.podcastIndex.configured).toBe(false);
    } finally {
      if (prevKey !== undefined) process.env.PODCASTINDEX_API_KEY = prevKey;
      if (prevSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = prevSecret;
    }
  });

  it('mots-clés de découverte configurables via PODCAST_DISCOVERY_KEYWORDS', () => {
    const prev = process.env.PODCAST_DISCOVERY_KEYWORDS;
    try {
      process.env.PODCAST_DISCOVERY_KEYWORDS = 'prière, louange,  enseignement ';
      expect(getDiscoveryKeywords()).toEqual(['prière', 'louange', 'enseignement']);
    } finally {
      if (prev !== undefined) process.env.PODCAST_DISCOVERY_KEYWORDS = prev;
      else delete process.env.PODCAST_DISCOVERY_KEYWORDS;
    }
  });

  it('test de connectivité : recherche live OK quand les clés sont configurées (mocked)', async () => {
    const prevKey = process.env.PODCASTINDEX_API_KEY;
    const prevSecret = process.env.PODCASTINDEX_API_SECRET;
    process.env.PODCASTINDEX_API_KEY = 'cle-test';
    process.env.PODCASTINDEX_API_SECRET = 'secret-test';
    const spy = jest.spyOn(podcastIndexService, 'searchPodcastIndex').mockResolvedValue([{ title: 'A' }]);
    try {
      const res = buildRes();
      await configTest(authReq(), res);
      expect(res.body.data.ok).toBe(true);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.resultCount).toBe(1);
      expect(typeof res.body.data.latencyMs).toBe('number');
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (prevKey !== undefined) process.env.PODCASTINDEX_API_KEY = prevKey;
      else delete process.env.PODCASTINDEX_API_KEY;
      if (prevSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = prevSecret;
      else delete process.env.PODCASTINDEX_API_SECRET;
    }
  });

  it('test de connectivité : échec API (401) remonté proprement', async () => {
    const prevKey = process.env.PODCASTINDEX_API_KEY;
    const prevSecret = process.env.PODCASTINDEX_API_SECRET;
    process.env.PODCASTINDEX_API_KEY = 'cle-test';
    process.env.PODCASTINDEX_API_SECRET = 'secret-test';
    const err = new Error('Request failed with status code 401');
    err.response = { status: 401 };
    const spy = jest.spyOn(podcastIndexService, 'searchPodcastIndex').mockRejectedValue(err);
    try {
      const res = buildRes();
      await configTest(authReq(), res);
      expect(res.body.data.ok).toBe(false);
      expect(res.body.data.configured).toBe(true);
      expect(res.body.data.statusCode).toBe(401);
    } finally {
      spy.mockRestore();
      if (prevKey !== undefined) process.env.PODCASTINDEX_API_KEY = prevKey;
      else delete process.env.PODCASTINDEX_API_KEY;
      if (prevSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = prevSecret;
      else delete process.env.PODCASTINDEX_API_SECRET;
    }
  });

  it('test de connectivité : clés absentes → configured=false (aucun appel réseau)', async () => {
    const prevKey = process.env.PODCASTINDEX_API_KEY;
    const prevSecret = process.env.PODCASTINDEX_API_SECRET;
    const spy = jest.spyOn(podcastIndexService, 'searchPodcastIndex');
    try {
      delete process.env.PODCASTINDEX_API_KEY;
      delete process.env.PODCASTINDEX_API_SECRET;
      const res = buildRes();
      await configTest(authReq(), res);
      expect(res.body.data.ok).toBe(false);
      expect(res.body.data.configured).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
      if (prevKey !== undefined) process.env.PODCASTINDEX_API_KEY = prevKey;
      if (prevSecret !== undefined) process.env.PODCASTINDEX_API_SECRET = prevSecret;
    }
  });

  it('surcharges persistées : PUT /admin/config/scoring modifie le scoring, persiste en base et se réinitialise', async () => {
    setScoringOverrides(null);
    expect(decideAutoPublish(80).status).toBe('auto');

    // 1. Mise à jour des surcharges.
    const res = buildRes();
    await configScoring(
      authReq({
        body: {
          weights: { PODCAST_SCORE_LANGUE: 0, PODCAST_SCORE_TITRE_BIBLE: 30 },
          thresholds: { PODCAST_SCORE_AUTO_PUBLISH: 90, PODCAST_SCORE_PENDING_MIN: 60 },
        },
      }),
      res,
    );
    expect(res.body.success).toBe(true);
    expect(res.body.data.thresholds.autoPublish).toBe(90);
    expect(res.body.data.weights.langue.points).toBe(0);
    expect(
      res.body.data.weights.titre.find((w) => w.env === 'PODCAST_SCORE_TITRE_BIBLE').points,
    ).toBe(30);
    expect(res.body.data.overridesActive).toBe(true);

    // Le scoring en tient compte immédiatement (cache mémoire).
    expect(decideAutoPublish(85).status).toBe('pending');
    const scored = computePodcastScore({
      title: 'Bible',
      description: '',
      language: 'fr-fr',
      categories: [],
      rssValid: false,
    });
    expect(scored.score).toBe(30); // langue 0 + titre Bible 30, sans bonus RSS

    // 2. Persisté en base : un nouveau chargement depuis la config le retrouve.
    setScoringOverrides(null);
    const getRes = buildRes();
    await podcastConfig(authReq(), getRes);
    expect(getRes.body.data.scoring.thresholds.autoPublish).toBe(90);
    expect(getRes.body.data.scoring.overridesActive).toBe(true);

    // 3. Reset (objets vides) → retour à l'environnement.
    const resetRes = buildRes();
    await configScoring(authReq({ body: { weights: {}, thresholds: {} } }), resetRes);
    expect(resetRes.body.data.overridesActive).toBe(false);
    expect(decideAutoPublish(80).status).toBe('auto');

    setScoringOverrides(null); // cache propre pour les tests suivants
  });

  it('surcharges : clé inconnue ou valeur négative → 400', async () => {
    setScoringOverrides(null);
    await expect(
      configScoring(authReq({ body: { weights: { PODCAST_SCORE_NOPE: 10 } } }), buildRes()),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      configScoring(authReq({ body: { weights: { PODCAST_SCORE_LANGUE: -5 } } }), buildRes()),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      configScoring(authReq({ body: {} }), buildRes()),
    ).rejects.toMatchObject({ statusCode: 400 });
    setScoringOverrides(null);
  });

  it('passe d\u2019auto-découverte manuelle : rapport complet renvoyé (service mocké)', async () => {
    const fakeReport = {
      searched: 65,
      imported: 2,
      skipped: 0,
      results: [
        { title: 'Prières catholiques', score: 100, decision: 'auto', created: true },
        { title: 'Évangile du jour', score: 64, decision: 'pending', created: true },
      ],
    };
    const spy = jest.spyOn(schedulerModule, 'runAutoDiscoveryNow').mockResolvedValue(fakeReport);
    try {
      const res = buildRes();
      await discoverRun(authReq(), res);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(fakeReport);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('poids configurables via PODCAST_SCORE_LANGUE (bonus langue désactivé)', () => {
    const prev = process.env.PODCAST_SCORE_LANGUE;
    try {
      process.env.PODCAST_SCORE_LANGUE = '0';
      const scored = computePodcastScore({
        title: 'Sans signal',
        description: '',
        language: 'fr-fr',
        categories: [],
        rssValid: true,
      });
      // Seul le bonus RSS valide reste → 10 au lieu de 30 (langue + RSS).
      // Le critère reste visible dans le breakdown pour la transparence, à 0 pt.
      expect(scored.score).toBe(10);
      const lang = scored.breakdown.find((c) => c.label === 'Langue française');
      expect(lang).toBeTruthy();
      expect(lang.points).toBe(0);
    } finally {
      if (prev !== undefined) process.env.PODCAST_SCORE_LANGUE = prev;
      else delete process.env.PODCAST_SCORE_LANGUE;
    }
  });
});
