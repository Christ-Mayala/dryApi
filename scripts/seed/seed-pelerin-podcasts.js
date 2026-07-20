#!/usr/bin/env node

/**
 * Contenu REEL (pas des placeholders example.com) pour audioTrack/podcastShow/
 * podcastEpisode du tenant Pelerin : lectures bibliques du domaine public
 * (LibriVox/archive.org, Louis Segond 1910 — meme version que la Bible ecrite
 * deja importee) + quelques hymnes du domaine public. Additif uniquement :
 * verifie par titre avant d'inserer, ne supprime jamais rien (voir la
 * convention documentee dans scripts/seed/seed-all.js et l'incident relate
 * dans docs/ROADMAP.md). Les anciennes pistes [EXEMPLE] a base d'URLs
 * example.com restent en place — a supprimer manuellement depuis l'espace
 * admin (Profil > Espace administrateur > Chants & louanges) si besoin.
 */

require('dotenv').config();
require('dns').setServers(['1.1.1.1', '8.8.8.8']);

const path = require('path');
const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const log = (msg) => console.log(`[seed-pelerin-podcasts] ${msg}`);

const HYMNS = [
  {
    title: 'Public Domain Hymns — Chant 1',
    artist: 'LibriVox (domaine public)',
    category: 'louange',
    url: 'https://archive.org/download/publicdomainhymns_01_1110_librivox/publicdomainhymns_01_01.mp3',
  },
  {
    title: 'Public Domain Hymns — Chant 2',
    artist: 'LibriVox (domaine public)',
    category: 'louange',
    url: 'https://archive.org/download/publicdomainhymns_01_1110_librivox/publicdomainhymns_01_02.mp3',
  },
  {
    title: 'Public Domain Hymns — Chant 3',
    artist: 'LibriVox (domaine public)',
    category: 'louange',
    url: 'https://archive.org/download/publicdomainhymns_01_1110_librivox/publicdomainhymns_01_03.mp3',
  },
  {
    title: 'Public Domain Hymns — Chant 4',
    artist: 'LibriVox (domaine public)',
    category: 'louange',
    url: 'https://archive.org/download/publicdomainhymns_01_1110_librivox/publicdomainhymns_01_04.mp3',
  },
];

const JEAN_EPISODES = [
  { season: 1, episodeNumber: 1, title: 'Jean 1 à 5', audioUrl: 'https://archive.org/download/jean_lsg_librivox/jean_01-05_bible_lsg-1910_64kb.mp3' },
  { season: 1, episodeNumber: 2, title: 'Jean 6 à 8', audioUrl: 'https://archive.org/download/jean_lsg_librivox/jean_06-08_bible_lsg-1910_64kb.mp3' },
  { season: 1, episodeNumber: 3, title: 'Jean 9 à 12', audioUrl: 'https://archive.org/download/jean_lsg_librivox/jean_09-12_bible_lsg-1910_64kb.mp3' },
  { season: 1, episodeNumber: 4, title: 'Jean 13 à 17', audioUrl: 'https://archive.org/download/jean_lsg_librivox/jean_13-17_bible_lsg-1910_64kb.mp3' },
  { season: 1, episodeNumber: 5, title: 'Jean 18 à 21', audioUrl: 'https://archive.org/download/jean_lsg_librivox/jean_18-21_bible_lsg-1910_64kb.mp3' },
];

const BIBLE_COVER = 'https://upload.wikimedia.org/wikipedia/commons/d/d7/Holy_bible_book.jpg';

const run = async () => {
  await connectCluster();
  getTenantDB('Pelerin');
  log('PelerinDB connectee.');

  const audioTrackSchema = require(path.join(__dirname, '..', '..', 'dryApp', 'Pelerin', 'features', 'audioTrack', 'model', 'audioTrack.schema.js'));
  const podcastShowSchema = require(path.join(__dirname, '..', '..', 'dryApp', 'Pelerin', 'features', 'podcastShow', 'model', 'podcastShow.schema.js'));
  const podcastEpisodeSchema = require(path.join(__dirname, '..', '..', 'dryApp', 'Pelerin', 'features', 'podcastEpisode', 'model', 'podcastEpisode.schema.js'));

  const AudioTrack = getModel('Pelerin', 'AudioTrack', audioTrackSchema);
  const PodcastShow = getModel('Pelerin', 'PodcastShow', podcastShowSchema);
  const PodcastEpisode = getModel('Pelerin', 'PodcastEpisode', podcastEpisodeSchema);

  let created = 0;

  for (const hymn of HYMNS) {
    const exists = await AudioTrack.countDocuments({ title: hymn.title });
    if (exists > 0) continue;
    await AudioTrack.create(hymn);
    created += 1;
    log(`Piste creee : ${hymn.title}`);
  }

  const showsToSeed = [
    {
      title: 'Évangile selon Jean (lu)',
      description:
        "L'Évangile selon Jean, lu intégralement en français (Louis Segond 1910) — enregistrement du domaine public (LibriVox).",
      author: 'LibriVox (domaine public)',
      category: 'etude-biblique',
      coverUrl: BIBLE_COVER,
      episodes: JEAN_EPISODES,
    },
    {
      title: 'Cantique des Cantiques (lu)',
      description:
        'Le Cantique des Cantiques, lu intégralement en français (Louis Segond 1910) — enregistrement du domaine public (LibriVox).',
      author: 'LibriVox (domaine public)',
      category: 'etude-biblique',
      coverUrl: BIBLE_COVER,
      episodes: [
        {
          season: 1,
          episodeNumber: 1,
          title: 'Cantique des Cantiques (intégral)',
          audioUrl:
            'https://archive.org/download/le_cantique_des_cantiques_lsg_ezwa_librivox/cantique_bible_lsg-1910_64kb.mp3',
        },
      ],
    },
  ];

  for (const showData of showsToSeed) {
    const existingShow = await PodcastShow.findOne({ title: showData.title });
    let show = existingShow;
    if (!show) {
      show = await PodcastShow.create({
        title: showData.title,
        description: showData.description,
        author: showData.author,
        category: showData.category,
        coverUrl: showData.coverUrl,
      });
      created += 1;
      log(`Émission créée : ${show.title}`);
    }

    for (const ep of showData.episodes) {
      const exists = await PodcastEpisode.countDocuments({ showId: show._id, episodeNumber: ep.episodeNumber, season: ep.season });
      if (exists > 0) continue;
      await PodcastEpisode.create({
        showId: show._id,
        season: ep.season,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        audioUrl: ep.audioUrl,
        coverUrl: showData.coverUrl,
      });
      created += 1;
      log(`Épisode créé : ${show.title} — ${ep.title}`);
    }
  }

  log(`Termine. ${created} document(s) cree(s).`);
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    log(`Erreur: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  });
