/**
 * Service RSS des podcasts externes (dryApp/Pelerin).
 *
 * Rôle : récupérer un flux RSS, le parser, le normaliser en une structure
 * PodcastShow + PodcastEpisode, sans jamais télécharger ni réhéberger l'audio
 * (on ne conserve que les métadonnées et les URLs d'origine).
 *
 * Le parsing utilise cheerio en mode XML (déjà présent dans les dépendances) —
 * pas de dépendance supplémentaire. Toutes les requêtes externes passent par
 * ici (jamais par l'application mobile) et sont bornées en temps / taille.
 */
const axios = require('axios');
const cheerio = require('cheerio');

const RSS_TIMEOUT_MS = 15000;
const RSS_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo — un flux RSS raisonnable est < 1 Mo
const MAX_ITEMS = 300; // borne haute d'épisodes conservés par import

/**
 * Récupère le XML d'un flux RSS.
 * @param {string} rssUrl
 * @returns {Promise<string>}
 */
async function fetchRssXml(rssUrl) {
  const { data } = await axios.get(rssUrl, {
    timeout: RSS_TIMEOUT_MS,
    maxContentLength: RSS_MAX_BYTES,
    maxBodyLength: RSS_MAX_BYTES,
    headers: {
      'User-Agent': 'LePelerin-PodcastBot/1.0 (+https://lepelerin.app)',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    responseType: 'text',
    // Le serveur peut renvoyer un charset inconnu ; on laisse axios/iconv
    // décoder, et on tolère les flux sans XML declaration correcte.
    transformResponse: [(d) => d],
  });
  if (typeof data !== 'string' || !data.trim()) {
    throw new Error('RSS vide ou illisible');
  }
  return data;
}

/**
 * Parse un document XML RSS 2.0 / iTunes avec cheerio (mode XML).
 * @param {string} xml
 * @returns {{channel: object, items: object[]}}
 */
function parseRssXml(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });

  const channel = $('rss > channel').first();
  if (!channel.length) {
    // Atom ? On ne supporte que RSS 2.0 (flux iTunes classiques).
    throw new Error("Flux non reconnu : RSS 2.0 attendu (balise <rss><channel> absente)");
  }

  // Lecture des balises ENFANTS du channel (scopée, pas de sélecteur global).
  const channelText = (name) => channel.children(name).first().text().trim();

  const imageUrl =
    channel.children('image').children('url').first().text().trim() ||
    channel.children('itunes\\:image').first().attr('href') ||
    '';

  const channelData = {
    title: channelText('title'),
    description: channelText('description'),
    author: channelText('itunes\\:author') || channelText('managingEditor'),
    imageUrl,
    websiteUrl: channelText('link'),
    language: channelText('language') || 'fr',
  };

  const items = [];
  channel.find('item').each((_i, el) => {
    const item = $(el);
    const enclosure = item.find('enclosure').first();
    const guid = item.find('guid').first().text().trim() || item.find('link').first().text().trim() || '';
    const episodeNumberRaw = textOf(item, 'itunes\\:episode');
    const seasonRaw = textOf(item, 'itunes\\:season');
    const durationRaw = textOf(item, 'itunes\\:duration');
    const itemImage =
      item.find('itunes\\:image').first().attr('href') ||
      item.find('media\\:thumbnail').first().attr('url') ||
      '';

    const sizeRaw = parseInt(enclosure.attr('length') || '', 10);
    items.push({
      guid,
      title: textOf(item, 'title'),
      description: textOf(item, 'description'),
      audioUrl: enclosure.attr('url') || '',
      audioType: enclosure.attr('type') || '',
      sizeBytes: Number.isFinite(sizeRaw) && sizeRaw > 0 ? sizeRaw : null,
      imageUrl: itemImage,
      link: item.find('link').first().text().trim(),
      publishedAt: textOf(item, 'pubDate'),
      durationRaw,
      episodeNumber: episodeNumberRaw ? parseInt(episodeNumberRaw, 10) : undefined,
      season: seasonRaw ? parseInt(seasonRaw, 10) : undefined,
    });
  });

  return { channel: channelData, items };
}

function textOf($el, selector) {
  return $el.find(selector).first().text().trim();
}

/**
 * Normalise une durée iTunes : "3600" (secondes), "32:10", "1:02:30" →
 * "hh:mm:ss" ou "mm:ss" (même format que les épisodes éditoriaux existants).
 * @param {string} raw
 * @returns {string}
 */
function normalizeDuration(raw) {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value) return '';

  if (/^\d+$/.test(value)) {
    // Secondes brutes
    const total = parseInt(value, 10);
    if (total <= 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  // "32:10", "1:02:30"
  const parts = value.split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return '';
  return parts
    .map((p, i) => (i === 0 ? String(p) : String(p).padStart(2, '0')))
    .join(':');
}

/**
 * Normalise une date RSS (RFC 822 ou ISO).
 * @param {string} raw
 * @returns {Date}
 */
function normalizeDate(raw) {
  if (!raw) return new Date();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Extrait les URLs audio d'un item : enclosure de type audio, sinon premier
 * lien http(s) .mp3/.m4a/.ogg, sinon rien.
 * @param {object} item
 */
function pickAudioUrl(item) {
  const enclosure = item.audioUrl && (item.audioType || '').startsWith('audio') ? item.audioUrl : '';
  if (enclosure) return enclosure;
  if (/\.(mp3|m4a|ogg|opus|aac)(\?.*)?$/i.test(item.audioUrl || '')) return item.audioUrl;
  return '';
}

/**
 * Point d'entrée principal : fetch + parse + normalisation complète.
 * @param {string} rssUrl
 * @returns {Promise<{show: object, episodes: object[]}>}
 */
async function fetchAndNormalizeFeed(rssUrl) {
  const xml = await fetchRssXml(rssUrl);
  const { channel, items } = parseRssXml(xml);

  if (!channel.title) {
    throw new Error('Flux RSS sans titre (channel.title manquant)');
  }

  const episodes = items
    .filter((it) => it.title && pickAudioUrl(it))
    .slice(0, MAX_ITEMS)
    .map((it) => ({
      guid: it.guid,
      title: it.title,
      description: it.description,
      audioUrl: pickAudioUrl(it),
      coverUrl: it.imageUrl,
      publishedAt: normalizeDate(it.publishedAt),
      duration: normalizeDuration(it.durationRaw),
      sizeBytes: it.sizeBytes ?? null,
      episodeNumber: it.episodeNumber || 0,
      season: it.season || 1,
      link: it.link,
    }));

  return {
    show: {
      title: channel.title,
      description: channel.description || '',
      author: channel.author || '',
      coverUrl: channel.imageUrl || '',
      websiteUrl: channel.websiteUrl || '',
      language: (channel.language || 'fr').slice(0, 10),
      rssUrl,
    },
    episodes,
  };
}

module.exports = {
  fetchRssXml,
  parseRssXml,
  normalizeDuration,
  normalizeDate,
  fetchAndNormalizeFeed,
  RSS_TIMEOUT_MS,
  RSS_MAX_BYTES,
};
