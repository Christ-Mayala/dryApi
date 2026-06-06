# Accord de Niveau de Service (SLA)

Version 1.0 — En vigueur à partir du 6 juin 2026

---

## 1. Garantie de Disponibilité

| Niveau | Disponibilité | Downtime Max/Mois | Crédit |
|--------|--------------|-------------------|--------|
| Enterprise | **99.9%** | 4.38 heures | Jusqu'à 50% |
| Pro | **99.5%** | 21.6 heures | Jusqu'à 25% |
| Community | Meilleur effort | N/A | N/A |

**Mesure:** La disponibilité est calculée mensuellement comme :
```
Disponibilité = (Temps total - Temps d'indisponibilité) / Temps total × 100
```

**Exclusions:**
- Maintenance planifiée (préavis 48h)
- Défaillances de services tiers (AWS, MongoDB Atlas, etc.)
- Attaques par déni de service (DoS/DDoS)
- Force majeure
- Mauvaise configuration par le client

---

## 2. Temps de Réponse Support

| Sévérité | Définition | Temps de Réponse | Mise à Jour |
|----------|-----------|-----------------|-------------|
| **S1 - Critique** | API indisponible, perte de données | **1 heure** | Toutes les 2 heures |
| **S2 - Haute** | Fonctionnalité majeure dégradée | **4 heures** | Quotidienne |
| **S3 - Moyenne** | Bug non-bloquant, fonctionnalité mineure | **24 heures** | Hebdomadaire |
| **S4 - Basse** | Question, suggestion, documentation | **48 heures** | Mensuelle |

### Canaux de Support

| Canal | Disponibilité | Délai |
|-------|--------------|-------|
| **Email** | 24/7 | < 1 heure (S1) |
| **GitHub Issues** | Heures ouvrées | < 24 heures |
| **Dashboard** | 24/7 | Temps réel |

---

## 3. Réponse aux Incidents

### Détection
- **Automatique:** Monitoring Prometheus (intervalle 30s)
- **Temps de détection:** < 5 minutes
- **Notification:** Email, Slack, Discord selon configuration

### Évaluation
- **Temps d'évaluation:** < 15 minutes
- **Sévérité assignée:** Basée sur l'impact
- **Équipe notifiée:** Automatiquement

### Résolution
- **S1 Critique:** 4 heures
- **S2 Haute:** 8 heures
- **S3 Moyenne:** 48 heures
- **S4 Basse:** 5 jours ouvrés

### Communication
- Mises à jour sur le dashboard `/system/status` du serveur
- Résumé post-incident pour les incidents S1/S2
- Rapport mensuel de disponibilité

---

## 4. Sauvegarde et Récupération

| Métrique | Objectif | Description |
|----------|----------|-------------|
| **RPO** | 1 heure | Perte de données maximale acceptable |
| **RTO** | 4 heures | Temps de récupération maximal |
| **Fréquence** | Quotidienne | Sauvegarde complète |
| **Rétention** | 30 jours | Conservation des backups |
| **Type** | MongoDB Archive | Dump compressé gzip |

### Procédure de Restauration

1. **Identifier le backup:** Date/heure du point de restauration
2. **Restaurer:**
   ```bash
   mongorestore --uri="<MONGO_URI>" --archive=<fichier>.gz --gzip
   ```
3. **Vérifier:** Lancer les health checks
4. **Valider:** Tests d'intégrité des données

---

## 5. Crédits SLA

Si la disponibilité garantie n'est pas atteinte :

| Disponibilité | Crédit (Pro) | Crédit (Enterprise) |
|--------------|-------------|-------------------|
| 99.0% - 99.89% | 10% | 15% |
| 98.0% - 98.99% | 25% | 30% |
| < 98% | 50% | 50% |

**Modalités:**
- Crédit applicable sur la facture du mois suivant
- Maximum 50% du montant mensuel
- Demande par email dans les 30 jours
- Justificatif: rapport de disponibilité fourni

---

## 6. Maintenance Planifiée

- Notification minimale: **48 heures**
- Durée maximale: **4 heures**
- Fenêtre: **2h00 - 6h00 (UTC+1)**
- Calendrier: Consulter le dashboard `/system/status`
- Les maintenances planifiées sont exclues du calcul de disponibilité

---

## 7. Exclusions et Limitations

Ne sont pas couverts par ce SLA :
- Versions beta/early access
- Features marquées "experimental"
- Problèmes liés à l'infrastructure du client
- Modifications non-autorisées de l'API
- Dépassement des limites de taux
- Utilisation abusive de l'API

---

**Contact SLA:** cybertouch2012@gmail.com
**Statut:** Dashboard système: `/system/status`
**Version:** 1.0 — Juin 2026
