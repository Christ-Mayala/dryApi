/**
 * Routes App-Update — Manifeste de mise à jour Trivida
 *
 *   GET /api/v1/trivida/app/update  →  manifeste { latest, minimum, force, changelog }
 *
 * Public, sans auth : l'app le consulte au démarrage, avant toute connexion.
 * Le manifeste vit dans manifest.json, modifiable au déploiement pour déclencher :
 *   - une mise à jour NORMALE  → { latest > versionCourante, force:false } (fermable) ;
 *   - une mise à jour FORCÉE   → { minimum > versionCourante, force:true } (bloquante).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const sendResponse = require('../../../../../dry/utils/http/response');

const manifestPath = path.join(__dirname, '../../../app-update/manifest.json');

router.get('/update', (req, res) => {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    // Cache court (2 min) : le manifeste doit pouvoir être rafraîchi vite après un deploy.
    res.setHeader('Cache-Control', 'public, max-age=120');
    return sendResponse(res, manifest, 'Manifeste de mise à jour', true);
  } catch (err) {
    console.error('[app-update] Manifeste illisible:', err.message);
    return sendResponse(
      res,
      null,
      'Manifeste de mise à jour indisponible',
      false,
      undefined,
      500
    );
  }
});

module.exports = router;