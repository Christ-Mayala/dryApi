# Guide de Dépannage

Solutions aux problèmes courants rencontrés avec l'API DRY.

---

## Problèmes de Connexion

### Q: La connexion MongoDB échoue

**Symptômes:**

- Erreur `MongoServerSelectionError` au démarrage
- Health check `/health/ready` retourne `NOT_READY`
- Logs: `Connexion MongoDB impossible`

**Causes possibles et solutions:**

| Cause               | Solution                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| MongoDB non démarré | `sudo systemctl start mongod` ou `brew services start mongodb-community` |
| URI incorrecte      | Vérifier `MONGO_URI` dans `.env`                                         |
| Firewall bloque     | Vérifier que le port 27017 est accessible                                |
| Auth échouée        | Vérifier user/password dans l'URI                                        |
| Atlas whitelist IP  | Ajouter l'IP actuelle dans Atlas Network Access                          |

**Vérification rapide:**

```bash
# Tester la connexion
mongosh "mongodb://localhost:27017/dryapi" --eval "db.runCommand({ping:1})"

# Vérifier le health
curl http://localhost:5000/health/ready
```

---

### Q: Redis ne répond pas

**Symptômes:**

- Cache non fonctionnel
- Rate limiting désactivé
- Logs: `Redis connection refused`

**Solutions:**

```bash
# Vérifier si Redis tourne
redis-cli ping  # Doit retourner PONG

# Démarrer Redis
redis-server --daemonize yes

# Ou utiliser Docker
docker run -d -p 6379:6379 redis:alpine
```

**Note:** Redis est optionnel. Sans Redis, le système utilise des fallbacks mémoire.

---

## Problèmes d'Authentification

### Q: Erreur "Non autorisé" malgré un token valide

**Causes possibles:**

1. **JWT_SECRET changé** → Les anciens tokens sont invalides
2. **Token expiré** → Vérifier `JWT_EXPIRE` dans `.env`
3. **Mauvais header** → Doit être `Authorization: Bearer <token>`
4. **Compte désactivé** → Vérifier le statut du compte

**Vérifications:**

```bash
# Décoder le token (sans vérifier la signature)
echo "<token>" | cut -d'.' -f2 | base64 -d 2>/dev/null || echo "Token invalide"

# Vérifier l'expiration
curl -I http://localhost:5000/api/v1/scim/auth/profile \
  -H "Authorization: Bearer <token>"
```

---

### Q: /system/status refuse le mot de passe alors qu'il est correct

**Symptômes:** Le formulaire de connexion du dashboard système
(`/system/status`) renvoie toujours "Mot de passe requis" même en
tapant le bon mot de passe.

**Cause fréquente:** si `SYSTEM_PASSWORD` dans `.env` contient un `#`
et n'est **pas** entre guillemets, `dotenv` traite tout ce qui suit le
`#` comme un commentaire et tronque silencieusement la valeur — le mot
de passe réellement chargé en mémoire est plus court que celui écrit
dans le fichier, donc rien ne matche jamais.

**Solution:** entourer la valeur de guillemets dans `.env` :

```bash
SYSTEM_PASSWORD="Mon#MotDePasse2026"
```

**Vérification rapide** (sans jamais afficher le mot de passe en clair) :

```bash
node -e "require('dotenv').config(); console.log('longueur chargée:', process.env.SYSTEM_PASSWORD.length)"
```

Comparez avec la longueur réelle de votre mot de passe — si c'est plus court, c'est ce problème.

---

### Q: Rate limiting bloque mes requêtes

**Symptômes:** Réponse 429 avec headers `X-RateLimit-*`

**Solutions:**

1. Vérifier les headers `X-RateLimit-Remaining` pour savoir combien reste
2. Attendre le temps indiqué par `X-RateLimit-Reset`
3. Demander une clé API pour augmenter les limites
4. Vérifier que vous utilisez bien le header `Authorization`

**Commandes:**

