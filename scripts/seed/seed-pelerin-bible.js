#!/usr/bin/env node
/**
 * Import du texte biblique complet (Phase 1) pour le tenant Pelerin.
 *
 * Importe 3 versions du domaine public dans PelerinDB.BibleVerse :
 *   - LSG1910 : Louis Segond (1910), francais
 *   - DARBY   : Bible J.N. Darby, francais (edition 1885, revisee)
 *   - KJV     : King James Version (1769), anglais
 *
 * Source des donnees : projet getbible/v2 (https://github.com/getbible/v2),
 * dump JSON complet par version via l'API statique https://api.getbible.net/v2/<code>.json
 * (kjv.json, ls1910.json, darby.json). Textes du domaine public (traducteurs
 * decedes depuis longtemps) ; voir dryApp/Pelerin/README.md pour le detail des
 * licences telles que documentees par getbible/v2.
 *
 * Ce script :
 *  - ne touche QUE le tenant 'Pelerin' (PelerinDB), jamais un autre tenant.
 *  - telecharge (une seule fois, avec cache local) puis parse les 3 fichiers source.
 *  - mappe chaque livre par POSITION (1er livre = Genese = order 1, etc.), pas par nom,
 *    en reutilisant telle quelle la reference canonique BIBLE_BOOKS de dryApp/Pelerin/seed.js.
 *  - insere par lots de 2000 documents (insertMany, ordered:false), idempotent : les
 *    doublons (index unique {version,bookCode,chapter,verse}) sont ignores proprement.
 *
 * Usage : npm run seed:pelerin-bible
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Filet de securite reseau local : sur certains postes/sandbox, le resolveur DNS
// par defaut (souvent 127.0.0.1, ex. proxy/VPN local) refuse les requetes SRV
// (mongodb+srv://) alors que le resolveur systeme (nslookup) fonctionne. On force
// des resolveurs publics fiables pour CE script uniquement (aucun impact sur le
// reste de l'app / dbConnection.js).
try {
  dns.setServers(['1.1.1.1', '8.8.8.8', ...dns.getServers()]);
} catch (e) {
  // best-effort, non bloquant
}

const { connectCluster, getTenantDB } = require('../../dry/config/connection/dbConnection');
const getModel = require('../../dry/core/factories/modelFactory');

const BibleVerseSchema = require('../../dryApp/Pelerin/features/bible/model/bible.schema');
const { BIBLE_BOOKS } = require('../../dryApp/Pelerin/seed.js');

const APP_NAME = 'Pelerin'; // Ne JAMAIS rendre ceci configurable via argv/env dans ce script.

const DATA_DIR = path.join(__dirname, 'data', 'pelerin-bible');
const BATCH_SIZE = 2000;

// Sources getbible/v2 — dump JSON complet par version (66 livres, ordre canonique standard).
const SOURCES = [
  {
    version: 'LSG1910',
    file: 'ls1910.json',
    url: 'https://api.getbible.net/v2/ls1910.json',
    nameField: 'nameFr',
  },
  {
    version: 'DARBY',
    file: 'darby.json',
    url: 'https://api.getbible.net/v2/darby.json',
    nameField: 'nameFr',
  },
  {
    version: 'KJV',
    file: 'kjv.json',
    url: 'https://api.getbible.net/v2/kjv.json',
    nameField: 'nameEn',
  },
];

const log = (msg) => console.log(`[seed-pelerin-bible] ${msg}`);

/**
 * Telecharge le fichier source s'il n'est pas deja en cache local (scripts/seed/data/pelerin-bible/).
 */
