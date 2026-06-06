#!/usr/bin/env node
/**
 * ✦ GÉNÉRATEUR DE FRONTEND DRY v2.0 ✦
 * =====================================
 * Crée un projet frontend CRUD complet (React, Angular ou React Native)
 * connecté à une application DRY existante.
 *
 * Utilisation interactive :
 *   node scripts/generator/create-frontend.js
 *
 * Utilisation non-interactive (flags) :
 *   node scripts/generator/create-frontend.js --app scim --feature property --stack react
 *
 * Structure générée (React) :
 *   frontend/{stack}/{appName}/
 *     ├── src/
 *     │   ├── api/          → Client HTTP, authentification, CRUD
 *     │   ├── pages/        → Login, Liste, Création, Édition
 *     │   ├── components/   → Composants réutilisables
 *     │   └── styles/       → Design system DRY
 *     ├── package.json
 *     ├── vite.config.js
 *     ├── index.html
 *     ├── .gitignore
 *     └── README.md
 *
 * @author  DRY API Team
 * @version 2.0.0
 * @module  scripts/generator/create-frontend
 */

'use strict';

// ─── Dépendances ──────────────────────────────────────────────
const fs   = require('fs');
const path = require('path');
const readline = require('readline');

// ─── CLI interactif ────────────────────────────────────────────
const rl  = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

// ─── Apps disponibles ──────────────────────────────────────────

/**
 * Liste les applications disponibles dans dryApp/
 * @returns {string[]} Noms des applications
 */
const getAvailableApps = () => {
  const dryAppPath = path.join(__dirname, '../../dryApp');
  if (!fs.existsSync(dryAppPath)) return [];
  return fs.readdirSync(dryAppPath).filter((name) => {
    return name && !name.startsWith('.') && fs.statSync(path.join(dryAppPath, name)).isDirectory();
  });
};

/**
 * Récupère les features (CRUD) d'une application
 * @param   {string} appName - Nom de l'application
 * @returns {Array<{name: string, route: string, label: string}>}
 */
const getAppFeatures = (appName) => {
  const featuresPath = path.join(__dirname, '../../dryApp', appName, 'features');
  if (!fs.existsSync(featuresPath)) return [];
  return fs.readdirSync(featuresPath)
    .filter((name) => !name.startsWith('.'))
    .map((name) => ({
      name,
      route: name.toLowerCase(),
      label: name.charAt(0).toUpperCase() + name.slice(1),
    }));
};

// ─── Templates disponibles ─────────────────────────────────────

const TEMPLATES = {
  react:        { name: 'React (Vite)' },
  angular:      { name: 'Angular' },
  'react-native': { name: 'React Native (Expo)' },
};

// ─── Helper d'écriture de template ────────────────────────────

/**
 * Écrit un fichier en remplaçant les variables {{var}} par leur valeur
 * @param {string} filePath  - Chemin du fichier de sortie
 * @param {string} content   - Contenu avec placeholders {{var}}
 * @param {object} variables - Dictionnaire clé → valeur
 */
const writeTemplate = (filePath, content, variables) => {
  let output = content;
  for (const [key, value] of Object.entries(variables)) {
    output = output.split('{{' + key + '}}').join(String(value ?? ''));
  }
  fs.writeFileSync(filePath, output, 'utf-8');
};

// ─── Copie des composants DRY UI ──────────────────────────────

/**
 * Copie la bibliothèque de composants DRY UI dans le projet généré
 * @param {string} outputDir - Dossier de sortie du projet
 */
const copyDryUI = (outputDir) => {
  const sourceDir = path.join(__dirname, '../../dry/ui');
  const targetDir = path.join(outputDir, 'src/components/dry-ui');
  if (!fs.existsSync(sourceDir)) {
    console.log('  ⚠ Dossier dry/ui/ introuvable, copie ignorée');
    return;
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const files = fs.readdirSync(sourceDir);
  files.forEach((file) => {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, dest);
    }
  });
  console.log('  ✓ Composants DRY UI copiés (' + files.length + ' fichiers)');
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  GÉNÉRATION REACT (Vite)                                    ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Génère un projet React (Vite) avec CRUD complet
 * @param {string} outputDir - Dossier de sortie
 * @param {string} appName   - Nom de l'application DRY cible
 * @param {object} feature   - Feature cible : { name, route, label }
 * @param {string} userRole  - Rôle (admin|client)
 */
