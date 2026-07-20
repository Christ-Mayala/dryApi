/**
 * Tests d'integration — Pelerin / features "podcastShow" + "podcastEpisode"
 *
 * Contenu editorial : lecture publique filtree sur isPublished, vue admin
 * ("...GetAllAdmin") qui montre tout (publie ou non).
 *
 * @module tests/Pelerin/podcast.test
 */

const { setupPelerinTestDB, getPelerinModel, buildReq, buildRes } = require('./_helpers/pelerinTestUtils');

const PodcastEpisodeSchema = require('../../dryApp/Pelerin/features/podcastEpisode/model/podcastEpisode.schema');

const createPodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.create.controller');
const getAllPodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.getAll.controller');
const getAllAdminPodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.getAllAdmin.controller');
const getByIdPodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.getById.controller');
const updatePodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.update.controller');
const deletePodcastShow = require('../../dryApp/Pelerin/features/podcastShow/controller/podcastShow.delete.controller');

const createPodcastEpisode = require('../../dryApp/Pelerin/features/podcastEpisode/controller/podcastEpisode.create.controller');
const getAllPodcastEpisode = require('../../dryApp/Pelerin/features/podcastEpisode/controller/podcastEpisode.getAll.controller');

describe('Pelerin — podcastShow + podcastEpisode', () => {
  setupPelerinTestDB();

  it('cree une emission publiee par defaut, visible publiquement', async () => {
    const req = buildReq({ body: { title: 'Ecoute la Parole', description: 'Un podcast biblique' } });
    const res = buildRes();
    await createPodcastShow(req, res);

    expect(res.body.success).toBe(true);
    expect(res.body.data.isPublished).toBe(true);

    const listRes = buildRes();
    await getAllPodcastShow(buildReq(), listRes);
    expect(listRes.body.data.some((s) => String(s._id) === String(res.body.data._id))).toBe(true);
  });

  it('une emission non publiee est cachee de la liste publique mais visible via la vue admin', async () => {
    const req = buildReq({ body: { title: 'Brouillon', description: 'Pas encore pret', isPublished: 'false' } });
    const res = buildRes();
    await createPodcastShow(req, res);
    expect(res.body.data.isPublished).toBe(false);

    const publicListRes = buildRes();
    await getAllPodcastShow(buildReq(), publicListRes);
    expect(publicListRes.body.data.find((s) => String(s._id) === String(res.body.data._id))).toBeUndefined();

    const adminListRes = buildRes();
    await getAllAdminPodcastShow(buildReq(), adminListRes);
    expect(adminListRes.body.data.some((s) => String(s._id) === String(res.body.data._id))).toBe(true);
  });

  it('rejette la creation sans title/description', async () => {
    const req = buildReq({ body: { title: 'Sans description' } });
    await expect(createPodcastShow(req, buildRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('met a jour puis supprime une emission (admin)', async () => {
    const createRes = buildRes();
    await createPodcastShow(buildReq({ body: { title: 'A modifier', description: 'Desc' } }), createRes);
    const showId = createRes.body.data._id;

    const updateReq = buildReq({ params: { id: String(showId) }, body: { title: 'Titre modifie' } });
    const updateRes = buildRes();
    await updatePodcastShow(updateReq, updateRes);
    expect(updateRes.body.data.title).toBe('Titre modifie');

    const deleteReq = buildReq({ params: { id: String(showId) } });
    const deleteRes = buildRes();
    await deletePodcastShow(deleteReq, deleteRes);
    expect(deleteRes.body.success).toBe(true);

    const getRes = buildRes();
    await expect(getByIdPodcastShow(buildReq({ params: { id: String(showId) } }), getRes)).rejects.toBeTruthy();
  });

  it('un episode publie apparait dans la liste publique filtree par showId', async () => {
    const showRes = buildRes();
    await createPodcastShow(buildReq({ body: { title: 'Emission', description: 'Desc' } }), showRes);
    const showId = showRes.body.data._id;

    const episodeReq = buildReq({
      body: {
        showId: String(showId),
        episodeNumber: 1,
        title: 'Episode 1',
        audioUrl: 'https://cdn.example.com/ep1.mp3',
      },
    });
    const episodeRes = buildRes();
    await createPodcastEpisode(episodeReq, episodeRes);
    expect(episodeRes.body.success).toBe(true);

    const listRes = buildRes();
    await getAllPodcastEpisode(buildReq({ query: { showId: String(showId) } }), listRes);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].title).toBe('Episode 1');
  });

  it('un episode non publie est absent de la liste publique', async () => {
    const showRes = buildRes();
    await createPodcastShow(buildReq({ body: { title: 'Emission2', description: 'Desc' } }), showRes);
    const showId = showRes.body.data._id;

    // NOTE (bug potentiel releve pendant les tests) : contrairement a
    // podcastShow.create.controller.js, podcastEpisode.create.controller.js ne
    // reprend PAS req.body.isPublished dans son pickDefined([...]) — un episode
    // est donc toujours cree avec isPublished=true par defaut, quoi que le
    // client envoie. On construit ici directement le document via le Model pour
    // pouvoir verifier le filtrage de la liste publique malgre cette limite du
    // controller (voir features/podcastEpisode/controller/podcastEpisode.create.controller.js
    // ligne ~32, pickDefined n'inclut pas 'isPublished').
    const EpisodeModel = getPelerinModel('PodcastEpisode', PodcastEpisodeSchema);
    await EpisodeModel.create({
      showId,
      episodeNumber: 1,
      title: 'Episode cache',
      audioUrl: 'https://cdn.example.com/hidden.mp3',
      isPublished: false,
    });

    const listRes = buildRes();
    await getAllPodcastEpisode(buildReq({ query: { showId: String(showId) } }), listRes);
    expect(listRes.body.data).toHaveLength(0);
  });
});
