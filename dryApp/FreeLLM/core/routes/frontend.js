/**
 * Frontend Routes — Sert le dashboard HTML.
 */

const express = require('express');
const path = require('path');

function createFrontendRouter() {
  const router = express.Router();

  // Serve dashboard at root (since router is mounted at /dashboard)
  router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dashboard.html'));
  });

  return router;
}

module.exports = { createFrontendRouter };