const generateReact = (outputDir, appName, feature, userRole) => {
  const dir = (sub) => path.join(outputDir, sub);
  const vars = { appName, featureRoute: feature.route, featureLabel: feature.label , userRole };

  // Création de l'arborescence
  ['src/api', 'src/pages', 'src/components', 'src/styles'].forEach((d) => {
    fs.mkdirSync(dir(d), { recursive: true });
  });

  /* ── package.json ────────────────────────────────────────── */
  writeTemplate(dir('package.json'), JSON.stringify({
    name: 'dry-' + appName + '-frontend',
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'react-router-dom': '^6.20.0',
      axios: '^1.6.0',
    },
    devDependencies: {
      vite: '^5.0.0',
      '@vitejs/plugin-react': '^4.2.0',
    },
  }, null, 2), vars);

  /* ── vite.config.js ──────────────────────────────────────── */
  writeTemplate(dir('vite.config.js'), [
    '/**',
    ' * Configuration Vite pour DRY Frontend',
    ' * Proxy les appels /api/* vers le serveur DRY',
    ' */',
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    '',
    'export default defineConfig({',
    '  plugins: [react()],',
    '  server: {',
    '    port: 3000,',
    "    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }",
    '  },',
    '});',
  ].join('\n'), vars);

  /* ── index.html ──────────────────────────────────────────── */
  writeTemplate(dir('index.html'), [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<head>',
    '  <meta charset="UTF-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    '  <title>DRY — {{appName}}</title>',
    '</head>',
    '<body>',
    '  <div id="root"></div>',
    '  <script type="module" src="/src/main.jsx"></script>',
    '</body>',
    '</html>',
  ].join('\n'), vars);

  /* ── src/main.jsx (avec DRY UI) ──────────────────────────── */
  writeTemplate(dir('src/main.jsx'), [
    '/**',
    ' * Point d\'entrée React — DRY Frontend',
    ' * Monte l\'application avec BrowserRouter',
    ' * Importe les composants DRY UI et le design system',
    ' */',
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import { BrowserRouter } from 'react-router-dom';",
    "import App from './App';",
    "import './styles/dry.css';",
    "import './components/dry-ui/dry-ui.css';",
    '',
    'ReactDOM.createRoot(document.getElementById(\'root\')).render(',
    '  <React.StrictMode>',
    '    <BrowserRouter>',
    '      <App />',
    '    </BrowserRouter>',
    '  </React.StrictMode>',
    ');',
  ].join('\n'), vars);

  /* ── src/api/client.js ───────────────────────────────────── */
  writeTemplate(dir('src/api/client.js'), [
    '/**',
    ' * Client HTTP Axios avec interception JWT',
    ' * - Injecte automatiquement le token d\'authentification',
    ' * - Redirige vers /login en cas de 401',
    ' */',
    "import axios from 'axios';",
    '',
    '/** URL de base de l\'API DRY */',
    "export const API_BASE = '/api/v1';",
    '/** URL de base pour l\'authentification */',
    "export const AUTH_BASE = '/api/v1/user';",
    '',
    '/** Instance Axios pré-configurée */',
    'const client = axios.create({',
    "  baseURL: '',",
    "  headers: { 'Content-Type': 'application/json' },",
    '});',
    '',
    "// Intercepteur requête : ajoute le token JWT dans l'en-tête Authorization",
    'client.interceptors.request.use((config) => {',
    "  const token = localStorage.getItem('dry_token');",
    '  if (token) {',
    "    config.headers.Authorization = 'Bearer ' + token;",
    '  }',
    '  return config;',
    '});',
    '',
    "// Intercepteur réponse : redirige vers la page de connexion si 401",
    'client.interceptors.response.use(',
    '  (response) => response,',
    '  (error) => {',
    '    if (error.response?.status === 401) {',
    "      localStorage.removeItem('dry_token');",
    "      localStorage.removeItem('dry_user');",
    "      window.location.href = '/login';",
    '    }',
    '    return Promise.reject(error);',
    '  }',
    ');',
    '',
    'export default client;',
  ].join('\n'), vars);

  /* ── src/api/auth.js ─────────────────────────────────────── */
  writeTemplate(dir('src/api/auth.js'), [
    '/**',
    ' * Module d\'authentification',
    ' * Gère la connexion, déconnexion et session utilisateur',
    ' */',
    "import client, { AUTH_BASE } from './client';",
    '',
    '/**',
    ' * Connecte un utilisateur avec email et mot de passe',
    ' * @param   {string} email    - Email de l\'utilisateur',
    ' * @param   {string} password - Mot de passe',
    ' * @returns {Promise<object>}  Données de la réponse',
    ' */',
    'export const login = async (email, password) => {',
    '  const response = await client.post(AUTH_BASE + \'/login\', { email, password });',
    '  const token = response.data?.data?.token;',
    '  if (token) {',
    "    localStorage.setItem('dry_token', token);",
    "    localStorage.setItem('dry_user', JSON.stringify(response.data?.data?.user || {}));",
    '  }',
    '  return response.data;',
    '};',
    '',
    '/**',
    ' * Déconnecte l\'utilisateur et efface la session',
    ' */',
    'export const logout = () => {',
    "  localStorage.removeItem('dry_token');",
    "  localStorage.removeItem('dry_user');",
    "  window.location.href = '/login';",
    '};',
    '',
    '/**',
    ' * Récupère l\'utilisateur stocké dans le localStorage',
    ' * @returns {object|null} Données utilisateur ou null',
    ' */',
    'export const getCurrentUser = () => {',
    '  try {',
    "    const raw = localStorage.getItem('dry_user');",
    "    return raw ? JSON.parse(raw) : null;",
    '  } catch {',
    '    return null;',
    '  }',
    '};',
    '',
    '/**',
    ' * Vérifie si un utilisateur est connecté',
    ' * @returns {boolean} true si un token est présent',
    ' */',
    "export const isAuthenticated = () => !!localStorage.getItem('dry_token');",
  ].join('\n'), vars);

  /* ── src/api/crud.js ─────────────────────────────────────── */
  writeTemplate(dir('src/api/crud.js'), [
    '/**',
    ' * Générateur de fonctions CRUD pour une feature',
    ' * Crée les méthodes list, get, create, update, delete',
    ' *',
    ' * @param   {string} appName - Nom de l\'application (ex: scim)',
    ' * @param   {string} feature - Nom de la feature (ex: property)',
    ' * @returns {object}         Objet avec les méthodes CRUD',
    ' */',
    "import client, { API_BASE } from './client';",
    '',
    'export const createCrudApi = (appName, feature) => {',
    '  const baseUrl = API_BASE + \'/\' + appName + \'/\' + feature;',
    '',
    '  return {',
    '    /**',
    '     * Liste tous les éléments',
    '     * @param   {object} params - Paramètres de filtrage optionnels',
    '     * @returns {Promise<object>}',
    '     */',
    '    list: async (params = {}) => {',
    '      const response = await client.get(baseUrl, { params });',
    '      return response.data;',
    '    },',
    '',
    '    /**',
    '     * Récupère un élément par son ID',
    '     * @param   {string} id - Identifiant de l\'élément',
    '     * @returns {Promise<object>}',
    '     */',
    '    get: async (id) => {',
    '      const response = await client.get(baseUrl + \'/\' + id);',
    '      return response.data;',
    '    },',
    '',
    '    /**',
    '     * Crée un nouvel élément',
    '     * @param   {object} data - Données à créer',
    '     * @returns {Promise<object>}',
    '     */',
    '    create: async (data) => {',
    '      const response = await client.post(baseUrl, data);',
    '      return response.data;',
    '    },',
    '',
    '    /**',
    '     * Met à jour un élément existant',
    '     * @param   {string} id   - Identifiant de l\'élément',
    '     * @param   {object} data - Nouvelles données',
    '     * @returns {Promise<object>}',
    '     */',
    '    update: async (id, data) => {',
    '      const response = await client.put(baseUrl + \'/\' + id, data);',
    '      return response.data;',
    '    },',
    '',
    '    /**',
    '     * Supprime un élément',
    '     * @param   {string} id - Identifiant de l\'élément',
    '     * @returns {Promise<object>}',
    '     */',
    '    delete: async (id) => {',
    '      const response = await client.delete(baseUrl + \'/\' + id);',
    '      return response.data;',
    '    },',
    '  };',
    '};',
  ].join('\n'), vars);

  /* ── src/pages/Login.jsx (DRY UI) ─────────────────────────── */
  writeTemplate(dir('src/pages/Login.jsx'), [
    '/**',
    ' * Page de connexion — DRY UI Components',
    ' * Utilise DryInput, DryButton, DryCard, DryAlert, DrySpinner',
    ' */',
    "import React, { useState } from 'react';",
    "import { useNavigate } from 'react-router-dom';",
    "import { login } from '../api/auth';",
    "import { DryInput, DryButton, DryCard, DryAlert, DrySpinner } from '../components/dry-ui';",
    '',
    'export default function LoginPage() {',
    '  const navigate = useNavigate();',
    '  const [email, setEmail] = useState(\'\');',
    '  const [password, setPassword] = useState(\'\');',
    '  const [errorMessage, setErrorMessage] = useState(\'\');',
    '  const [isLoading, setIsLoading] = useState(false);',
    '',
    '  const handleSubmit = async (event) => {',
    '    event.preventDefault();',
    '    setIsLoading(true);',
    '    setErrorMessage(\'\');',
    '    try {',
    '      await login(email, password);',
    "      navigate('/');",
    '    } catch (error) {',
    "      setErrorMessage(error.response?.data?.message || 'Erreur de connexion');",
    '    } finally {',
    '      setIsLoading(false);',
    '    }',
    '  };',
    '',
    '  return (',
    '    <div className="dry-login-page">',
    '      <DryCard padding={40} style={{ maxWidth: 420, width: \'100%\', textAlign: \'center\' }}>',
    '        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: \'-0.03em\', marginBottom: 4 }}>DRY API</h1>',
    '        <p style={{ color: \'var(--dry-text-secondary)\', marginBottom: 24 }}>',
    '          Connectez-vous à votre application',
    '        </p>',
    '',
    '        {errorMessage && (',
    '          <DryAlert variant="error" message={errorMessage} dismissible />',
    '        )}',
    '',
    '        {isLoading && <DrySpinner variant="overlay" text="Connexion..." />}',
    '',
    '        <form onSubmit={handleSubmit}>',
    '          <DryInput label="Email" type="email" value={email} onChange={setEmail} placeholder="vous@exemple.com" required />',
    '          <DryInput label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />',
    '          <DryButton type="submit" variant="primary" fullWidth loading={isLoading} style={{ marginTop: 8 }}>',
    '            Se connecter',
    '          </DryButton>',
    '        </form>',
    '      </DryCard>',
    '    </div>',
    '  );',
    '}',
  ].join('\n'), vars);

  /* ── src/pages/List.jsx (DRY UI) ──────────────────────────── */
  writeTemplate(dir('src/pages/List.jsx'), [
    '/**',
    ' * Page de liste CRUD — DRY UI Components',
    ' * Utilise DryTable, DryCard, DryButton, DrySpinner, DryBadge, DryAlert',
    ' */',
    "import React, { useState, useEffect } from 'react';",
    "import { Link } from 'react-router-dom';",
    "import { DryTable, DryCard, DryButton, DrySpinner, DryAlert } from '../components/dry-ui';",
    '',
    'export default function ListPage({ api, featureLabel }) {',
    '  const [items, setItems] = useState([]);',
    '  const [isLoading, setIsLoading] = useState(true);',
    '  const [errorMessage, setErrorMessage] = useState(\'\');',
    '',
    '  const loadItems = async () => {',
    '    setIsLoading(true);',
    '    try {',
    '      const response = await api.list();',
    '      setItems(response.data || []);',
    '    } catch (error) {',
    "      setErrorMessage(error.response?.data?.message || 'Erreur de chargement');",
    '    } finally {',
    '      setIsLoading(false);',
    '    }',
    '  };',
    '',
    '  useEffect(() => { loadItems(); }, []);',
    '',
    '  const handleDelete = async (itemId) => {',
    "    if (!confirm('Supprimer cet élément ?')) return;",
    '    try {',
    '      await api.delete(itemId);',
    '      setItems(items.filter((i) => (i._id || i.id) !== itemId));',
    '    } catch (error) {',
    "      setErrorMessage(error.response?.data?.message || 'Erreur lors de la suppression');",
    '    }',
    '  };',
    '',
    '  if (errorMessage) {',
    '    return (',
    '      <div className="container">',
    '        <DryAlert variant="error" message={errorMessage} dismissible onDismiss={() => setErrorMessage(\'\')} />',
    '      </div>',
    '    );',
    '  }',
    '',
    '  return (',
    '    <div className="container">',
    '      <div className="dry-page-header" style={{ marginBottom: 20 }}>',
    '        <h2 style={{ margin: 0, fontSize: 20 }}>{featureLabel}</h2>',
    '        <Link to="/create">',
    '          <DryButton variant="primary" size="sm">+ Nouveau</DryButton>',
    '        </Link>',
    '      </div>',
    '      <DryCard>',
    '        <DryTable',
    '          data={items}',
    '          loading={isLoading}',
    '          exclude={[\'__v\', \'password\', \'hash\']}',
    '          onEdit={(id) => window.location.href = \'/edit/\' + id}',
    '          onDelete={handleDelete}',
    '          emptyText="Aucun élément trouvé"',
    '        />',
    '      </DryCard>',
    '    </div>',
    '  );',
    '}',
  ].join('\n'), vars);

  /* ── src/pages/Create.jsx (DRY UI) ────────────────────────── */
  writeTemplate(dir('src/pages/Create.jsx'), [
    '/**',
    ' * Page de création CRUD — DRY UI Components',
    ' * Utilise DryInput, DryButton, DryCard, DryAlert, DryForm',
    ' */',
    "import React, { useState } from 'react';",
    "import { useNavigate } from 'react-router-dom';",
    "import { DryInput, DryButton, DryCard, DryAlert, DryForm } from '../components/dry-ui';",
    '',
    'export default function CreatePage({ api, featureLabel, fields }) {',
    '  const navigate = useNavigate();',
    '  const [formData, setFormData] = useState({});',
    '  const [isLoading, setIsLoading] = useState(false);',
    '  const [errorMessage, setErrorMessage] = useState(\'\');',
    '',
    '  const handleSubmit = async () => {',
    '    setIsLoading(true);',
    '    setErrorMessage(\'\');',
    '    try {',
    '      await api.create(formData);',
    "      navigate('/');",
    '    } catch (error) {',
    "      setErrorMessage(error.response?.data?.message || 'Erreur lors de la création');",
    '    } finally {',
    '      setIsLoading(false);',
    '    }',
    '  };',
    '',
    '  return (',
    '    <div className="container" style={{ maxWidth: 640 }}>',
    '      <div className="dry-page-header">',
    '        <h2>Nouveau {featureLabel}</h2>',
    '      </div>',
    '      <DryCard>',
    '        {errorMessage && <DryAlert variant="error" message={errorMessage} dismissible onDismiss={() => setErrorMessage(\'\')} />}',
    '        <DryForm onSubmit={handleSubmit} loading={isLoading}>',
    '          {fields.map((fieldName) => (',
    '            <DryInput',
    '              key={fieldName}',
    '              label={fieldName}',
    '              value={formData[fieldName] || \'\'}',
    '              placeholder={fieldName}',
    '              onChange={(val) => setFormData({ ...formData, [fieldName]: val })}',
    '            />',
    '          ))}',
    '          <div className="dry-form-actions">',
    '            <DryButton variant="outline" onClick={() => navigate(\'/\')}>Annuler</DryButton>',
    '            <DryButton variant="primary" type="submit" loading={isLoading}>Créer</DryButton>',
    '          </div>',
    '        </DryForm>',
    '      </DryCard>',
    '    </div>',
    '  );',
    '}',
  ].join('\n'), vars);

  /* ── src/pages/Edit.jsx (DRY UI) ──────────────────────────── */
  writeTemplate(dir('src/pages/Edit.jsx'), [
    '/**',
    ' * Page d\'édition CRUD — DRY UI Components',
    ' * Utilise DryInput, DryButton, DryCard, DryAlert, DryForm, DrySpinner',
    ' */',
    "import React, { useState, useEffect } from 'react';",
    "import { useNavigate, useParams } from 'react-router-dom';",
    "import { DryInput, DryButton, DryCard, DryAlert, DryForm, DrySpinner } from '../components/dry-ui';",
    '',
    'export default function EditPage({ api, featureLabel, fields }) {',
    '  const { id } = useParams();',
    '  const navigate = useNavigate();',
    '  const [formData, setFormData] = useState({});',
    '  const [isLoading, setIsLoading] = useState(true);',
    '  const [isSaving, setIsSaving] = useState(false);',
    '  const [errorMessage, setErrorMessage] = useState(\'\');',
    '',
    '  useEffect(() => {',
    '    api.get(id)',
    '      .then((response) => {',
    '        const data = response.data || response;',
    '        const cleanData = {};',
    '        fields.forEach((fieldName) => {',
    '          cleanData[fieldName] = data[fieldName] || \'\';',
    '        });',
    '        setFormData(cleanData);',
    '      })',
    '      .catch((error) => {',
    "        setErrorMessage(error.response?.data?.message || 'Erreur de chargement');",
    '      })',
    '      .finally(() => setIsLoading(false));',
    '  }, [id]);',
    '',
    '  const handleSubmit = async () => {',
    '    setIsSaving(true);',
    '    try {',
    '      await api.update(id, formData);',
    "      navigate('/');",
    '    } catch (error) {',
    "      setErrorMessage(error.response?.data?.message || 'Erreur lors de la mise à jour');",
    '    } finally {',
    '      setIsSaving(false);',
    '    }',
    '  };',
    '',
    '  if (isLoading) {',
    '    return <div className="container"><DrySpinner text="Chargement..." /></div>;',
    '  }',
    '',
    '  return (',
    '    <div className="container" style={{ maxWidth: 640 }}>',
    '      <div className="dry-page-header">',
    '        <h2>Modifier {featureLabel}</h2>',
    '      </div>',
    '      <DryCard>',
    '        {errorMessage && <DryAlert variant="error" message={errorMessage} dismissible onDismiss={() => setErrorMessage(\'\')} />}',
    '        <DryForm onSubmit={handleSubmit} loading={isSaving}>',
    '          {fields.map((fieldName) => (',
    '            <DryInput',
    '              key={fieldName}',
    '              label={fieldName}',
    '              value={formData[fieldName] || \'\'}',
    '              placeholder={fieldName}',
    '              onChange={(val) => setFormData({ ...formData, [fieldName]: val })}',
    '            />',
    '          ))}',
    '          <div className="dry-form-actions">',
    '            <DryButton variant="outline" onClick={() => navigate(\'/\')}>Annuler</DryButton>',
    '            <DryButton variant="primary" type="submit" loading={isSaving}>Enregistrer</DryButton>',
    '          </div>',
    '        </DryForm>',
    '      </DryCard>',
    '    </div>',
    '  );',
    '}',
  ].join('\n'), vars);

  /* ── src/App.jsx (DRY UI + Role Guard) ────────────────────── */
  writeTemplate(dir('src/App.jsx'), [
    '/**',
    ' * Application React DRY — DRY UI Components',
    ' * Utilise DryNavbar avec sélecteur de rôle et DryRoleGuard',
    ' */',
    "import React, { useState } from 'react';",
    "import { Routes, Route, Navigate } from 'react-router-dom';",
    "import { isAuthenticated, logout, getCurrentUser } from './api/auth';",
    "import { createCrudApi } from './api/crud';",
    "import { DryNavbar, DryRoleGuard } from '../components/dry-ui';",
    "import LoginPage from './pages/Login';",
    "import ListPage from './pages/List';",
    "import CreatePage from './pages/Create';",
    "import EditPage from './pages/Edit';",
    '',
    "// ── Configuration de l'API cible ──",
    "const APP_NAME = '{{appName}}';",
    "const FEATURE = '{{featureRoute}}';",
    "const FEATURE_LABEL = '{{featureLabel}}';",
    'const api = createCrudApi(APP_NAME, FEATURE);',
    "const DEFAULT_ROLE = '{{userRole}}';",
    '',
    "// Champs par défaut pour les formulaires",
    "const DEFAULT_FIELDS = ['name', 'title', 'description', 'email', 'phone', 'status', 'price', 'category'];",
    '',
    '/**',
    ' * Route protégée (authentification + rôle)',
    ' */',
    'function ProtectedRoute({ children, role }) {',
    '  if (!isAuthenticated()) {',
    '    return <Navigate to="/login" replace />;',
    '  }',
    '  return <DryRoleGuard role={role || DEFAULT_ROLE} userRole={DEFAULT_ROLE}>{children}</DryRoleGuard>;',
    '}',
    '',
    '/**',
    ' * Layout avec DryNavbar et sélecteur de rôle',
    ' */',
    'function AppLayout({ children }) {',
    '  const currentUser = getCurrentUser();',
    '  const [userRole, setUserRole] = useState(DEFAULT_ROLE);',
    '',
    '  return (',
    '    <>',
    '      <DryNavbar',
    '        brand={"DRY — {{featureLabel}}"}',
    '        links={[',
    "          { to: '/', label: 'Liste' },",
    "          { to: '/create', label: '+ Nouveau' },",
    '        ]}',
    '        user={currentUser}',
    '        role={userRole}',
    '        onLogout={logout}',
    '        onRoleSwitch={setUserRole}',
    '      />',
    '      <main className="dry-layout-main">',
    '        <DryRoleGuard role={userRole} userRole={DEFAULT_ROLE}>',
    '          {children}',
    '        </DryRoleGuard>',
    '      </main>',
    '    </>',
    '  );',
    '}',
    '',
    '/**',
    ' * Composant racine — définit toutes les routes',
    ' */',
    'export default function App() {',
    '  return (',
    '    <Routes>',
    '      <Route path="/login" element={<LoginPage />} />',
    '      <Route path="/" element={<ProtectedRoute><AppLayout><ListPage api={api} featureLabel={FEATURE_LABEL} /></AppLayout></ProtectedRoute>} />',
    '      <Route path="/create" element={<ProtectedRoute><AppLayout><CreatePage api={api} featureLabel={FEATURE_LABEL} fields={DEFAULT_FIELDS} /></AppLayout></ProtectedRoute>} />',
    '      <Route path="/edit/:id" element={<ProtectedRoute><AppLayout><EditPage api={api} featureLabel={FEATURE_LABEL} fields={DEFAULT_FIELDS} /></AppLayout></ProtectedRoute>} />',
    '      <Route path="*" element={<Navigate to="/" replace />} />',
    '    </Routes>',
    '  );',
    '}',
  ].join('\n'), vars);

  /* ── src/styles/dry.css ──────────────────────────────────── */
  writeTemplate(dir('src/styles/dry.css'), [
    '/* ═══════════════════════════════════════════════════════',
    '   DRY Design System — Thème Global',
    '   ═══════════════════════════════════════════════════════ */',
    '',
    ':root {',
    '  --dry-primary: #3182ce;',
    '  --dry-primary-dark: #2c5282;',
    '  --dry-bg: #f0f2f5;',
    '  --dry-card: #ffffff;',
    '  --dry-text: #1e293b;',
    '  --dry-text-secondary: #64748b;',
    '  --dry-border: #e2e8f0;',
    '  --dry-success: #38a169;',
    '  --dry-warning: #d69e2e;',
    '  --dry-error: #e53e3e;',
    '  --dry-radius: 12px;',
    '  --dry-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);',
    '  --dry-transition: all 0.2s ease;',
    '}',
    '',
    '* { margin: 0; padding: 0; box-sizing: border-box; }',
    '',
    'body {',
    '  font-family: \'Inter\', system-ui, -apple-system, sans-serif;',
    '  background: var(--dry-bg);',
    '  color: var(--dry-text);',
    '  line-height: 1.6;',
    '}',
    '',
    'a { color: var(--dry-primary); text-decoration: none; }',
    'a:hover { text-decoration: underline; }',
    '',
    '.container { max-width: 1200px; margin: 0 auto; padding: 24px; }',
    '',
    '.card {',
    '  background: var(--dry-card);',
    '  border-radius: var(--dry-radius);',
    '  padding: 24px;',
    '  box-shadow: var(--dry-shadow);',
    '  border: 1px solid var(--dry-border);',
    '}',
    '',
    '.btn {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 8px;',
    '  padding: 10px 20px;',
    '  border-radius: 8px;',
    '  font-weight: 600;',
    '  font-size: 14px;',
    '  border: none;',
    '  cursor: pointer;',
    '  transition: var(--dry-transition);',
    '}',
    '.btn-primary { background: var(--dry-primary); color: white; }',
    '.btn-primary:hover { background: var(--dry-primary-dark); transform: translateY(-1px); }',
    '.btn-danger { background: var(--dry-error); color: white; }',
    '.btn-outline { background: transparent; border: 1px solid var(--dry-border); color: var(--dry-text); }',
    '',
    '.form-group { margin-bottom: 16px; }',
    '.form-group label {',
    '  display: block;',
    '  font-size: 13px;',
    '  font-weight: 700;',
    '  color: var(--dry-text-secondary);',
    '  margin-bottom: 6px;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.05em;',
    '}',
    '.form-input {',
    '  width: 100%;',
    '  padding: 12px 16px;',
    '  border: 2px solid var(--dry-border);',
    '  border-radius: 8px;',
    '  font-size: 15px;',
    '  transition: var(--dry-transition);',
    '  background: #f8fafc;',
    '}',
    '.form-input:focus {',
    '  outline: none;',
    '  border-color: var(--dry-primary);',
    '  box-shadow: 0 0 0 4px rgba(49,130,206,0.1);',
    '  background: white;',
    '}',
    '',
    '.table { width: 100%; border-collapse: collapse; }',
    '.table th {',
    '  text-align: left; padding: 12px 16px;',
    '  font-weight: 700; font-size: 12px;',
    '  color: var(--dry-text-secondary);',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.05em;',
    '  border-bottom: 2px solid var(--dry-border);',
    '}',
    '.table td { padding: 12px 16px; border-bottom: 1px solid #f8fafc; font-size: 14px; }',
    '.table tr:hover td { background: #f8fafc; }',
    '',
    '.navbar {',
    '  background: linear-gradient(135deg, #1e293b, #0f172a);',
    '  color: white;',
    '  padding: 16px 24px;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: space-between;',
    '  position: sticky;',
    '  top: 0;',
    '  z-index: 100;',
    '}',
    '.navbar-brand {',
    '  font-size: 20px; font-weight: 800;',
    '  letter-spacing: -0.03em;',
    '  color: white !important;',
    '  text-decoration: none !important;',
    '}',
    '.navbar-menu { display: flex; gap: 16px; align-items: center; }',
    '.navbar-link {',
    '  color: #cbd5e1 !important;',
    '  font-weight: 600; font-size: 14px;',
    '  padding: 8px 12px; border-radius: 8px;',
    '  text-decoration: none !important;',
    '}',
    '.navbar-link:hover { color: white !important; background: rgba(255,255,255,0.1); }',
    '',
    '.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }',
    '.page-header h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }',
    '',
    '.badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }',
    '.badge-success { background: #e8f5e9; color: #1b5e20; border: 1px solid #81c784; }',
    '.badge-warning { background: #fff3e0; color: #e65100; border: 1px solid #ffb74d; }',
    '.badge-error { background: #ffebee; color: #c62828; border: 1px solid #ef9a9a; }',
  ].join('\n'), vars);

  /* ── Fichiers racine ──────────────────────────────────────── */
  writeTemplate(dir('.gitignore'), [
    '# Dépendances',
    'node_modules/',
    '',
    '# Build',
    'dist/',
    '',
    '# Environnement',
    '.env',
    '',
    '# Logs',
    '*.log',
  ].join('\n'), vars);

  writeTemplate(dir('README.md'), [
    '# DRY — Frontend React ({{appName}}/{{featureLabel}})',
    '',
    'Frontend React connecté à l\'API DRY.',
    '',
    '## Démarrage rapide',
    '',
    '```bash',
    '# Installer les dépendances',
    'npm install',
    '',
    '# Lancer le serveur de développement',
    'npm run dev',
    '```',
    '',
    'Le proxy Vite redirige les appels `/api/*` vers `http://localhost:5000`.',
    '',
    '## Scripts disponibles',
    '',
    '| Commande | Description |',
    '|----------|-------------|',
    '| `npm run dev` | Lance le serveur de développement |',
    '| `npm run build` | Compile pour la production |',
    '| `npm run preview` | Prévisualise le build de production |',
    '',
    '## Structure du projet',
    '',
    '```',
    'src/',
    '  api/          → Client HTTP, authentification, CRUD',
    '  pages/        → Pages de l\'application (Login, List, Create, Edit)',
    '  components/   → Composants réutilisables',
    '  styles/       → Design system DRY (variables CSS, classes utilitaires)',
    '```',
  ].join('\n'), vars);

  console.log('  ✓ Projet React créé dans ' + outputDir);
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  GÉNÉRATION REACT MULTI-FEATURES (ALL)                     ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Génère un projet React avec TOUTES les features d'une app
 * Dashboard multi-features avec navigation et pages CRUD dynamiques
 * @param {string} outputDir
 * @param {string} appName
 * @param {Array} features - Toutes les features [{ name, route, label }]
 * @param {string} userRole - Rôle (admin|client)
 */
