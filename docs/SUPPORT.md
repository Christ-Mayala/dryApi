# Guide de Support

Processus de support client, canaux de communication et procédures d'escalade.

---

## 1. Canaux de Support

| Canal | Adresse | Utilisation |
|-------|---------|-------------|
| **Email** | cybertouch2012@gmail.com | Support principal |
| **GitHub Issues** | https://github.com/cybertouch/dryapi/issues | Bugs et feature requests |
| **Dashboard** | `/system/status` | Monitoring en temps réel |

---

## 2. Horaires de Disponibilité

| Plan | Disponibilité | Temps de Réponse |
|------|--------------|-----------------|
| **Enterprise** | 24/7 | < 1 heure (S1) |
| **Pro** | Heures ouvrées (8h-18h UTC+1) | < 4 heures |
| **Community** | Meilleur effort | < 48 heures |

---

## 3. Processus de Triage

### Étape 1: Réception
- Accusé de réception automatique sous 1 heure
- Assignation de l'ID de ticket
- Classification de la sévérité

### Étape 2: Analyse
```
Réception → Classification → Assignation → Analyse → Résolution → Feedback
```

### Étape 3: Suivi
- Mises à jour selon la sévérité
- Validation client avant fermeture
- Documentation des solutions

---

## 4. Classification des Problèmes

### Sévérité 1 — Critique 🔴
**Définition:** API indisponible, perte de données, faille de sécurité
**Action immédiate:** Équipe technique notifiée, hotfix en cours
**Mise à jour:** Toutes les 2 heures
**Exemples:**
- Erreur 500 sur toutes les requêtes
- Base de données inaccessible
- Faille de sécurité active

### Sévérité 2 — Haute 🟠
**Définition:** Fonctionnalité majeure dégradée mais contour possible
**Action:** Correctif planifié dans les 24h
**Mise à jour:** Quotidienne
**Exemples:**
- Recherche non fonctionnelle
- Upload d'images échoué
- Authentification intermittente

### Sévérité 3 — Moyenne 🟡
**Définition:** Bug non-bloquant, fonctionnalité mineure
**Action:** Correctif planifié dans la prochaine release
**Mise à jour:** Hebdomadaire
**Exemples:**
- Message d'erreur peu clair
- Performance dégradée sur certains endpoints
- Bug d'affichage dans le swagger

### Sévérité 4 — Basse 🟢
**Définition:** Question, suggestion, documentation
**Action:** Réponse dans les 48h
**Mise à jour:** Mensuelle
**Exemples:**
- Demande de documentation
- Suggestion d'amélioration
- Question d'utilisation

---

## 5. Processus d'Escalade

### Niveau 1 — Support Technique
- Traite les problèmes courants
- Temps de résolution: < 4h (S1)
- Escalade si non résolu après 2h (S1)

### Niveau 2 — Développeur Senior
- Problèmes complexes nécessitant analyse du code
- Temps de résolution: < 8h (S1)
- Escalade si non résolu après 4h (S1)

### Niveau 3 — Architecture / DevOps
- Problèmes d'infrastructure, performance, sécurité
- Temps de résolution: < 24h (S1)
- Décision finale

```
Client → Niveau 1 (Support) → Niveau 2 (Dev Senior) → Niveau 3 (Architecture)
```

---

## 6. Communication

### Template de Rapport de Bug
```markdown
**Description:** [Description claire du problème]
**Endpoints concernés:** [URLs des endpoints]
**Étapes pour reproduire:**
1. [Étape 1]
2. [Étape 2]
3. [Étape 3]

**Comportement attendu:** [Ce qui devrait se passer]
**Comportement actuel:** [Ce qui se passe]
**Environnement:**
- Navigateur/Client: [Chrome/Firefox/curl]
- OS: [Windows/Mac/Linux]
- Token: [Oui/Non]
**Logs/X-Request-ID:** [req-abc-123]
```

---

## 7. Sauvegarde et Continuité

En cas d'incident critique :
1. **Communication:** Notification via email
2. **Restauration:** Procédure de restauration (voir docs/DEPLOYMENT.md)
3. **Post-mortem:** Analyse des causes racines dans les 48h
4. **Prévention:** Mise en place des correctifs

---

**Contact:** cybertouch2012@gmail.com
**Statut:** Voir `/system/status` pour l'état en temps réel du serveur