```bash
# Voir les headers de rate limiting
curl -s -D - http://localhost:5000/api/v1/scim/property -o /dev/null | grep -i ratelimit

# Voir le temps restant avant reset
curl -s http://localhost:5000/api/v1/scim/property | jq '.'
```

---

## Problèmes d'Isolation Multi-Tenant

### Q: Un utilisateur voit les données d'un autre

**Vérifications:**

1. Le middleware `protect` est-il bien appliqué à la route ?
2. La requête MongoDB filtre-t-elle bien par `userId` ?
3. Le `req.user` est-il correctement défini ?

**Correctif typique:**

```javascript
// Dans le controller, toujours filtrer par userId
const data = await Model.find({ userId: req.user._id });
// PAS: const data = await Model.find({});
```

---

## Problèmes de Performance

### Q: L'API répond lentement

**Diagnostic:**

```bash
# Voir les logs de requêtes lentes (npm run logs, ou directement :)
tail -f logs/info.log logs/error.log | grep "Requête lente"

# Vérifier les métriques Prometheus
curl http://localhost:5000/metrics | grep dry_http_request_duration

# Vérifier l'utilisation mémoire
curl http://localhost:5000/health/ready | jq '.checks.memory'
```

**Solutions courantes:**
| Cause | Solution |
|-------|----------|
| Requêtes DB lentes | Vérifier les index MongoDB |
| Cache désactivé | Activer Redis et le cache middleware |
| Trop de données | Paginer les résultats (query params `page`, `limit`) |
| Payload volumineux | Limiter les champs retournés |
| N+1 queries | Utiliser `.populate()` ou agrégations |

---

## Problèmes de Déploiement

### Q: Docker build échoue

**Solutions:**

```bash
# Nettoyer le cache Docker
docker builder prune -a
docker system prune -a

# Vérifier le Dockerfile
docker build --no-cache -t dryapi:test .

# Vérifier les logs de build
docker build -t dryapi:test . 2>&1 | tee build.log
```

### Q: Kubernetes pod crash en boucle (CrashLoopBackOff)

**Vérifications:**

```bash
# Voir les logs du pod
kubectl logs -n dryapi deployment/dry-api

# Vérifier les events
kubectl describe pod -n dryapi <pod-name>

# Vérifier les probes
kubectl get events -n dryapi --sort-by='.lastTimestamp'
```

---

## Problèmes de Validation

### Q: Erreur "ValidationError" pour des données valides

**Causes:**

1. **Schéma Zod/Joi différent** entre la doc et le code
2. **Types incorrects** (nombre au lieu de string)
3. **Champs obligatoires** manquants
4. **Format** attendu vs fourni

**Debug:**

```javascript
// Logger les données reçues
console.log('Body reçu:', JSON.stringify(req.body, null, 2));
console.log('Schéma attendu:', schema.describe());
```

---

## Problèmes de Logging

### Q: Les logs ne s'affichent pas

**Vérifications:**

```bash
# Vérifier le niveau de log
echo $LOG_LEVEL  # Doit être 'debug' pour voir tous les logs

# Vérifier les fichiers de log
ls -la logs/
cat logs/error-$(date +%Y-%m-%d).log | head -50

# Vérifier que le dossier logs existe
ls -d logs/ || mkdir logs/
```

---

## Commandes de Diagnostic Rapide

```bash
# Health check complet
curl -s http://localhost:5000/health | jq .

# Métriques Prometheus
curl -s http://localhost:5000/metrics | head -50

# Voir les endpoints disponibles
curl -s http://localhost:5000/api-docs/json | jq '.paths | keys'

# Tester l'auth
curl -s -X POST http://localhost:5000/api/v1/scim/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dry.local","password":"ChangeMe123!"}' | jq .

# Vérifier la version API
curl -s -D - http://localhost:5000/api/v1/scim/property -o /dev/null | grep -i api-version
```

---

## Support

Si vous ne trouvez pas de solution :

- **Email:** cybertouch2012@gmail.com
- **GitHub Issues:** Signaler un bug
- **Docs API:** http://localhost:5000/api-docs