const generateReactAll = (outputDir, appName, features, userRole) => {
  const dir = (sub) => path.join(outputDir, sub);
  const vars = { appName, featureCount: String(features.length), userRole };
  const featureList = features.map(f => ({ name: f.name, route: f.route, label: f.label }));
  const featuresJson = JSON.stringify(featureList);

  ['src/api', 'src/pages', 'src/components', 'src/styles'].forEach((d) => fs.mkdirSync(dir(d), { recursive: true }));

  // package.json
  writeTemplate(dir('package.json'), JSON.stringify({
    name: 'dry-' + appName + '-frontend', version: '1.0.0', private: true, type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.20.0', axios: '^1.6.0' },
    devDependencies: { vite: '^5.0.0', '@vitejs/plugin-react': '^4.2.0' },
  }, null, 2), vars);

  writeTemplate(dir('vite.config.js'), [
    "import { defineConfig } from 'vite';",
    "import react from '@vitejs/plugin-react';",
    "export default defineConfig({ plugins: [react()], server: { port: 3000, proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } } } });",
  ].join('\n'), vars);

  writeTemplate(dir('index.html'), '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n<title>DRY - {{appName}}</title>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.jsx"></script>\n</body>\n</html>', vars);

  writeTemplate(dir('src/main.jsx'), [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import { BrowserRouter } from 'react-router-dom';",
    "import App from './App';",
    "import './styles/dry.css';",
    "import './components/dry-ui/dry-ui.css';",
    "ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);",
  ].join('\n'), vars);

  // ── API client.js (identique) ──
  writeTemplate(dir('src/api/client.js'), [
    "import axios from 'axios';",
    "export const API_BASE = '/api/v1';",
    "export const AUTH_BASE = '/api/v1/user';",
    "const client = axios.create({ baseURL: '', headers: { 'Content-Type': 'application/json' } });",
    "client.interceptors.request.use((config) => {",
    "  const token = localStorage.getItem('dry_token');",
    "  if (token) config.headers.Authorization = 'Bearer ' + token;",
    "  return config;",
    "});",
    "client.interceptors.response.use(",
    "  (response) => response,",
    "  (error) => { if (error.response?.status === 401) { localStorage.removeItem('dry_token'); window.location.href = '/login'; } return Promise.reject(error); }",
    ");",
    "export default client;",
  ].join('\n'), vars);

  // ── API auth.js (identique) ──
  writeTemplate(dir('src/api/auth.js'), [
    "export const login = async (email, password) => {",
    "  const { default: client } = await import('./client');",
    "  const response = await client.post('/api/v1/user/login', { email, password });",
    "  const token = response.data?.data?.token;",
    "  if (token) { localStorage.setItem('dry_token', token); localStorage.setItem('dry_user', JSON.stringify(response.data?.data?.user || {})); }",
    "  return response.data;",
    "};",
    "export const logout = () => { localStorage.removeItem('dry_token'); localStorage.removeItem('dry_user'); window.location.href = '/login'; };",
    "export const getCurrentUser = () => { try { return JSON.parse(localStorage.getItem('dry_user')); } catch { return null; } };",
    "export const isAuthenticated = () => !!localStorage.getItem('dry_token');",
  ].join('\n'), vars);

  // ── API crud.js (identique mais avec feature dynamique) ──
  writeTemplate(dir('src/api/crud.js'), [
    "import client, { API_BASE } from './client';",
    "export const createCrudApi = (appName, feature) => {",
    "  const baseUrl = API_BASE + '/' + appName + '/' + feature;",
    "  return {",
    "    list:   async (p) => { const r = await client.get(baseUrl, { params: p }); return r.data; },",
    "    get:    async (id) => { const r = await client.get(baseUrl + '/' + id); return r.data; },",
    "    create: async (d) => { const r = await client.post(baseUrl, d); return r.data; },",
    "    update: async (id, d) => { const r = await client.put(baseUrl + '/' + id, d); return r.data; },",
    "    delete: async (id) => { const r = await client.delete(baseUrl + '/' + id); return r.data; },",
    "  };",
    "};",
  ].join('\n'), vars);

  // ── App.jsx MULTI-FEATURES avec DRY UI Components ──
  writeTemplate(dir('src/App.jsx'), [
    "import React, { useState, useEffect } from 'react';",
    "import { Routes, Route, Navigate, Link, useParams, useNavigate } from 'react-router-dom';",
    "import { isAuthenticated, logout, getCurrentUser } from './api/auth';",
    "import { createCrudApi } from './api/crud';",
    "import { DryNavbar, DryRoleGuard, DryCard, DryButton, DryTable, DryBadge, DrySpinner, DryInput } from './components/dry-ui';",
    "import LoginPage from './pages/Login';",
    "",
    "// ─── Configuration ───",
    "const APP_NAME = '" + appName + "';",
    "const ALL_FEATURES = " + featuresJson + ";",
    "const DEFAULT_ROLE = '{{userRole}}';",
    "const DEFAULT_FIELDS = ['name', 'title', 'description', 'email', 'phone', 'status', 'price', 'category'];",
    "",
    "// ─── Route protégée avec DryRoleGuard ───",
    "function ProtectedRoute({ children, role }) {",
    "  if (!isAuthenticated()) return <Navigate to='/login' replace />;",
    "  return <DryRoleGuard role={role || DEFAULT_ROLE} userRole={DEFAULT_ROLE}>{children}</DryRoleGuard>;",
    "}",
    "",
    "// ─── Layout avec DryNavbar + onglets features ───",
    "function AppLayout({ children, currentFeature }) {",
    "  const user = getCurrentUser();",
    "  const [userRole, setUserRole] = useState(DEFAULT_ROLE);",
    "  return (",
    "    <>",
    "      <DryNavbar links={[]} role={userRole} onRoleSwitch={setUserRole} brand={\"DRY - " + appName.charAt(0).toUpperCase() + appName.slice(1) + "\"} user={user} onLogout={logout} />",
    "      <div style={{display:'flex',gap:8,padding:'8px 24px',background:'linear-gradient(135deg,#1e293b,#0f172a)',overflowX:'auto'}}>",
    "        {ALL_FEATURES.map(f => (",
    "          <Link key={f.route} to={'/feature/'+f.route}",
    "            style={{",
    "              color: currentFeature === f.route ? '#fff' : '#cbd5e1',",
    "              fontWeight: 600, fontSize: 13, padding: '6px 14px',",
    "              borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap',",
    "              background: currentFeature === f.route ? 'rgba(49,130,206,0.3)' : 'transparent',",
    "            }}",
    "          >{f.label}</Link>",
    "        ))}",
    "      </div>",
    "      <main style={{padding: 24}}><DryRoleGuard role={userRole} userRole={DEFAULT_ROLE}>{children}</DryRoleGuard></main>",
    "    </>",
    "  );",
    "}",
    "",
    "// ─── Dashboard avec DryCard ───",
    "function DashboardPage() {",
    "  const [stats, setStats] = useState({});",
    "  useEffect(() => {",
    "    ALL_FEATURES.forEach(async (f) => {",
    "      try {",
    "        const api = createCrudApi(APP_NAME, f.route);",
    "        const res = await api.list();",
    "        const items = res.data || [];",
    "        setStats(prev => ({...prev, [f.route]: items.length}));",
    "      } catch { setStats(prev => ({...prev, [f.route]: '?'})); }",
    "    });",
    "  }, []);",
    "  return (",
    "    <div style={{maxWidth:1200,margin:'0 auto'}}>",
    "      <h1 style={{marginBottom:24,fontSize:24,fontWeight:800}}>Dashboard</h1>",
    "      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(250px,1fr))',gap:16}}>",
    "        {ALL_FEATURES.map(f => (",
    "          <Link key={f.route} to={'/feature/'+f.route} style={{textDecoration:'none'}}>",
    "            <DryCard padding={24} hoverable style={{cursor:'pointer'}}>",
    "              <h3 style={{margin:'0 0 8px',fontSize:18,fontWeight:700}}>{f.label}</h3>",
    "              <p style={{margin:0,fontSize:13,color:'var(--dry-text-secondary)'}}>/{f.route}</p>",
    "              <div style={{marginTop:12}}>",
    "                <DryBadge variant='success'>{stats[f.route] !== undefined ? stats[f.route] + ' elements' : '...'}</DryBadge>",
    "              </div>",
    "            </DryCard>",
    "          </Link>",
    "        ))}",
    "      </div>",
    "    </div>",
    "  );",
    "}",
    "",
    "// ─── Liste d'une feature avec DryTable ───",
    "function FeatureListPage() {",
    "  const { featureName } = useParams();",
    "  const navigate = useNavigate();",
    "  const feature = ALL_FEATURES.find(f => f.route === featureName);",
    "  const api = createCrudApi(APP_NAME, featureName);",
    "  const [items, setItems] = useState([]);",
    "  const [loading, setLoading] = useState(true);",
    "  useEffect(() => { api.list().then(r => { setItems(r.data||[]); }).finally(() => setLoading(false)); }, [featureName]);",
    "  const del = async (id) => { if (!confirm('Supprimer ?')) return; await api.delete(id); setItems(items.filter(i => (i._id||i.id)!==id)); };",
    "  if (!feature) return <div style={{padding:24}}><p>Feature inconnue</p></div>;",
    "  return (",
    "    <div style={{maxWidth:1200,margin:'0 auto'}}>",
    "      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>",
    "        <h2 style={{margin:0,fontSize:20}}>{feature.label}</h2>",
    "        <DryButton variant='primary' size='sm' onClick={() => navigate('/feature/'+featureName+'/create')}>+ Nouveau</DryButton>",
    "      </div>",
    "      <DryCard>",
    "        <DryTable",
    "          data={items}",
    "          loading={loading}",
    "          exclude={['__v','password','hash']}",
    "          onEdit={(id) => navigate('/feature/'+featureName+'/'+id+'/edit')}",
    "          onDelete={del}",
    "          emptyText='Aucun element trouve' />",
    "      </DryCard>",
    "    </div>",
    "  );",
    "}",
    "",
    "// ─── Création avec DryInput ───",
    "function FeatureCreatePage() {",
    "  const { featureName } = useParams();",
    "  const navigate = useNavigate();",
    "  const feature = ALL_FEATURES.find(f => f.route === featureName);",
    "  const api = createCrudApi(APP_NAME, featureName);",
    "  const [form, setForm] = useState({});",
    "  const handleSubmit = async () => { try { await api.create(form); navigate('/feature/'+featureName); } catch(e) { alert(e.response?.data?.message); } };",
    "  if (!feature) return null;",
    "  return (",
    "    <div style={{maxWidth:640,margin:'0 auto'}}>",
    "      <h2 style={{marginBottom:16}}>Nouveau {feature.label}</h2>",
    "      <DryCard>",
    "        {DEFAULT_FIELDS.map(f => (",


    "            <DryInput key={f} label={f} value={form[f]||''} onChange={(val) => setForm({...form,[f]:val})} placeholder={f} />",

    "        ))}",
    "        <div style={{display:'flex',gap:8,marginTop:16}}>",
    "          <DryButton variant='primary' onClick={handleSubmit}>Creer</DryButton>",
    "          <DryButton variant='outline' onClick={() => navigate('/feature/'+featureName)}>Annuler</DryButton>",
    "        </div>",
    "      </DryCard>",
    "    </div>",
    "  );",
    "}",
    "",
    "// ─── Édition avec DryInput ───",
    "function FeatureEditPage() {",
    "  const { featureName, id } = useParams();",
    "  const navigate = useNavigate();",
    "  const api = createCrudApi(APP_NAME, featureName);",
    "  const [form, setForm] = useState({});",
    "  const [loading, setLoading] = useState(true);",
    "  useEffect(() => { api.get(id).then(r => { const d = r.data||r; const c={}; DEFAULT_FIELDS.forEach(f => { c[f]=d[f]||''; }); setForm(c); }).finally(() => setLoading(false)); }, [id]);",
    "  const handleSubmit = async () => { try { await api.update(id, form); navigate('/feature/'+featureName); } catch(e) { alert(e.response?.data?.message); } };",
    "  const feature = ALL_FEATURES.find(f => f.route === featureName);",
    "  if (loading) return <div style={{padding:24,textAlign:'center'}}><DrySpinner text='Chargement...' /></div>;",
    "  return (",
    "    <div style={{maxWidth:640,margin:'0 auto'}}>",
    "      <h2 style={{marginBottom:16}}>Modifier {feature?.label}</h2>",
    "      <DryCard>",
    "        {DEFAULT_FIELDS.map(f => (",


    "            <DryInput key={f} label={f} value={form[f]||''} onChange={(val) => setForm({...form,[f]:val})} placeholder={f} />",

    "        ))}",
    "        <div style={{display:'flex',gap:8,marginTop:16}}>",
    "          <DryButton variant='primary' onClick={handleSubmit}>Enregistrer</DryButton>",
    "          <DryButton variant='outline' onClick={() => navigate('/feature/'+featureName)}>Annuler</DryButton>",
    "        </div>",
    "      </DryCard>",
    "    </div>",
    "  );",
    "}",
    "",
    "// ─── Routes principales ───",
    "export default function App() {",
    "  return (",
    "    <Routes>",
    "      <Route path='/login' element={<LoginPage />} />",
    "      <Route path='/' element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />",
    "      <Route path='/feature/:featureName' element={<ProtectedRoute><AppLayout><FeatureListPage /></AppLayout></ProtectedRoute>} />",
    "      <Route path='/feature/:featureName/create' element={<ProtectedRoute><AppLayout><FeatureCreatePage /></AppLayout></ProtectedRoute>} />",
    "      <Route path='/feature/:featureName/:id/edit' element={<ProtectedRoute><AppLayout><FeatureEditPage /></AppLayout></ProtectedRoute>} />",
    "      <Route path='*' element={<Navigate to='/' replace />} />",
    "    </Routes>",
    "  );",
    "}",
  ].join('\n'), vars);

  // ── Login.jsx (DRY UI) ──
  writeTemplate(dir('src/pages/Login.jsx'), [
    "/**",
    " * Page de connexion — DRY UI Components",
    " */",
    "import React, { useState } from 'react';",
    "import { useNavigate } from 'react-router-dom';",
    "import { login } from '../api/auth';",
    "import { DryInput, DryButton, DryCard, DryAlert, DrySpinner } from '../components/dry-ui';",
    "",
    "export default function Login() {",
    "  const navigate = useNavigate();",
    "  const [email, setEmail] = useState('');",
    "  const [password, setPassword] = useState('');",
    "  const [error, setError] = useState('');",
    "  const [loading, setLoading] = useState(false);",
    "",
    "  const handleSubmit = async (ev) => {",
    "    ev.preventDefault(); setLoading(true); setError('');",
    "    try { await login(email, password); navigate('/'); }",
    "    catch(err) { setError(err.response?.data?.message || 'Erreur de connexion'); }",
    "    finally { setLoading(false); }",
    "  };",
    "",
    "  return (",
    "    <div className='dry-login-page'>",
    "      <DryCard padding={40} style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>",
    "        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>DRY API</h1>",
    "        <p style={{ color: 'var(--dry-text-secondary)', marginBottom: 24 }}>Connectez-vous</p>",
    "        {error && <DryAlert variant='error' message={error} dismissible />}",
    "        {loading && <DrySpinner variant='overlay' text='Connexion...' />}",
    "        <form onSubmit={handleSubmit}>",
    "          <DryInput label='Email' type='email' value={email} onChange={setEmail} required />",
    "          <DryInput label='Mot de passe' type='password' value={password} onChange={setPassword} required />",
    "          <DryButton type='submit' variant='primary' fullWidth loading={loading}>Se connecter</DryButton>",
    "        </form>",
    "      </DryCard>",
    "    </div>",
    "  );",
    "}",
  ].join('\n'), vars);

  // ── Styles ──
  writeTemplate(dir('src/styles/dry.css'), [
    ':root { --dry-primary:#3182ce; --dry-bg:#f0f2f5; --dry-card:#fff; --dry-text:#1e293b; --dry-text-secondary:#64748b; --dry-border:#e2e8f0; --dry-error:#e53e3e; --dry-radius:12px; }',
    '* { margin:0; padding:0; box-sizing:border-box; }',
    'body { font-family:Inter,system-ui,sans-serif; background:var(--dry-bg); color:var(--dry-text); line-height:1.6; }',
    '.container { max-width:1200px; margin:0 auto; padding:24px; }',
    '.card { background:var(--dry-card); border-radius:var(--dry-radius); padding:24px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border:1px solid var(--dry-border); }',
    '.btn { display:inline-flex; align-items:center; gap:8px; padding:10px 20px; border-radius:8px; font-weight:600; font-size:14px; border:none; cursor:pointer; transition:all 0.2s; }',
    '.btn-primary { background:var(--dry-primary); color:white; }',
    '.btn-primary:hover { background:#2c5282; }',
    '.btn-danger { background:var(--dry-error); color:white; }',
    '.btn-outline { background:transparent; border:1px solid var(--dry-border); color:var(--dry-text); }',
    '.form-group { margin-bottom:16px; }',
    '.form-group label { display:block; font-size:13px; font-weight:700; color:var(--dry-text-secondary); margin-bottom:6px; text-transform:uppercase; }',
    '.form-input { width:100%; padding:12px 16px; border:2px solid var(--dry-border); border-radius:8px; font-size:15px; background:#f8fafc; }',
    '.form-input:focus { outline:none; border-color:var(--dry-primary); box-shadow:0 0 0 4px rgba(49,130,206,0.1); background:white; }',
    '.table { width:100%; border-collapse:collapse; }',
    '.table th { text-align:left; padding:12px 16px; font-weight:700; font-size:12px; color:var(--dry-text-secondary); text-transform:uppercase; border-bottom:2px solid var(--dry-border); }',
    '.table td { padding:12px 16px; border-bottom:1px solid #f8fafc; font-size:14px; }',
    '.table tr:hover td { background:#f8fafc; }',
    '.navbar { background:linear-gradient(135deg,#1e293b,#0f172a); color:white; }',
    '.navbar-brand { font-size:20px; font-weight:800; color:white!important; text-decoration:none!important; }',
    '.navbar-link { color:#cbd5e1!important; font-weight:600; text-decoration:none!important; }',
    '.navbar-link:hover { color:white!important; background:rgba(255,255,255,0.1); }',
    '.page-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }',
    '.page-header h1 { font-size:24px; font-weight:800; }',
    '.badge { display:inline-flex; align-items:center; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:700; }',
    '.badge-success { background:#e8f5e9; color:#1b5e20; border:1px solid #81c784; }',
    '.badge-error { background:#ffebee; color:#c62828; border:1px solid #ef9a9a; }',
  ].join('\n'), vars);

  // ── .gitignore + README ──
  writeTemplate(dir('.gitignore'), 'node_modules/\ndist/\n.env\n*.log\n', vars);
  writeTemplate(dir('README.md'), [
    '# DRY - Frontend React (' + appName + ')',
    '',
    'Dashboard multi-features avec CRUD complet pour chaque feature.',
    '',
    '## Features disponibles',
    features.map(f => '- ' + f.label + ' (/' + f.route + ')').join('\n'),
    '',
    '## Démarrage',
    '```bash',
    'npm install',
    'npm run dev',
    '```',
  ].join('\n'), vars);

  console.log('  ✓ Projet React multi-features créé dans ' + outputDir);
  console.log('  ✓ ' + features.length + ' features: ' + features.map(f => f.label).join(', '));
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  GÉNÉRATION ANGULAR                                        ║
// ╚══════════════════════════════════════════════════════════════╝

const generateAngular = (outputDir, appName, feature) => {
  const dir = (sub) => path.join(outputDir, sub);
  const vars = { appName, featureRoute: feature.route, featureLabel: feature.label };

  ['src/app/api', 'src/app/pages', 'src/app/shared'].forEach((d) => fs.mkdirSync(dir(d), { recursive: true }));

  writeTemplate(dir('package.json'), JSON.stringify({
    name: appName + '-angular', version: '1.0.0', private: true,
    scripts: { start: 'ng serve', build: 'ng build' },
    dependencies: {
      '@angular/core': '^17.0.0', '@angular/router': '^17.0.0', '@angular/forms': '^17.0.0',
      '@angular/platform-browser': '^17.0.0', '@angular/common': '^17.0.0',
      rxjs: '~7.8.0', tslib: '^2.3.0', 'zone.js': '~0.14.0',
    },
    devDependencies: { '@angular/cli': '^17.0.0', typescript: '~5.2.0', '@angular-devkit/build-angular': '^17.0.0', '@angular/compiler-cli': '^17.0.0' },
  }, null, 2), vars);

  writeTemplate(dir('angular.json'), JSON.stringify({
    $schema: './node_modules/@angular/cli/lib/config/schema.json', version: 1, newProjectRoot: 'projects',
    projects: { 'dry-app': { projectType: 'application', root: '', sourceRoot: 'src', prefix: 'dry',
      architect: {
        build: { builder: '@angular-devkit/build-angular:browser', options: { outputPath: 'dist', index: 'src/index.html', main: 'src/main.ts', polyfills: 'src/polyfills.ts', tsConfig: 'tsconfig.json', styles: ['src/styles.css'] } },
        serve: { builder: '@angular-devkit/build-angular:dev-server', options: { browserTarget: 'dry-app:build', proxyConfig: 'proxy.conf.json' } },
      },
    }},
  }, null, 2), vars);

  writeTemplate(dir('proxy.conf.json'), JSON.stringify({ "/api": { target: 'http://localhost:5000', secure: false, changeOrigin: true } }, null, 2), vars);
  writeTemplate(dir('tsconfig.json'), JSON.stringify({ compileOnSave: false, compilerOptions: { baseUrl: './', outDir: './dist', strict: true, experimentalDecorators: true, moduleResolution: 'node', target: 'ES2022', module: 'ES2022', lib: ['ES2022', 'dom'] } }, null, 2), vars);
  writeTemplate(dir('.gitignore'), 'node_modules/\ndist/\n*.log\n', vars);
  writeTemplate(dir('src/index.html'), '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8"/>\n<title>DRY - {{appName}}</title>\n<base href="/"/>\n</head>\n<body>\n<dry-root></dry-root>\n</body>\n</html>', vars);
  writeTemplate(dir('src/styles.css'), ':root { --primary: #3182ce; --bg: #f0f2f5; --card: #fff; --text: #1e293b; }\n* { margin:0; padding:0; box-sizing:border-box; }\nbody { font-family:Inter,sans-serif; background:var(--bg); color:var(--text); }\n.container { max-width:1200px; margin:0 auto; padding:24px; }\n.card { background:var(--card); border-radius:12px; padding:24px; }\n.btn { display:inline-flex; padding:10px 20px; border-radius:8px; font-weight:600; border:none; cursor:pointer; }\n.btn-primary { background:var(--primary); color:white; }\n.form-input { width:100%; padding:12px; border:2px solid #e2e8f0; border-radius:8px; }\n', vars);
  writeTemplate(dir('src/main.ts'), "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';\nimport { AppModule } from './app/app.module';\nplatformBrowserDynamic().bootstrapModule(AppModule).catch(err => console.error(err));\n", vars);
  writeTemplate(dir('src/polyfills.ts'), "import 'zone.js';\n", vars);

  writeTemplate(dir('src/app/app.module.ts'), [
    "import { NgModule } from '@angular/core';",
    "import { BrowserModule } from '@angular/platform-browser';",
    "import { FormsModule } from '@angular/forms';",
    "import { HttpClientModule } from '@angular/common/http';",
    "import { AppRoutingModule } from './app-routing.module';",
    "import { AppComponent } from './app.component';",
    "import { LoginComponent } from './pages/login.component';",
    "import { ListComponent } from './pages/list.component';",
    "import { CreateComponent } from './pages/create.component';",
    "import { EditComponent } from './pages/edit.component';",
    "@NgModule({ declarations: [AppComponent,LoginComponent,ListComponent,CreateComponent,EditComponent], imports: [BrowserModule,FormsModule,HttpClientModule,AppRoutingModule], bootstrap: [AppComponent] })",
    "export class AppModule {}",
  ].join('\n'), vars);

  writeTemplate(dir('src/app/app-routing.module.ts'), [
    "import { NgModule } from '@angular/core';",
    "import { RouterModule, Routes } from '@angular/router';",
    "import { LoginComponent } from './pages/login.component';",
    "import { ListComponent } from './pages/list.component';",
    "import { CreateComponent } from './pages/create.component';",
    "import { EditComponent } from './pages/edit.component';",
    "const routes: Routes = [",
    "  { path: '', component: ListComponent },",
    "  { path: 'login', component: LoginComponent },",
    "  { path: 'create', component: CreateComponent },",
    "  { path: 'edit/:id', component: EditComponent },",
    "];",
    "@NgModule({ imports: [RouterModule.forRoot(routes)], exports: [RouterModule] })",
    "export class AppRoutingModule {}",
  ].join('\n'), vars);

  writeTemplate(dir('src/app/api/api.service.ts'), [
    "import { Injectable } from '@angular/core';",
    "import { HttpClient, HttpHeaders } from '@angular/common/http';",
    "import { Observable } from 'rxjs';",
    "@Injectable({ providedIn: 'root' })",
    "export class ApiService {",
    "  private baseUrl = '/api/v1';",
    "  constructor(private http: HttpClient) {}",
    "  private getAuthHeaders() { const t = localStorage.getItem('dry_token'); return t ? new HttpHeaders({ Authorization: 'Bearer ' + t }) : new HttpHeaders(); }",
    "  login(email: string, password: string): Observable<any> { return this.http.post(this.baseUrl + '/user/login', { email, password }); }",
    "  list(app: string, feat: string): Observable<any> { return this.http.get(this.baseUrl + '/' + app + '/' + feat, { headers: this.getAuthHeaders() }); }",
    "  get(app: string, feat: string, id: string): Observable<any> { return this.http.get(this.baseUrl + '/' + app + '/' + feat + '/' + id, { headers: this.getAuthHeaders() }); }",
    "  create(app: string, feat: string, data: any): Observable<any> { return this.http.post(this.baseUrl + '/' + app + '/' + feat, data, { headers: this.getAuthHeaders() }); }",
    "  update(app: string, feat: string, id: string, data: any): Observable<any> { return this.http.put(this.baseUrl + '/' + app + '/' + feat + '/' + id, data, { headers: this.getAuthHeaders() }); }",
    "  delete(app: string, feat: string, id: string): Observable<any> { return this.http.delete(this.baseUrl + '/' + app + '/' + feat + '/' + id, { headers: this.getAuthHeaders() }); }",
    "}",
  ].join('\n'), vars);

  // Pages Angular avec inline templates
  writeTemplate(dir('src/app/app.component.ts'), "import { Component } from '@angular/core';\n@Component({ selector: 'dry-root', template: '<nav class=\"navbar\" *ngIf=\"logged\"><a routerLink=\"/\" style=\"font-weight:800;color:white;\">DRY - {{featureLabel}}</a></nav><router-outlet></router-outlet>' })\nexport class AppComponent { logged = !!localStorage.getItem('dry_token'); }\n", vars);

  writeTemplate(dir('src/app/pages/login.component.ts'), [
    "import { Component } from '@angular/core';",
    "import { Router } from '@angular/router';",
    "import { ApiService } from '../api/api.service';",
    "import { firstValueFrom } from 'rxjs';",
    "@Component({ template: '<div style=\"display:flex;justify-content:center;align-items:center;min-height:100vh\"><div class=\"card\" style=\"max-width:400px;padding:40px\"><h1 style=\"text-align:center\">DRY API</h1><div class=\"form-group\"><label>Email</label><input #email class=\"form-input\"></div><div class=\"form-group\"><label>Password</label><input #pass class=\"form-input\" type=\"password\"></div><button class=\"btn btn-primary\" style=\"width:100%\" (click)=\"login(email.value,pass.value)\">Login</button></div></div>' })",
    "export class LoginComponent {",
    "  constructor(private api: ApiService, private router: Router) {}",
    "  async login(email: string, password: string) {",
    "    try { const r: any = await firstValueFrom(this.api.login(email, password)); localStorage.setItem('dry_token', r.data?.token); this.router.navigate(['/']); }",
    "    catch { alert('Erreur de connexion'); }",
    "  }",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/app/pages/list.component.ts'), [
    "import { Component, OnInit } from '@angular/core';",
    "import { ApiService } from '../api/api.service';",
    "import { firstValueFrom } from 'rxjs';",
    "@Component({ template: '<div class=\"container\"><div class=\"page-header\"><h1>{{featureLabel}}</h1><a routerLink=\"/create\" class=\"btn btn-primary\">+ Nouveau</a></div><div class=\"card\"><table *ngIf=\"items.length\"><tr><th *ngFor=\"let c of cols\">{{c}}</th><th>Actions</th></tr><tr *ngFor=\"let item of items\"><td *ngFor=\"let c of cols\">{{item[c]}}</td><td><a [routerLink]=\"['/edit',item._id||item.id]\">Edit</a> <button (click)=\"del(item._id||item.id)\">Delete</button></td></tr></table><p *ngIf=\"!items.length\">Aucun</p></div></div>' })",
    "export class ListComponent implements OnInit {",
    "  items: any[] = []; cols: string[] = [];",
    "  featureLabel = '{{featureLabel}}'; appName = '{{appName}}'; feature = '{{featureRoute}}';",
    "  constructor(private api: ApiService) {}",
    "  ngOnInit() { this.load(); }",
    "  async load() { try { const r: any = await firstValueFrom(this.api.list(this.appName, this.feature)); this.items = r.data || []; if (this.items.length) this.cols = Object.keys(this.items[0]).filter(k => !['__v','password'].includes(k)).slice(0,5); } catch { console.error('Erreur'); } }",
    "  async del(id: string) { if (!confirm('Supprimer ?')) return; await firstValueFrom(this.api.delete(this.appName, this.feature, id)); this.load(); }",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/app/pages/create.component.ts'), [
    "import { Component } from '@angular/core';",
    "import { Router } from '@angular/router';",
    "import { ApiService } from '../api/api.service';",
    "import { firstValueFrom } from 'rxjs';",
    "@Component({ template: '<div class=\"container\" style=\"max-width:640px\"><h1>Nouveau</h1><div class=\"card\"><div class=\"form-group\" *ngFor=\"let f of fields\"><label>{{f}}</label><input class=\"form-input\" [(ngModel)]=\"form[f]\"></div><button class=\"btn btn-primary\" (click)=\"submit()\">Creer</button></div></div>' })",
    "export class CreateComponent {",
    "  fields = ['name','title','description','status']; form: any = {};",
    "  appName = '{{appName}}'; feature = '{{featureRoute}}';",
    "  constructor(private api: ApiService, private router: Router) {}",
    "  async submit() { try { await firstValueFrom(this.api.create(this.appName, this.feature, this.form)); this.router.navigate(['/']); } catch { alert('Erreur'); } }",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/app/pages/edit.component.ts'), [
    "import { Component, OnInit } from '@angular/core';",
    "import { ActivatedRoute, Router } from '@angular/router';",
    "import { ApiService } from '../api/api.service';",
    "import { firstValueFrom } from 'rxjs';",
    "@Component({ template: '<div class=\"container\" style=\"max-width:640px\"><h1>Modifier</h1><div class=\"card\"><div class=\"form-group\" *ngFor=\"let f of fields\"><label>{{f}}</label><input class=\"form-input\" [(ngModel)]=\"form[f]\"></div><button class=\"btn btn-primary\" (click)=\"submit()\">Enregistrer</button></div></div>' })",
    "export class EditComponent implements OnInit {",
    "  fields = ['name','title','description','status']; form: any = {}; id = '';",
    "  appName = '{{appName}}'; feature = '{{featureRoute}}';",
    "  constructor(private api: ApiService, private route: ActivatedRoute, private router: Router) {}",
    "  ngOnInit() { this.id = this.route.snapshot.params['id']; firstValueFrom(this.api.get(this.appName, this.feature, this.id)).then((r: any) => { const d = r.data || r; this.fields.forEach(f => { this.form[f] = d[f] || ''; }); }); }",
    "  async submit() { await firstValueFrom(this.api.update(this.appName, this.feature, this.id, this.form)); this.router.navigate(['/']); }",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('README.md'), '# DRY - Angular ({{appName}}/{{featureLabel}})\n\n```bash\nnpm install\nng serve --proxy-config proxy.conf.json\n```\n', vars);
  console.log('  ✓ Projet Angular créé dans ' + outputDir);
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  GÉNÉRATION REACT NATIVE (Expo)                            ║
// ╚══════════════════════════════════════════════════════════════╝

const generateReactNative = (outputDir, appName, feature) => {
  const dir = (sub) => path.join(outputDir, sub);
  const vars = { appName, featureRoute: feature.route, featureLabel: feature.label };

  ['src/api', 'src/screens', 'src/components'].forEach((d) => fs.mkdirSync(dir(d), { recursive: true }));

  writeTemplate(dir('package.json'), JSON.stringify({
    name: 'dry-' + appName + '-mobile', version: '1.0.0', main: 'App.js',
    scripts: { start: 'expo start', android: 'expo start --android', ios: 'expo start --ios' },
    dependencies: {
      expo: '~50.0.0', react: '18.2.0', 'react-native': '0.73.0',
      '@react-navigation/native': '^6.1.0', '@react-navigation/native-stack': '^6.9.0',
      'react-native-screens': '~3.29.0', 'react-native-safe-area-context': '4.8.0',
      axios: '^1.6.0', '@react-native-async-storage/async-storage': '1.21.0',
    },
    devDependencies: { '@babel/core': '^7.20.0' }, private: true,
  }, null, 2), vars);

  writeTemplate(dir('app.json'), JSON.stringify({ expo: { name: 'DRY ' + appName, slug: 'dry-' + appName, version: '1.0.0', orientation: 'portrait' } }, null, 2), vars);
  writeTemplate(dir('babel.config.js'), "module.exports = function(api) { api.cache(true); return { presets: ['babel-preset-expo'] }; };\n", vars);
  writeTemplate(dir('.gitignore'), 'node_modules/\n.expo/\n*.log\n.env\n', vars);

  writeTemplate(dir('src/api/client.js'), [
    "/**",
    " * Client HTTP avec interception JWT pour React Native",
    " * Détecte automatiquement la plateforme pour l'URL API",
    " */",
    "import axios from 'axios';",
    "import AsyncStorage from '@react-native-async-storage/async-storage';",
    "import { Platform } from 'react-native';",
    "",
    "const API_URL = Platform.select({",
    "  android: 'http://10.0.2.2:5000',",
    "  ios: 'http://localhost:5000',",
    "  default: 'http://localhost:5000',",
    "});",
    "",
    "const client = axios.create({ baseURL: API_URL });",
    "",
    "client.interceptors.request.use(async (config) => {",
    "  const token = await AsyncStorage.getItem('dry_token');",
    "  if (token) config.headers.Authorization = 'Bearer ' + token;",
    "  return config;",
    "});",
    "",
    "/**",
    " * Connecte l'utilisateur et stocke le token",
    " */",
    "export const login = async (email, password) => {",
    "  const res = await client.post('/api/v1/user/login', { email, password });",
    "  const token = res.data?.data?.token;",
    "  if (token) {",
    "    await AsyncStorage.setItem('dry_token', token);",
    "    await AsyncStorage.setItem('dry_user', JSON.stringify(res.data?.data?.user || {}));",
    "  }",
    "  return res.data;",
    "};",
    "",
    "/**",
    " * Déconnecte l'utilisateur",
    " */",
    "export const logout = async () => { await AsyncStorage.multiRemove(['dry_token', 'dry_user']); };",
    "",
    "export default client;",
  ].join('\n'), vars);

  writeTemplate(dir('src/api/crud.js'), [
    "/**",
    " * Fonctions CRUD pour React Native",
    " */",
    "import client from './client';",
    "",
    "export const createCrudApi = (appName, feature) => {",
    "  const baseUrl = '/api/v1/' + appName + '/' + feature;",
    "  return {",
    "    list:  (params) => client.get(baseUrl, { params }).then(r => r.data),",
    "    get:   (id)     => client.get(baseUrl + '/' + id).then(r => r.data),",
    "    create:(data)   => client.post(baseUrl, data).then(r => r.data),",
    "    update:(id, d)  => client.put(baseUrl + '/' + id, d).then(r => r.data),",
    "    delete:(id)     => client.delete(baseUrl + '/' + id).then(r => r.data),",
    "  };",
    "};",
  ].join('\n'), vars);

  writeTemplate(dir('App.js'), [
    "/**",
    " * Application React Native DRY",
    " * Navigation avec écrans Login, List, Create, Edit",
    " */",
    "import React from 'react';",
    "import { NavigationContainer } from '@react-navigation/native';",
    "import { createNativeStackNavigator } from '@react-navigation/native-stack';",
    "import LoginScreen from './src/screens/LoginScreen';",
    "import ListScreen from './src/screens/ListScreen';",
    "import CreateScreen from './src/screens/CreateScreen';",
    "import EditScreen from './src/screens/EditScreen';",
    "import { createCrudApi } from './src/api/crud';",
    "",
    "const Stack = createNativeStackNavigator();",
    "const api = createCrudApi('{{appName}}', '{{featureRoute}}');",
    "",
    "export default function App() {",
    "  return (",
    "    <NavigationContainer>",
    "      <Stack.Navigator initialRouteName=\"Login\" screenOptions={{headerStyle:{backgroundColor:'#1e293b'},headerTintColor:'#fff'}}>",
    "        <Stack.Screen name=\"Login\" component={LoginScreen} options={{title:'Connexion'}} />",
    "        <Stack.Screen name=\"List\" options={{title:'{{featureLabel}}'}}>{(props) => <ListScreen {...props} api={api} />}</Stack.Screen>",
    "        <Stack.Screen name=\"Create\">{(props) => <CreateScreen {...props} api={api} />}</Stack.Screen>",
    "        <Stack.Screen name=\"Edit\">{(props) => <EditScreen {...props} api={api} />}</Stack.Screen>",
    "      </Stack.Navigator>",
    "    </NavigationContainer>",
    "  );",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/screens/LoginScreen.js'), [
    "/**",
    " * Écran de connexion React Native",
    " */",
    "import React, { useState } from 'react';",
    "import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';",
    "import { login } from '../api/client';",
    "",
    "export default function LoginScreen({ navigation }) {",
    "  const [email, setEmail] = useState('');",
    "  const [password, setPassword] = useState('');",
    "",
    "  const handleLogin = async () => {",
    "    try {",
    "      await login(email, password);",
    "      navigation.reset({ index: 0, routes: [{ name: 'List' }] });",
    "    } catch (err) {",
    "      Alert.alert('Erreur', err.response?.data?.message || 'Echec de connexion');",
    "    }",
    "  };",
    "",
    "  return (",
    "    <View style={styles.container}>",
    "      <View style={styles.card}>",
    "        <Text style={styles.title}>DRY API</Text>",
    "        <TextInput style={styles.input} placeholder=\"Email\" value={email} onChangeText={setEmail} autoCapitalize=\"none\" />",
    "        <TextInput style={styles.input} placeholder=\"Mot de passe\" value={password} onChangeText={setPassword} secureTextEntry />",
    "        <TouchableOpacity style={styles.button} onPress={handleLogin}>",
    "          <Text style={styles.buttonText}>Se connecter</Text>",
    "        </TouchableOpacity>",
    "      </View>",
    "    </View>",
    "  );",
    "}",
    "",
    "const styles = StyleSheet.create({",
    "  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5', padding: 24 },",
    "  card: { backgroundColor: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400 },",
    "  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 24 },",
    "  input: { backgroundColor: '#f8fafc', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },",
    "  button: { backgroundColor: '#3182ce', borderRadius: 12, padding: 16, alignItems: 'center' },",
    "  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },",
    "});",
  ].join('\n'), vars);

  writeTemplate(dir('src/screens/ListScreen.js'), [
    "/**",
    " * Écran de liste CRUD React Native",
    " */",
    "import React, { useState, useCallback } from 'react';",
    "import { View, Text, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';",
    "",
    "export default function ListScreen({ navigation, api }) {",
    "  const [items, setItems] = useState([]);",
    "  const [loading, setLoading] = useState(true);",
    "",
    "  const loadItems = useCallback(async () => {",
    "    setLoading(true);",
    "    try {",
    "      const response = await api.list();",
    "      setItems(response.data || []);",
    "    } catch { Alert.alert('Erreur', 'Impossible de charger'); }",
    "    finally { setLoading(false); }",
    "  }, []);",
    "",
    "  React.useEffect(() => { const unsubscribe = navigation.addListener('focus', loadItems); return unsubscribe; }, [loadItems, navigation]);",
    "",
    "  if (loading) return <ActivityIndicator style={{ flex: 1 }} color=\"#3182ce\" />;",
    "",
    "  return (",
    "    <View style={{ flex: 1, backgroundColor: '#f0f2f5' }}>",
    "      <TouchableOpacity style={{ backgroundColor: '#3182ce', padding: 16, margin: 16, borderRadius: 12 }} onPress={() => navigation.navigate('Create')}>",
    "        <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>+ Nouveau</Text>",
    "      </TouchableOpacity>",
    "      <FlatList",
    "        data={items}",
    "        keyExtractor={(item) => item._id || item.id}",
    "        renderItem={({ item }) => (",
    "          <TouchableOpacity",
    "            style={{ backgroundColor: '#fff', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12 }}",
    "            onPress={() => navigation.navigate('Edit', { id: item._id || item.id, api })}",
    "          >",
    "            <Text style={{ fontWeight: '600' }}>{item.name || item.title || item.email || item._id}</Text>",
    "          </TouchableOpacity>",
    "        )}",
    "      />",
    "    </View>",
    "  );",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/screens/CreateScreen.js'), [
    "/**",
    " * Écran de création CRUD React Native",
    " */",
    "import React, { useState } from 'react';",
    "import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';",
    "",
    "export default function CreateScreen({ navigation, api }) {",
    "  const [formData, setFormData] = useState({});",
    "  const fields = ['name', 'title', 'description', 'status'];",
    "",
    "  const handleSubmit = async () => {",
    "    try {",
    "      await api.create(formData);",
    "      navigation.goBack();",
    "    } catch (err) {",
    "      Alert.alert('Erreur', err.response?.data?.message || 'Echec');",
    "    }",
    "  };",
    "",
    "  return (",
    "    <ScrollView style={{ flex: 1, backgroundColor: '#f0f2f5', padding: 16 }}>",
    "      {fields.map((field) => (",
    "        <View key={field} style={{ marginBottom: 16 }}>",
    "          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>{field}</Text>",
    "          <TextInput",
    "            style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14 }}",
    "            value={formData[field] || ''}",
    "            onChangeText={(text) => setFormData({ ...formData, [field]: text })}",
    "          />",
    "        </View>",
    "      ))}",
    "      <TouchableOpacity style={{ backgroundColor: '#3182ce', borderRadius: 12, padding: 16, alignItems: 'center' }} onPress={handleSubmit}>",
    "        <Text style={{ color: '#fff', fontWeight: '700' }}>Créer</Text>",
    "      </TouchableOpacity>",
    "    </ScrollView>",
    "  );",
    "}",
  ].join('\n'), vars);

  writeTemplate(dir('src/screens/EditScreen.js'), [
    "/**",
    " * Écran d'édition CRUD React Native",
    " */",
    "import React, { useState, useEffect } from 'react';",
    "import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';",
    "",
    "export default function EditScreen({ route, navigation, api }) {",
    "  const { id } = route.params;",
    "  const [formData, setFormData] = useState({});",
    "  const [isLoading, setIsLoading] = useState(true);",
    "  const fields = ['name', 'title', 'description', 'status'];",
    "",
    "  useEffect(() => {",
    "    api.get(id)",
    "      .then((response) => {",
    "        const data = response.data || response;",
    "        const cleanData = {};",
    "        fields.forEach((f) => { cleanData[f] = data[f] || ''; });",
    "        setFormData(cleanData);",
    "      })",
    "      .finally(() => setIsLoading(false));",
    "  }, [id]);",
    "",
    "  const handleSubmit = async () => {",
    "    try {",
    "      await api.update(id, formData);",
    "      navigation.goBack();",
    "    } catch (err) {",
    "      Alert.alert('Erreur', err.response?.data?.message);",
    "    }",
    "  };",
    "",
    "  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color=\"#3182ce\" />;",
    "",
    "  return (",
    "    <ScrollView style={{ flex: 1, backgroundColor: '#f0f2f5', padding: 16 }}>",
    "      {fields.map((field) => (",
    "        <View key={field} style={{ marginBottom: 16 }}>",
    "          <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 6 }}>{field}</Text>",
    "          <TextInput",
    "            style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: '#e2e8f0', borderRadius: 12, padding: 14 }}",
    "            value={formData[field]}",
    "            onChangeText={(text) => setFormData({ ...formData, [field]: text })}",
    "          />",
    "        </View>",
    "      ))}",
    "      <TouchableOpacity style={{ backgroundColor: '#3182ce', borderRadius: 12, padding: 16, alignItems: 'center' }} onPress={handleSubmit}>",
    "        <Text style={{ color: '#fff', fontWeight: '700' }}>Enregistrer</Text>",
    "      </TouchableOpacity>",
    "    </ScrollView>",
    "  );",
    "}",
  ].join('\n'), vars);

  console.log('  ✓ Projet React Native créé dans ' + outputDir);
};

// ╔══════════════════════════════════════════════════════════════╗
// ║  CLI PRINCIPAL                                              ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * Parse les arguments CLI pour le mode non-interactif
 * @returns {object|null} { app, feature, stack, all, role } ou null
 */
const parseCliArgs = () => {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : null;
  };
  const app = get('--app');
  const feature = get('--feature');
  const stack = get('--stack');
  const role = get('--role');
  const all = args.includes('--all');
  if (app && stack && (feature || all)) {
    return { app, feature: all ? 'all' : feature, stack, all, role: role || 'admin' };
  }
  return null;
};

const main = async () => {
  // ── Bannière ──
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     DRY Frontend Generator v2.0                 ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  const cliArgs = parseCliArgs();

  let appName, feature, stackKey, allFeatures = [];

  if (cliArgs) {
    // ── Mode non-interactif ──
    appName = cliArgs.app;
    stackKey = cliArgs.stack;

    if (cliArgs.all) {
      allFeatures = getAppFeatures(appName);
      console.log('Mode non-interactif (ALL features):');
      console.log('  App:     ' + appName);
      console.log('  Stack:   ' + (TEMPLATES[stackKey]?.name || stackKey));
      console.log('  Role:    ' + (cliArgs.role || 'admin'));
      console.log('  Toutes les features (' + allFeatures.length + ') : ' + allFeatures.map(f => f.label).join(', '));
    } else {
      const features = getAppFeatures(appName);
      feature = features.find((f) => f.route === cliArgs.feature);
      if (!feature) {
        console.log('Erreur: Feature "' + cliArgs.feature + '" introuvable pour ' + appName);
        rl.close();
        return;
      }
      console.log('Mode non-interactif:');
      console.log('  App:     ' + appName);
      console.log('  Feature: ' + feature.label);
      console.log('  Stack:   ' + (TEMPLATES[stackKey]?.name || stackKey));
      console.log('  Role:    ' + (cliArgs.role || 'admin'));
    }
    var selectedRole = cliArgs.role || 'admin';
  } else {
    // ── Mode interactif ──
    const apps = getAvailableApps();
    if (!apps.length) {
      console.log('Aucune application trouvée dans dryApp/');
      rl.close();
      return;
    }

    console.log('Applications disponibles :');
    apps.forEach((name, index) => {
      const f = getAppFeatures(name);
      console.log('  ' + (index + 1) + '. ' + name + ' (' + f.length + ' features)');
    });

    const appChoice = await ask('\nChoisissez une application (numéro) : ');
    appName = apps[parseInt(appChoice) - 1];
    if (!appName) { console.log('Choix invalide'); rl.close(); return; }

    const features = getAppFeatures(appName);
    console.log('\nFeatures de ' + appName + ' :');
    console.log('  0. TOUTES LES FEATURES (' + features.length + ')');
    features.forEach((f, index) => {
      console.log('  ' + (index + 1) + '. ' + f.label + ' → /' + f.route);
    });

    const featChoice = await ask('\nChoisissez une feature (0 = toutes, numéro) : ');
    if (featChoice === '0') {
      allFeatures = features;
      console.log('\n✓ Mode multi-features activé !');
    } else {
      feature = features[parseInt(featChoice) - 1];
      if (!feature) { console.log('Choix invalide'); rl.close(); return; }
    }

    console.log('\nStack frontend :');
    const stackEntries = Object.entries(TEMPLATES);
    stackEntries.forEach(([key, value], index) => {
      console.log('  ' + (index + 1) + '. ' + value.name);
    });

    const stackChoice = await ask('\nChoisissez une stack (numéro) : ');
    stackKey = Object.keys(TEMPLATES)[parseInt(stackChoice) - 1];
    if (!stackKey || !TEMPLATES[stackKey]) { console.log('Choix invalide'); rl.close(); return; }

    console.log('\nRôle :');
    console.log('  1. Admin (accès complet, gestion)');
    console.log('  2. Client (lecture, création limitée)');
    const roleChoice = await ask('\nChoisissez un rôle (numéro, défaut: 1) : ');
    var selectedRole = roleChoice === '2' ? 'client' : 'admin';
  }

  // ── Rôle final ──
  const userRole = selectedRole || 'admin';

  // ── Génération ──
  const outputDir = path.join(__dirname, '../../frontend', stackKey, appName);
  fs.mkdirSync(outputDir, { recursive: true });

  if (allFeatures.length > 0) {
    console.log('');
    console.log('Génération du projet MULTI-FEATURES ' + TEMPLATES[stackKey].name + '...');
    console.log('  App cible :     ' + appName);
    console.log('  Features :      ' + allFeatures.length + ' (' + allFeatures.map(f => f.label).join(', ') + ')');
    console.log('  Dossier :       ' + outputDir);
    console.log('');

    if (stackKey === 'react') generateReactAll(outputDir, appName, allFeatures, userRole);
    else {
      // Pour Angular/RN, on prend la première feature avec un message
      console.log('  Note: Le mode multi-features est optimisé pour React. Génération avec la première feature ' + allFeatures[0].label);
      if (stackKey === 'angular') generateAngular(outputDir, appName, allFeatures[0]);
      else if (stackKey === 'react-native') generateReactNative(outputDir, appName, allFeatures[0]);
    }
  } else {
    console.log('');
    console.log('Génération du projet ' + TEMPLATES[stackKey].name + '...');
    console.log('  App cible :     ' + appName);
    console.log('  Feature cible : ' + feature.label + ' (/' + feature.route + ')');
    console.log('  Dossier :       ' + outputDir);
    console.log('');

    if (stackKey === 'react') generateReact(outputDir, appName, feature, userRole);
    else if (stackKey === 'angular') generateAngular(outputDir, appName, feature);
    else if (stackKey === 'react-native') generateReactNative(outputDir, appName, feature);
  }

  // ── Copie des composants DRY UI ──
  if (stackKey === 'react') {
    copyDryUI(outputDir);
  }

  console.log('');
  console.log('Projet généré avec succès !');
  console.log('');
  console.log('Rôle configuré : ' + userRole);
  console.log('Composants DRY UI : ' + (stackKey === 'react' ? 'copiés dans src/components/dry-ui/' : 'N/A (stack non-React)'));
  console.log('');
  console.log('Pour installer les dépendances :');
  console.log('  cd ' + outputDir);
  console.log('  npm install');
  console.log('');
  console.log('Pour lancer le projet :');
  if (stackKey === 'react') console.log('  npm run dev');
  else if (stackKey === 'angular') console.log('  ng serve --proxy-config proxy.conf.json');
  else if (stackKey === 'react-native') console.log('  npx expo start');

  rl.close();
};

main().catch((error) => {
  console.error('Erreur :', error.message);
  rl.close();
});