const ensureSourceFile = async (source) => {
  const localPath = path.join(DATA_DIR, source.file);
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) {
    log(`${source.version}: fichier source en cache (${localPath})`);
    return localPath;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  log(`${source.version}: telechargement depuis ${source.url} ...`);

  const res = await fetch(source.url);
  if (!res.ok) {
    throw new Error(`Echec telechargement ${source.url} : HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(localPath, buffer);
  log(`${source.version}: telecharge (${(buffer.length / 1024 / 1024).toFixed(1)} Mo)`);
  return localPath;
};

/**
 * Nettoie le texte d'un verset : trim, espaces multiples/insecables normalises,
 * suppression defensive d'eventuelles balises residuelles.
 */
const cleanText = (raw) => {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '') // balises HTML/XML residuelles (defensif, source deja propre)
    .replace(/ /g, ' ') // espaces insecables -> espace normal
    .replace(/[ \t]+/g, ' ') // espaces multiples
    .replace(/\s+\n/g, '\n')
    .trim()
    .normalize('NFC');
};

/**
 * Transforme le dump getbible/v2 d'une version en documents BibleVerse, en mappant
 * les livres par POSITION (index 0 = Genese = BIBLE_BOOKS[0], ..., index 65 = Apocalypse).
 */
const buildDocsForVersion = (source, sourceJson) => {
  const books = sourceJson.books;
  if (!Array.isArray(books) || books.length !== 66) {
    throw new Error(
      `${source.version}: source invalide, attendu 66 livres, trouve ${books && books.length}`
    );
  }

  const docs = [];
  const perBookCount = [];

  for (let i = 0; i < 66; i++) {
    const refBook = BIBLE_BOOKS[i]; // { order, code, nameFr, nameEn, testament, chapterCount }
    const srcBook = books[i];
    const displayName = refBook[source.nameField];
    let verseCount = 0;

    for (const chapterEntry of srcBook.chapters) {
      const chapterNum = Number(chapterEntry.chapter);
      for (const verseEntry of chapterEntry.verses) {
        const text = cleanText(verseEntry.text);
        if (!text) continue; // ignorer les versets vides/orphelins eventuels

        docs.push({
          version: source.version,
          bookCode: refBook.code,
          book: displayName,
          testament: refBook.testament,
          chapter: chapterNum,
          verse: Number(verseEntry.verse),
          text,
          label: `${displayName} ${chapterNum}:${verseEntry.verse}`,
          // Slug deterministe et unique par verset : evite la generation auto du plugin DRY
          // (qui utiliserait Date.now(), source de collisions lors d'un insertMany massif).
          slug: `${source.version.toLowerCase()}-${refBook.code}-${chapterNum}-${verseEntry.verse}`,
        });
        verseCount++;
      }
    }
    perBookCount.push({ code: refBook.code, verses: verseCount });
  }

  return { docs, perBookCount };
};

/**
 * Insere les documents par lots, en ignorant proprement les doublons (E11000) grace
 * a l'index unique {version,bookCode,chapter,verse}. Idempotent : un second lancement
 * ne fait que sauter les versets deja presents.
 */
const insertInBatches = async (Model, docs, version) => {
  let inserted = 0;
  let duplicates = 0;
  let otherErrors = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = docs.slice(i, i + BATCH_SIZE);
    try {
      const result = await Model.insertMany(batch, { ordered: false });
      inserted += result.length;
    } catch (err) {
      // insertMany avec ordered:false leve une erreur globale meme si une partie a reussi.
      // err.insertedDocs contient les documents effectivement inseres (mongoose bulk write).
      const insertedCount = Array.isArray(err.insertedDocs) ? err.insertedDocs.length : 0;
      inserted += insertedCount;

      const writeErrors = err.writeErrors || (err.result && err.result.result && err.result.result.writeErrors) || [];
      if (writeErrors.length) {
        for (const we of writeErrors) {
          const code = we.code || we.err?.code || we.result?.code;
          if (code === 11000) {
            duplicates++;
          } else {
            otherErrors++;
            log(`  ! erreur non-doublon : ${JSON.stringify(we.errmsg || we.err?.errmsg || we.message).slice(0, 200)}`);
          }
        }
      } else if (err.code === 11000) {
        duplicates += batch.length - insertedCount;
      } else {
        otherErrors += batch.length - insertedCount;
        log(`  ! erreur batch [${i}-${i + batch.length}] : ${err.message}`);
      }
    }

    const progress = Math.min(i + BATCH_SIZE, docs.length);
    log(`${version}: ${progress}/${docs.length} versets traites (${inserted} inseres, ${duplicates} doublons ignores)`);
  }

  return { inserted, duplicates, otherErrors };
};

const main = async () => {
  log(`Connexion au cluster MongoDB Atlas...`);
  await connectCluster();

  const db = getTenantDB(APP_NAME);
  log(`Base cible : ${db.name} (tenant '${APP_NAME}')`);
  if (db.name !== `${APP_NAME}DB`) {
    throw new Error(`Garde-fou : base cible inattendue (${db.name}), attendu ${APP_NAME}DB. Abandon.`);
  }

  const BibleVerse = getModel(APP_NAME, 'BibleVerse', BibleVerseSchema);
  const BibleBook = getModel(APP_NAME, 'BibleBook', require('../../dryApp/Pelerin/features/bibleBook/model/bibleBook.schema.js'));

  const bookCount = await BibleBook.countDocuments();
  if (bookCount < 66) {
    log(`! Attention : seulement ${bookCount}/66 BibleBook trouves. Lance d'abord "npm run seed" (referentiel des livres).`);
  }

  const summary = [];

  for (const source of SOURCES) {
    const localPath = await ensureSourceFile(source);
    log(`${source.version}: lecture et parsing de ${localPath}...`);
    const sourceJson = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    const { docs, perBookCount } = buildDocsForVersion(source, sourceJson);
    log(`${source.version}: ${docs.length} versets a inserer/verifier (66 livres).`);

    const emptyBooks = perBookCount.filter((b) => b.verses === 0);
    if (emptyBooks.length) {
      log(`${source.version}: ! ${emptyBooks.length} livre(s) sans aucun verset : ${emptyBooks.map((b) => b.code).join(', ')}`);
    }

    const result = await insertInBatches(BibleVerse, docs, source.version);
    summary.push({ version: source.version, total: docs.length, ...result });
  }

  log('');
  log('=== Resume import biblique (Pelerin) ===');
  for (const s of summary) {
    log(`${s.version} : ${s.total} versets source | ${s.inserted} inseres | ${s.duplicates} doublons ignores | ${s.otherErrors} erreurs`);
  }

  const totalErrors = summary.reduce((sum, s) => sum + s.otherErrors, 0);
  if (totalErrors > 0) {
    log(`! ${totalErrors} erreur(s) non liees a des doublons detectees, voir logs ci-dessus.`);
    process.exitCode = 1;
  } else {
    log('Import termine sans erreur.');
  }
};

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error('[seed-pelerin-bible] Erreur fatale :', err);
    process.exit(1);
  });
