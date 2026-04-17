const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const redisService = require('../cache/redis.service');
const config = require('../../../config/database');
const { getAppNames } = require('../../core/application/appScanner');
const { PROFESSIONAL_TEMPLATES } = require('../../../scripts/generator/create-app');

class HealthService {
  getAllowedOrigins() {
    return String(config.ALLOWED_ORIGINS || '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  getBaseUrl(port = config.PORT) {
    return config.SERVER_URL || `http://localhost:${port}`;
  }

  getRedisStatusMeta(redisStatus) {
    if (!redisStatus.enabled) return { state: 'INFO', label: 'Désactivé' };
    return redisStatus.connected
      ? { state: 'OK', label: 'Connecté' }
      : { state: 'WARN', label: 'Indisponible' };
  }

  getDatabaseStatusMeta(dbInfo) {
    return dbInfo.status === 'UP'
      ? { state: 'OK', label: 'Connecté' }
      : { state: 'WARN', label: 'Indisponible' };
  }

  async getHealthStatus() {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const dbStatus = mongoose.connection.readyState === 1 ? 'UP' : 'DOWN';
    const dbInfo = {
      status: dbStatus,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
    };

    const redisStatus = redisService.getStatus();
    const redisEnabledFlag = String(config.REDIS_ENABLED || '').toLowerCase();
    const redisEnabled =
      redisEnabledFlag === 'true' || (!!config.REDIS_URL && redisEnabledFlag !== 'false');
    redisStatus.enabled = redisEnabled;

    // Exécution parallèle des tâches indépendantes
    const applications = await this.getAppsStatus();
    const allServicesUp = dbStatus === 'UP' && (!redisEnabled || redisStatus.connected);
    const globalStatus = allServicesUp ? 'OK' : 'DEGRADED';

    return {
      status: globalStatus,
      timestamp,
      uptime: {
        seconds: uptime,
        human: this.formatUptime(uptime),
      },
      services: {
        database: dbInfo,
        redis: redisStatus,
        memory: {
          rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
          external: `${Math.round(memory.external / 1024 / 1024)}MB`,
        },
        applications,
      },
      version: config.APP_VERSION || '1.0.0',
      environment: config.NODE_ENV || 'development',
    };
  }

  async getAppsStatus() {
    const appNames = getAppNames();
    // Utilisation de Promise.all pour paralléliser les lectures de dossiers
    const appPromises = appNames.map(async (appName) => {
      try {
        const featuresPath = path.join(__dirname, '../../../dryApp', appName, 'features');
        let featureCount = 0;
        
        try {
          await fs.access(featuresPath); // Vérifie l'existence sans lire immédiatement
          const entries = await fs.readdir(featuresPath, { withFileTypes: true });
          featureCount = entries.filter(entry => entry.isDirectory()).length;
        } catch (err) {
          // Le dossier n'existe pas ou n'est pas accessible
          featureCount = 0;
        }

        return {
          name: appName,
          status: 'ACTIVE',
          features: featureCount,
          database: `${appName}DB`,
        };
      } catch (error) {
        return {
          name: appName,
          status: 'ERROR',
          error: error.message,
        };
      }
    });

    return Promise.all(appPromises);
  }

  async getSystemOverview(port = config.PORT) {
    const health = await this.getHealthStatus();
    const baseUrl = this.getBaseUrl(port);
    const databaseMeta = this.getDatabaseStatusMeta(health.services.database);
    const redisMeta = this.getRedisStatusMeta(health.services.redis);
    const applications = health.services.applications || [];
    const activeApps = applications.filter((app) => app.status === 'ACTIVE').length;
    const totalFeatures = applications.reduce((sum, app) => sum + (app.features || 0), 0);

    return {
      status: health.status,
      headline: health.status === 'OK' ? 'Système prêt' : 'Système dégradé',
      timestamp: health.timestamp,
      environment: health.environment,
      version: health.version,
      uptime: health.uptime,
      port,
      corsOrigins: this.getAllowedOrigins(),
      urls: {
        base: baseUrl,
        health: `${baseUrl}/health/ready`,
        swagger: `${baseUrl}/api-docs`,
        systemStatus: `${baseUrl}/system/status`,
      },
      items: [
        {
          label: 'Base de données',
          state: databaseMeta.state,
          value: `${databaseMeta.label}${health.services.database.name ? ` (${health.services.database.name})` : ''}`,
        },
        {
          label: 'Redis',
          state: redisMeta.state,
          value: redisMeta.label,
        },
        {
          label: 'Applications',
          state: activeApps > 0 ? 'OK' : 'WARN',
          value: `${activeApps} app(s) active(s), ${totalFeatures} feature(s)`,
        },
        {
          label: 'Mémoire',
          state: 'INFO',
          value: `${health.services.memory.heapUsed} heap / ${health.services.memory.rss} rss`,
        },
        {
          label: 'Documentation',
          state: 'INFO',
          value: `${baseUrl}/api-docs`,
        },
      ],
      applications,
      health,
    };
  }

  renderSystemStatusPage(overview) {
    // Extraction des icônes pour éviter la duplication dans le template
    const statusIcons = {
      OK: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
      WARN: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      INFO: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
    };

    const badgeColor = {
      OK: { bg: '#e8f5e9', fg: '#1b5e20', border: '#81c784' },
      WARN: { bg: '#fff3e0', fg: '#e65100', border: '#ffb74d' },
      INFO: { bg: '#e3f2fd', fg: '#0d47a1', border: '#90caf9' },
      DEGRADED: { bg: '#ffebee', fg: '#c62828', border: '#ef9a9a' },
    };

    const renderBadge = (state) => {
      const palette = badgeColor[state] || badgeColor.INFO;
      const icon = statusIcons[state] || statusIcons.INFO;
      return `<span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;background:${palette.bg};color:${palette.fg};border:1px solid ${palette.border};">${icon}${state}</span>`;
    };

    const rows = overview.items
      .map(
        (item) => `
          <tr>
            <td style="padding:14px 16px;border-bottom:1px solid #eef1f4;font-weight:600;display:flex;align-items:center;gap:8px;">${item.label}</td>
            <td style="padding:14px 16px;border-bottom:1px solid #eef1f4;">${renderBadge(item.state)}</td>
            <td style="padding:14px 16px;border-bottom:1px solid #eef1f4;color:#4a5568;">${item.value}</td>
          </tr>`
      )
      .join('');

    const apps = overview.applications
      .map(
        (app) => `
          <li style="margin-bottom:10px;display:flex;align-items:center;gap:10px;">
            ${statusIcons[app.status === 'ACTIVE' ? 'OK' : 'WARN']}
            <strong style="color:#2d3748;">${app.name}</strong>
            <span style="font-size:13px;color:#718096;">(${app.features || 0} feature(s))</span>
          </li>`
      )
      .join('');

    const actionButtons = [
      { id: 'seed', label: 'Données (Seed)', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6a9 3 0 1 0 18 0a9 3 0 0 0-18 0"/><path d="M3 6v12a9 3 0 0 0 18 0V6"/><path d="M3 12a9 3 0 1 0 18 0"/></svg>' },
      { id: 'purge', label: 'Purger Supprimés', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' },
      { id: 'backup', label: 'Sauvegarder DB', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' },
      { id: 'swagger', label: 'Régénérer Doc', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' },
      { id: 'restart', label: 'Redémarrer', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' },
    ]
      .map(
        (action) => `
        <button onclick="window.runAction('${action.id}', '${action.label}')" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 18px;background:white;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;font-weight:600;color:#4a5568;transition:all 0.2s ease;box-shadow:0 1px 2px rgba(0,0,0,0.05);">
          <span style="display:flex;color:#64748b;">${action.icon}</span>
          <span>${action.label}</span> 
        </button>`
      )
      .join('');

    // Template HTML - optimisation de la taille en supprimant les commentaires inutiles
    return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard Système DRY</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      /* Minified version for performance */
      body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#f0f2f5;color:#1e293b;margin:0;padding:0;line-height:1.6;-webkit-font-smoothing:antialiased;}
      .shell{max-width:1200px;margin:0 auto;padding:32px 24px;}
      .hero{background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);color:white;padding:48px;border-radius:24px;box-shadow:0 20px 40px -10px rgba(0,0,0,0.3);margin-bottom:40px;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.05);}
      .hero::before{content:'';position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at top right,rgba(49,130,206,0.15),transparent 50%);pointer-events:none;}
      .hero small{opacity:0.8;text-transform:uppercase;letter-spacing:0.15em;font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px;}
      .hero h1{margin:16px 0 0;font-size:clamp(2.5em,5vw,3.5em);font-weight:800;line-height:1.1;letter-spacing:-0.03em;}
      .meta{display:flex;gap:16px;flex-wrap:wrap;margin-top:32px;font-size:14px;}
      .meta span{background:rgba(255,255,255,0.1);padding:8px 16px;border-radius:99px;backdrop-filter:blur(10px);display:flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,0.05);}
      .meta strong{font-weight:600;color:#f8fafc;}
      .grid{display:grid;grid-template-columns:1fr;gap:32px;}
      @media (min-width:1024px){.grid{grid-template-columns:1.6fr 1fr;gap:40px;}}
      .card{background:white;border-radius:24px;padding:32px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05),0 10px 15px -3px rgba(0,0,0,0.02);border:1px solid #e2e8f0;transition:transform 0.3s ease,box-shadow 0.3s ease;}
      .card:hover{box-shadow:0 10px 25px -5px rgba(0,0,0,0.05),0 8px 10px -6px rgba(0,0,0,0.01);}
      .card h2{margin-top:0;font-size:1.4em;font-weight:700;color:#0f172a;display:flex;align-items:center;gap:12px;margin-bottom:28px;letter-spacing:-0.01em;}
      .card h2 svg{color:#3182ce;padding:8px;background:#eff6ff;border-radius:12px;}
      table{width:100%;border-collapse:separate;border-spacing:0;}
      th{text-align:left;padding:16px;font-weight:700;color:#64748b;text-transform:uppercase;font-size:12px;letter-spacing:0.05em;border-bottom:2px solid #f1f5f9;}
      td{padding:16px;border-bottom:1px solid #f8fafc;font-size:14px;color:#334155;}
      tr:last-child td{border-bottom:none;}
      tr:hover td{background-color:#f8fafc;}
      .actions-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px;}
      .actions-grid button{background:white;border:1px solid #e2e8f0;padding:16px;border-radius:16px;cursor:pointer;font-weight:600;color:#475569;transition:all 0.2s cubic-bezier(0.4,0,0.2,1);display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,0.02);}
      .actions-grid button:hover,.actions-grid button:focus-visible{background:#f8fafc;border-color:#3182ce;color:#1e3a8a;transform:translateY(-2px);box-shadow:0 10px 15px -3px rgba(49,130,206,0.1);outline:none;}
      .actions-grid button svg{width:24px;height:24px;color:#64748b;transition:color 0.2s;}
      .actions-grid button:hover svg{color:#3182ce;}
      #console{background:#0f172a;color:#e2e8f0;padding:20px;border-radius:16px;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;margin-top:32px;max-height:400px;overflow-y:auto;display:none;border:1px solid #1e293b;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
      #console::-webkit-scrollbar{width:8px;}
      #console::-webkit-scrollbar-track{background:#1e293b;border-radius:4px;}
      #console::-webkit-scrollbar-thumb{background:#475569;border-radius:4px;}
      .modal{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity 300ms cubic-bezier(0.4,0,0.2,1);padding:20px;box-sizing:border-box;}
      .modal.active{display:flex;opacity:1;}
      .modal-content{background:#ffffff;padding:0;border-radius:24px;max-width:680px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25),0 0 0 1px rgba(0,0,0,0.05);position:relative;overflow:hidden;max-height:calc(100vh - 40px);transform:scale(0.95) translateY(10px);transition:all 300ms cubic-bezier(0.34,1.56,0.64,1);display:flex;flex-direction:column;}
      .modal.active .modal-content{transform:scale(1) translateY(0);}
      .modal-header{display:flex;justify-content:space-between;align-items:flex-start;padding:32px 32px 20px;border-bottom:1px solid #f1f5f9;background:#ffffff;flex-shrink:0;}
      .modal-body{padding:24px 32px;overflow-y:auto;flex:1;scroll-behavior:smooth;}
      .modal-footer{padding:24px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;flex-shrink:0;}
      .modal-body::-webkit-scrollbar{width:6px;}
      .modal-body::-webkit-scrollbar-track{background:transparent;}
      .modal-body::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:10px;}
      .modal-body::-webkit-scrollbar-thumb:hover{background:#94a3b8;}
      .modal-header h2{margin:0;font-size:1.8em;font-weight:800;color:#0f172a;letter-spacing:-0.02em;}
      .modal-header p{color:#64748b;font-size:14px;margin:6px 0 0;}
      .btn-close{background:#f1f5f9;border:none;width:36px;height:36px;border-radius:50%;font-size:20px;cursor:pointer;color:#64748b;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;}
      .btn-close:hover,.btn-close:focus-visible{background:#e2e8f0;color:#0f172a;transform:rotate(90deg);outline:none;}
      .form-label{font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:8px;}
      input[type="text"],select,textarea{width:100%;padding:14px 16px;margin-bottom:24px;border:2px solid #e2e8f0;border-radius:12px;font-size:15px;font-family:inherit;transition:all 0.2s;background:#f8fafc;color:#1e293b;box-sizing:border-box;}
      input[type="text"]:focus,select:focus,textarea:focus{outline:none;border-color:#3182ce;background:#ffffff;box-shadow:0 0 0 4px rgba(49,130,206,0.1);}
      input::placeholder{color:#94a3b8;}
      .mode-tabs{display:flex;gap:8px;background:#f1f5f9;padding:6px;border-radius:16px;margin-bottom:32px;overflow-x:auto;}
      .mode-tab{flex:1;min-width:100px;padding:12px 16px;border:none;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:all 0.2s;background:transparent;color:#64748b;white-space:nowrap;}
      .mode-tab:hover{color:#1e293b;}
      .mode-tab.active{background:white;color:#3182ce;box-shadow:0 2px 8px rgba(0,0,0,0.05);}
      .features-selector{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;background:#f8fafc;padding:24px;border-radius:16px;margin-bottom:24px;border:1px solid #e2e8f0;}
      .addon-check{display:flex;align-items:center;gap:12px;padding:12px 16px;background:white;border:1px solid #e2e8f0;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;color:#334155;transition:all 0.2s;box-shadow:0 1px 2px rgba(0,0,0,0.02);}
      .addon-check:hover{border-color:#cbd5e1;background:#f8fafc;transform:translateY(-1px);}
      .addon-check:has(input:checked){border-color:#3182ce;background:#eff6ff;color:#1e3a8a;}
      .addon-check input[type="checkbox"]{width:18px;height:18px;margin:0;accent-color:#3182ce;cursor:pointer;}
      .btn-primary{background:linear-gradient(135deg,#3182ce 0%,#2b6cb0 100%);color:white;border:none;padding:16px 32px;border-radius:16px;font-weight:700;cursor:pointer;transition:all 0.3s;width:100%;font-size:16px;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 6px rgba(49,130,206,0.2);}
      .btn-primary:hover,.btn-primary:focus-visible{transform:translateY(-2px);box-shadow:0 8px 15px rgba(49,130,206,0.3);outline:none;}
      .btn-ghost{background:#f1f5f9;color:#475569;border:none;padding:16px 32px;border-radius:16px;font-weight:700;cursor:pointer;transition:all 0.2s;width:100%;font-size:16px;}
      .btn-ghost:hover,.btn-ghost:focus-visible{background:#e2e8f0;color:#0f172a;outline:none;}
      .table-card{background:white;padding:24px;border-radius:16px;border:1px solid #e2e8f0;margin-bottom:20px;position:relative;box-shadow:0 2px 4px rgba(0,0,0,0.02);transition:all 0.2s;}
      .table-card:hover{border-color:#cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,0.05);}
      .btn-remove{background:#fee2e2;color:#ef4444;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;transition:all 0.2s;}
      .btn-remove:hover{background:#fca5a5;color:#7f1d1d;}
      .btn-add{background:#eff6ff;color:#3182ce;border:none;padding:10px 16px;border-radius:10px;font-weight:600;cursor:pointer;font-size:14px;transition:all 0.2s;display:inline-flex;align-items:center;gap:6px;}
      .btn-add:hover{background:#dbeafe;color:#1e3a8a;}
      @media (max-width:768px){.shell{padding:16px;}.hero{padding:32px 24px;border-radius:20px;}.card{padding:24px;border-radius:20px;}.actions-grid{grid-template-columns:repeat(2,1fr);}.modal-content{padding:24px;border-radius:20px;}.modal-header h2{font-size:1.5em;}}
      @media (max-width:480px){.actions-grid{grid-template-columns:1fr;}.features-selector{grid-template-columns:1fr;}.mode-tabs{flex-direction:column;background:transparent;padding:0;gap:12px;}.mode-tab{background:#f1f5f9;}.btn-action-group{flex-direction:column-reverse;gap:12px;}}
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <small>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          DRY API Framework — Dashboard
        </small>
        <h1>${overview.headline}</h1>
        <div class="meta">
          <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> Environnement: <strong>${overview.environment}</strong></span>
          <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Version: <strong>${overview.version}</strong></span>
          <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Uptime: <strong>${overview.uptime.human}</strong></span>
          <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg> Port: <strong>${overview.port}</strong></span>
        </div>
      </section>

      <section class="grid">
        <div style="display:flex;flex-direction:column;gap:32px;">
          <article class="card">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              État des Services
            </h2>
            <div style="overflow-x:auto;">
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Statut</th>
                    <th>Détails</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </article>

          <article class="card">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              Actions Système
            </h2>
            <div class="actions-grid">
              ${actionButtons}
              <button onclick="window.openCreateAppModal()" style="background:linear-gradient(135deg, #3182ce, #2c5282);color:white;border:none;">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                <span>Nouvelle App</span>
              </button>
            </div>
            <div id="console"></div>
          </article>
        </div>

        <div style="display:flex;flex-direction:column;gap:32px;">
          <article class="card">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              Liens Utiles
            </h2>
            <div style="display:flex;flex-direction:column;gap:12px;">
              <a href="${overview.urls.health}" target="_blank" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;text-decoration:none;color:#1e293b;font-weight:600;transition:all 0.2s;">
                <span style="display:flex;align-items:center;gap:10px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Health Status</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              <a href="${overview.urls.swagger}" target="_blank" style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;text-decoration:none;color:#1e293b;font-weight:600;transition:all 0.2s;">
                <span style="display:flex;align-items:center;gap:10px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> API Documentation</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>

            <h3 style="margin:32px 0 16px;font-size:1.1em;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Applications Actives</h3>
            <ul style="padding:0;margin:0;list-style:none;display:flex;flex-direction:column;gap:10px;">${apps}</ul>
          </article>

          <article class="card">
            <h2>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Origines CORS
            </h2>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${overview.corsOrigins.map(o => `<code style="background:#f1f5f9;padding:6px 12px;border-radius:8px;font-size:12px;color:#475569;border:1px solid #e2e8f0;">${o}</code>`).join('') || '<span style="color:#94a3b8;font-size:13px;font-style:italic;">Aucune origine configurée</span>'}
            </div>
          </article>
        </div>
      </section>
    </div>

    <div id="createAppModal" class="modal" role="dialog" aria-labelledby="modalTitle" aria-modal="true">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h2 id="modalTitle">Générer une Application</h2>
            <p>Créer une nouvelle architecture multi-tenant en quelques clics</p>
          </div>
          <button class="btn-close" onclick="window.closeCreateAppModal()" aria-label="Fermer le modal">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="mode-tabs" role="tablist">
            <button class="mode-tab active" onclick="window.switchMode('quick')" id="tab-quick" role="tab" aria-selected="true" aria-controls="section-quick">
              <span style="font-size:16px;">⚡</span> Rapide
            </button>
            <button class="mode-tab" onclick="window.switchMode('template')" id="tab-template" role="tab" aria-selected="false" aria-controls="section-template">
              <span style="font-size:16px;">📦</span> Template
            </button>
            <button class="mode-tab" onclick="window.switchMode('expert')" id="tab-expert" role="tab" aria-selected="false" aria-controls="section-expert">
              <span style="font-size:16px;">🔧</span> Expert
            </button>
            <button class="mode-tab" onclick="window.switchMode('custom_advanced')" id="tab-custom_advanced" role="tab" aria-selected="false" aria-controls="section-custom_advanced">
              <span style="font-size:16px;">✨</span> Personnalisé
            </button>
          </div>
          <label class="form-label" for="appName">Nom de l'application *</label>
          <input type="text" id="appName" placeholder="Ex: MaSuperApp" required autofocus>

          <div id="section-quick" role="tabpanel">
            <label class="form-label">Choisir les fonctionnalités</label>
            <div class="features-selector">
              <label class="addon-check"><input type="checkbox" name="feature" value="menus"> Menus</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="commandes"> Commandes</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="tables"> Tables</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="clients"> Clients</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="reservations"> Réservations</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="products"> Produits</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="categories"> Catégories</label>
              <label class="addon-check"><input type="checkbox" name="feature" value="stocks"> Stocks</label>
            </div>
          </div>

          <div id="section-template" style="display:none;" role="tabpanel">
            <label class="form-label" for="appTemplate">Template professionnel</label>
            <select id="appTemplate">
              ${Object.entries(PROFESSIONAL_TEMPLATES).map(([key, tpl]) => `<option value="${key}">${tpl.name} — ${tpl.desc}</option>`).join('')}
            </select>
          </div>

          <div id="section-expert" style="display:none;" role="tabpanel">
            <label class="form-label">Architecture Personnalisée</label>
            <div id="tablesContainer"></div>
            <button type="button" onclick="window.addTable()" class="btn-add" style="width:100%;margin-bottom:24px;padding:14px;justify-content:center;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Ajouter une Table
            </button>
          </div>

          <div id="section-custom_advanced" style="display:none;" role="tabpanel">
            <div style="background:#f0f9ff;border-radius:16px;padding:20px;margin-bottom:24px;border:1px solid #bae6fd;display:flex;gap:16px;align-items:center;">
              <div style="background:#3182ce;color:white;padding:10px;border-radius:12px;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>
              <div>
                <p style="margin:0;font-size:14px;color:#0369a1;font-weight:700;">Mode Personnalisé Avancé</p>
                <p style="margin:2px 0 0;font-size:13px;color:#075985;">Définissez tables, types, contraintes et relations.</p>
              </div>
            </div>

            <div id="advancedTablesContainer"></div>
            <button type="button" onclick="window.addAdvancedTable()" class="btn-add" style="width:100%;padding:14px;justify-content:center;margin-bottom:24px;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              Ajouter une Table
            </button>

            <div style="margin-top:8px;background:#f8fafc;border-radius:20px;padding:24px;border:1px solid #e2e8f0;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                <h4 style="margin:0;font-size:13px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.05em;display:flex;align-items:center;gap:8px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                  Relations entre Tables
                </h4>
                <button type="button" onclick="window.addRelation()" class="btn-add" style="margin:0;">+ Lier</button>
              </div>
              <div id="relationsContainer">
                <p style="margin:0;font-size:13px;color:#94a3b8;font-style:italic;text-align:center;padding:20px;">Aucune relation définie.</p>
              </div>
            </div>
          </div>

          <div style="margin:32px 0;">
            <label class="form-label">Modules Premium</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <label class="addon-check"><input type="checkbox" id="addonPayment" checked> 💳 Paiement</label>
              <label class="addon-check"><input type="checkbox" id="addonExport" checked> 📤 Export</label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <div class="btn-action-group" style="display:flex;gap:16px;">
            <button type="button" onclick="window.closeCreateAppModal()" class="btn-ghost">Annuler</button>
            <button type="button" onclick="window.submitCreateApp()" class="btn-primary">
              🚀 Lancer la génération
            </button>
          </div>
        </div>
      </div>
    </div>

    <script>
      (function() {
        // Optimisation: Toutes les fonctions dans une IIFE pour éviter de polluer le scope global inutilement
        // mais attachées à window pour être accessibles depuis les onclick.
        
        window.consoleEl = null;
        window.currentMode = 'quick';
        window.tableColors = ['#3182ce','#38a169','#d69e2e','#e53e3e','#805ad5','#dd6b20','#319795','#e91e8c'];
        window.advancedTableCount = 0;

        window.runAction = function(actionId, label) {
          if (!confirm('Confirmer l\\'action : ' + label + ' ?')) return;
          window.log('Exécution de : ' + label + '...', 'info');
          fetch('/system/actions/' + actionId, { method: 'POST' })
            .then(r => r.json())
            .then(res => {
              if (res.success) {
                window.log('SUCCESS: ' + res.message, 'success');
                window.appendOutputBlock(res.output, 'success');
              } else {
                window.log('ERROR: ' + res.message, 'error');
                window.appendOutputBlock(res.output, 'error');
              }
            })
            .catch(err => window.log('ERROR: ' + err.message, 'error'));
        };

        window.openCreateAppModal = function() {
          const modal = document.getElementById('createAppModal');
          if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            document.getElementById('appName')?.focus();
            window.switchMode('quick');
          }
        };

        window.closeCreateAppModal = function() {
          const modal = document.getElementById('createAppModal');
          if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
          }
        };

        window.switchMode = function(mode) {
          window.currentMode = mode;
          ['quick','template','expert','custom_advanced'].forEach(m => {
            const section = document.getElementById('section-' + m);
            const tab = document.getElementById('tab-' + m);
            const isActive = m === mode;
            if (section) section.style.display = isActive ? 'block' : 'none';
            if (tab) {
              tab.classList.toggle('active', isActive);
              tab.setAttribute('aria-selected', isActive);
            }
          });
          if (mode === 'expert') {
            const container = document.getElementById('tablesContainer');
            if (container && container.children.length === 0) window.addTable();
          }
          if (mode === 'custom_advanced') {
            const container = document.getElementById('advancedTablesContainer');
            if (container && container.children.length === 0) window.addAdvancedTable();
          }
        };

        window.log = function(message, type = 'info') {
          if (!window.consoleEl) window.consoleEl = document.getElementById('console');
          if (window.consoleEl) {
            window.consoleEl.style.display = 'block';
            const line = document.createElement('div');
            line.style.cssText = 'padding:4px 0;border-bottom:1px solid #1e293b;';
            line.style.color = type === 'error' ? '#f87171' : (type === 'success' ? '#4ade80' : '#cbd5e1');
            line.innerHTML = '<span style="color:#475569;margin-right:10px;">[' + new Date().toLocaleTimeString() + ']</span> ' + message;
            window.consoleEl.appendChild(line);
            window.consoleEl.scrollTop = window.consoleEl.scrollHeight;
          }
        };

        window.appendOutputBlock = function(text, type) {
          if (!text) return;
          if (!window.consoleEl) window.consoleEl = document.getElementById('console');
          if (window.consoleEl) {
            const pre = document.createElement('pre');
            pre.style.cssText = 'margin:10px 0;padding:15px;border-radius:12px;font-size:12px;white-space:pre-wrap;';
            pre.style.background = type === 'error' ? '#450a0a' : '#1e293b';
            pre.style.color = type === 'error' ? '#f87171' : '#4ade80';
            pre.textContent = text;
            window.consoleEl.appendChild(pre);
            window.consoleEl.scrollTop = window.consoleEl.scrollHeight;
          }
        };

        window.addTable = function() {
          const container = document.getElementById('tablesContainer');
          if (!container) return;
          const tableId = 'table_' + Date.now();
          const html = '<div class="table-card" id="' + tableId + '">' +
            '<button type="button" onclick="window.removeElement(\\'' + tableId + '\\')" class="btn-remove" style="position:absolute;top:10px;right:10px;">&times;</button>' +
            '<input type="text" placeholder="Nom de la table (ex: Produits)" class="table-name" style="margin-bottom:15px;font-weight:700;">' +
            '<div class="fields-container"></div>' +
            '<button type="button" onclick="window.addField(\\'' + tableId + '\\')" class="btn-add">+ Ajouter un champ</button>' +
            '</div>';
          container.insertAdjacentHTML('beforeend', html);
          window.addField(tableId);
        };

        window.addField = function(tableId) {
          const table = document.getElementById(tableId);
          if (!table) return;
          const container = table.querySelector('.fields-container');
          if (!container) return;
          const fieldId = 'field_' + Date.now();
          const html = '<div class="field-row" id="' + fieldId + '">' +
            '<input type="text" placeholder="Nom du champ" class="field-name">' +
            '<select class="field-type">' +
              '<option value="String">String</option><option value="Number">Number</option>' +
              '<option value="Boolean">Boolean</option><option value="Date">Date</option>' +
              '<option value="Array">Array</option><option value="ObjectId">ObjectId</option>' +
            '</select>' +
            '<button type="button" onclick="window.removeElement(\\'' + fieldId + '\\')" class="btn-remove">&times;</button>' +
            '</div>';
          container.insertAdjacentHTML('beforeend', html);
        };

        window.addAdvancedTable = function() {
          window.advancedTableCount++;
          const color = window.tableColors[(window.advancedTableCount - 1) % window.tableColors.length];
          const tableId = 'adv_table_' + Date.now();
          const html = '<div class="table-card" id="' + tableId + '" style="border-left:4px solid ' + color + ';margin-bottom:16px;">' +
            '<button type="button" onclick="window.removeElement(\\'' + tableId + '\\')" class="btn-remove" style="position:absolute;top:12px;right:12px;">&times;</button>' +
            '<div class="table-header" style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">' +
              '<div style="width:12px;height:12px;border-radius:50%;background:' + color + ';"></div>' +
              '<input type="text" placeholder="Nom du modele (ex: Invoice)" class="adv-table-name" onchange="window.refreshRelationSelects()" style="margin:0;font-weight:700;border:none;background:transparent;font-size:18px;">' +
            '</div>' +
            '<div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 36px;gap:8px;margin-bottom:6px;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;">' +
              '<span>Champ</span><span>Type</span><span style="text-align:center;">Requis</span><span style="text-align:center;">Unique</span><span></span>' +
            '</div>' +
            '<div class="adv-fields-container"></div>' +
            '<button type="button" onclick="window.addAdvancedField(\\'' + tableId + '\\')" class="btn-add" style="margin-top:4px;">+ Ajouter un champ</button>' +
            '</div>';
          const container = document.getElementById('advancedTablesContainer');
          if (container) {
            container.insertAdjacentHTML('beforeend', html);
            window.addAdvancedField(tableId);
            window.refreshRelationSelects();
          }
        };

        window.addAdvancedField = function(tableId) {
          const table = document.getElementById(tableId);
          if (!table) return;
          const container = table.querySelector('.adv-fields-container');
          if (!container) return;
          const fieldId = 'adv_field_' + Date.now();
          const html = '<div style="display:grid;grid-template-columns:2fr 1.5fr 1fr 1fr 36px;gap:8px;margin-bottom:8px;align-items:center;" id="' + fieldId + '">' +
            '<input type="text" placeholder="nomChamp" class="adv-field-name" style="margin:0;padding:9px 12px;font-size:13px;">' +
            '<select class="adv-field-type" style="margin:0;padding:9px 12px;font-size:13px;">' +
              '<option value="String">String</option><option value="Number">Number</option>' +
              '<option value="Boolean">Boolean</option><option value="Date">Date</option>' +
              '<option value="Array">Array</option><option value="ObjectId">ObjectId</option>' +
              '<option value="Mixed">Mixed</option><option value="Map">Map</option>' +
            '</select>' +
            '<div style="text-align:center;"><input type="checkbox" class="adv-field-required" style="width:18px;height:18px;margin:0;cursor:pointer;"></div>' +
            '<div style="text-align:center;"><input type="checkbox" class="adv-field-unique" style="width:18px;height:18px;margin:0;cursor:pointer;"></div>' +
            '<button type="button" onclick="window.removeElement(\\'' + fieldId + '\\')" class="btn-remove" style="width:28px;height:28px;">&times;</button>' +
            '</div>';
          container.insertAdjacentHTML('beforeend', html);
        };

        window.addRelation = function() {
          const container = document.getElementById('relationsContainer');
          if (!container) return;
          const placeholder = container.querySelector('p');
          if (placeholder) placeholder.remove();
          const relId = 'rel_' + Date.now();
          const names = Array.from(document.querySelectorAll('.adv-table-name')).map(i => i.value.trim()).filter(Boolean);
          const tableOptions = names.length
            ? names.map(n => '<option value="' + n + '">' + n + '</option>').join('')
            : '<option value="">— aucune table —</option>';

          const html = '<div style="display:grid;grid-template-columns:1fr auto 1fr 1.2fr 36px;gap:10px;align-items:center;margin-bottom:10px;background:white;padding:12px;border-radius:12px;border:1px solid #e2e8f0;" id="' + relId + '">' +
            '<select class="rel-from" style="margin:0;padding:9px 12px;font-size:13px;">' + tableOptions + '</select>' +
            '<span style="font-size:12px;font-weight:700;color:#94a3b8;">&rarr;</span>' +
            '<select class="rel-to" style="margin:0;padding:9px 12px;font-size:13px;">' + tableOptions + '</select>' +
            '<select class="rel-type" style="margin:0;padding:9px 12px;font-size:13px;">' +
              '<option value="oneToMany">1 &rarr; N</option><option value="manyToOne">N &rarr; 1</option>' +
              '<option value="manyToMany">N &rarr; N</option><option value="oneToOne">1 &rarr; 1</option>' +
            '</select>' +
            '<button type="button" onclick="window.removeElement(\\'' + relId + '\\')" class="btn-remove">&times;</button>' +
            '</div>';
          container.insertAdjacentHTML('beforeend', html);
        };

        window.refreshRelationSelects = function() {
          const names = Array.from(document.querySelectorAll('.adv-table-name')).map(i => i.value.trim()).filter(Boolean);
          const options = names.map(n => '<option value="' + n + '">' + n + '</option>').join('') || '<option value="">— aucune table —</option>';
          document.querySelectorAll('.rel-from, .rel-to').forEach(sel => {
            const val = sel.value;
            sel.innerHTML = options;
            if (val) sel.value = val;
          });
        };

        window.removeElement = function(id) {
          const el = document.getElementById(id);
          if (el) el.remove();
          window.refreshRelationSelects();
        };

        window.submitCreateApp = function() {
          const appName = document.getElementById('appName').value.trim();
          if (!appName) return alert('Veuillez saisir un nom.');
          
          const addons = {
            payment: document.getElementById('addonPayment').checked,
            exportData: document.getElementById('addonExport').checked
          };
          let templateKey = 'custom';
          const toPascal = s => s.charAt(0).toUpperCase() + s.slice(1);
          const toSafe = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

          if (window.currentMode === 'quick') {
            const selected = Array.from(document.querySelectorAll('input[name="feature"]:checked')).map(cb => cb.value);
            if (!selected.length) return alert('Choisissez une feature.');
            addons.features = selected;
            templateKey = 'custom';
          } else if (window.currentMode === 'template') {
            templateKey = document.getElementById('appTemplate').value;
          } else if (window.currentMode === 'expert') {
            templateKey = 'expert';
            const features = [];
            document.querySelectorAll('#tablesContainer .table-card').forEach(card => {
              const name = card.querySelector('.table-name').value.trim();
              if (!name) return;
              const fields = Array.from(card.querySelectorAll('.field-row')).map(row => {
                const fn = row.querySelector('.field-name').value.trim();
                const ft = row.querySelector('.field-type').value;
                return fn ? fn + ':' + ft : null;
              }).filter(Boolean);
              if (fields.length) features.push({ name: toSafe(name), model: toPascal(toSafe(name)), fields: fields });
            });
            if (!features.length) return alert('Définissez une table.');
            addons.features = features;
          } else if (window.currentMode === 'custom_advanced') {
            templateKey = 'expert';
            const advFeatures = [];
            document.querySelectorAll('#advancedTablesContainer .table-card').forEach(card => {
              const name = card.querySelector('.adv-table-name').value.trim();
              if (!name) return;
              const fields = Array.from(card.querySelectorAll('[id^="adv_field_"]')).map(row => {
                const fn = row.querySelector('.adv-field-name').value.trim();
                const ft = row.querySelector('.adv-field-type').value;
                const req = row.querySelector('.adv-field-required').checked ? ':required' : '';
                const uniq = row.querySelector('.adv-field-unique').checked ? ':unique' : '';
                return fn ? fn + ':' + ft + req + uniq : null;
              }).filter(Boolean);
              if (fields.length) advFeatures.push({ name: toSafe(name), model: toPascal(toSafe(name)), fields: fields });
            });
            const relations = [];
            document.querySelectorAll('#relationsContainer [id^="rel_"]').forEach(row => {
              const from = row.querySelector('.rel-from').value;
              const to = row.querySelector('.rel-to').value;
              const type = row.querySelector('.rel-type').value;
              if (from && to && from !== to) relations.push({ from, to, type });
            });
            if (!advFeatures.length) return alert('Définissez une table.');
            addons.features = advFeatures;
            if (relations.length) addons.relations = relations;
          }

          window.closeCreateAppModal();
          window.log('START: Génération pour ' + appName + '...', 'info');
          fetch('/system/actions/create-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName, template: templateKey, addons })
          })
          .then(r => r.json())
          .then(res => {
            if (res.success) {
              window.log('SUCCESS: ' + res.message, 'success');
              window.appendOutputBlock(res.output, 'success');
              window.log('RESTART: Redémarrage système...', 'info');
              setTimeout(() => {
                fetch('/system/actions/restart', { method: 'POST' })
                  .then(() => setTimeout(() => window.location.reload(), 4000))
                  .catch(() => setTimeout(() => window.location.reload(), 5000));
              }, 3000);
            } else {
              window.log('ERROR: ' + res.message, 'error');
              window.appendOutputBlock(res.output, 'error');
            }
          })
          .catch(err => window.log('ERROR: ' + err.message, 'error'));
        };

        // Initialisation au chargement
        window.addEventListener('DOMContentLoaded', () => {
          window.consoleEl = document.getElementById('console');
        });

        document.addEventListener('keydown', e => {
          if (e.key === 'Escape') window.closeCreateAppModal();
        });

        document.addEventListener('click', e => {
          const modal = document.getElementById('createAppModal');
          const modalContent = modal?.querySelector('.modal-content');
          if (e.target === modal && !modalContent.contains(e.target)) {
            window.closeCreateAppModal();
          }
        });
      })();
    </script>
  </body>
</html>`;
  }

  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) return `${days}j ${hours}h ${minutes}m ${secs}s`;
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  async getLiveness() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness() {
    const dbReady = mongoose.connection.readyState === 1;
    const redisEnabledFlag = String(process.env.REDIS_ENABLED || '').toLowerCase();
    const redisEnabled =
      redisEnabledFlag === 'true' || (!!process.env.REDIS_URL && redisEnabledFlag !== 'false');
    const redisReady = redisService.getStatus().connected;

    return {
      status: dbReady && (!redisEnabled || redisReady) ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbReady,
        redis: redisEnabled ? redisReady : 'DISABLED',
      },
    };
  }
}

module.exports = new HealthService();