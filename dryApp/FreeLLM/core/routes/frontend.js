/**
 * Frontend Routes — Sert le dashboard HTML.
 */

const express = require('express');
const path = require('path');

function createFrontendRouter() {
  const router = express.Router();

  // Serve dashboard at /dashboard
  router.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dashboard.html'));
  });

  // Redirect root to dashboard
  router.get('/', (req, res) => {
    res.redirect('/dashboard');
  });

  return router;
}

module.exports = { createFrontendRouter };
