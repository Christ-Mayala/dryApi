# ============================================================
# Dockerfile — DRY API Framework
# Build multi-stage optimisé pour la production
# ============================================================

# ------------------------------
# Étape 1: Installation des dépendances
# ------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json package-lock.json ./

# Installer toutes les dépendances (dev + production)
RUN npm ci --ignore-scripts

# ------------------------------
# Étape 2: Build et tests
# ------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les dépendances depuis l'étape 1
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY . .

# Exécuter les tests (optionnel, peut être commenté en CI)
# RUN npm run test:unit || true

# Nettoyer les fichiers inutiles en production
RUN rm -rf tests/ scripts/generator/ docs/tutorials/

# ------------------------------
# Étape 3: Image de production
# ------------------------------
FROM node:20-alpine AS runner

RUN apk add --no-cache wget ca-certificates

WORKDIR /app

# Éviter de tourner en root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 dryapi

# Copier uniquement les dépendances de production
COPY --from=builder /app/node_modules ./node_modules

# Copier le code source (filtré)
COPY --from=builder /app ./

# Créer les dossiers nécessaires avec les bonnes permissions
RUN mkdir -p logs uploads downloads backups && \
    chown -R dryapi:nodejs /app

# Exposition du port
EXPOSE 5000

# Health check utilisant Node.js (wget peut ne pas être disponible)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/health/live', (r) => {process.exit(r.statusCode !== 200 ? 1 : 0)}).on('error', () => process.exit(1))"

# Basculer vers l'utilisateur non-root
USER dryapi

# Variables d'environnement par défaut
ENV NODE_ENV=production \
    PORT=5000

# Démarrer l'application
CMD ["node", "server.js"]
