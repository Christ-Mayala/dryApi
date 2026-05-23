# Diagrammes de la plateforme SCIM

---

## 📥 Comment télécharger les diagrammes

### Méthode 1 : Avec mermaid.live (recommandée)
1. Allez sur [https://mermaid.live/](https://mermaid.live/)
2. Copiez le code Mermaid d'un diagramme
3. Collez-le dans l'éditeur
4. Cliquez sur **Actions** → **Download PNG** ou **Download SVG**

### Méthode 2 : Avec l'extension VS Code
1. Ouvrez le fichier `SCIM_DIAGRAMMES.md`
2. Faites un clic droit sur le diagramme
3. Choisissez **"Open Preview"** ou **"Mermaid: Preview"**
4. Faites une capture d'écran ou utilisez l'option d'export de l'extension

---

## 1. Diagramme d'architecture globale

```mermaid
---
id: 87d7f01d-4c64-406a-a410-260570e043e2
---
graph TB
    subgraph "Couche Présentation"
        Navigateur[Navigateur Client]
    end
    
    subgraph "Couche Frontend"
        Frontend[React + Vite + Tailwind CSS]
    end
    
    subgraph "Couche Backend"
        Backend[Node.js + Express.js]
        Socket[Socket.io]
    end
    
    subgraph "Couche Données"
        MongoDB[(MongoDB Atlas)]
    end
    
    subgraph "Services Externes"
        Cloudinary[Cloudinary]
    end
    
    Navigateur -->|HTTP/HTTPS| Frontend
    Frontend -->|API REST| Backend
    Backend -->|Communication directe| MongoDB
    Backend -->|Notifications temps réel| Socket
    Backend -->|Upload médias| Cloudinary
    Socket -->|Notification temps réel| Frontend
```

---

## 2. Diagramme de cas d'utilisation global

```mermaid
---
id: 724399f0-f2cd-47b5-b007-9e4b4eb1105f
---
graph LR
    subgraph Acteurs
        Client[Client]
        Agent[Agent/Administrateur]
    end
    
    subgraph "Fonctionnalités Client"
        UC1(Consulter les biens)
        UC2(Rechercher avec filtres)
        UC3(Effectuer une réservation)
        UC4(Suivre ses demandes)
        UC5(Gérer ses favoris)
    end
    
    subgraph "Fonctionnalités Agent/Admin"
        UC6(Gérer les biens immobiliers)
        UC7(Traiter les réservations)
        UC8(Gérer les utilisateurs)
        UC9(Consulter le tableau de bord)
        UC10(Superviser le système)
    end
    
    Client --- UC1
    Client --- UC2
    Client --- UC3
    Client --- UC4
    Client --- UC5
    
    Agent --- UC6
    Agent --- UC7
    Agent --- UC8
    Agent --- UC9
    Agent --- UC10
    
    style Client fill:#4ade80,stroke:#22c55e
    style Agent fill:#60a5fa,stroke:#3b82f6
```

---

## 3. Diagramme de séquence - Processus de réservation

```mermaid
---
id: 4df92f18-912d-454c-aacc-b01dbd4fc90b
---
sequenceDiagram
    participant Client as Client
    participant Frontend as Frontend (React)
    participant Backend as Backend (Node.js/Express)
    participant MongoDB as MongoDB
    participant Agent as Agent

    Client->>Frontend: Soumission du formulaire
    Frontend->>Backend: POST /api/reservations
    Backend->>Backend: Vérification authentification JWT
    Backend->>MongoDB: Enregistrement de la réservation
    MongoDB-->>Backend: Confirmation enregistrement
    Backend->>Backend: Génération référence RSV-XXXX
    Backend->>Client: Confirmation (via Socket.io)
    Backend->>Agent: Notification (via Socket.io)
    Agent->>Backend: Changement de statut
    Backend->>MongoDB: Mise à jour statut
    Backend->>Client: Notification de mise à jour
```

---

## 4. Diagramme de séquence - Upload d'image

```mermaid
sequenceDiagram
    participant Agent as Agent
    participant Frontend as Frontend
    participant Cloudinary as Cloudinary
    participant Backend as Backend
    participant MongoDB as MongoDB
    participant Clients as Clients

    Agent->>Frontend: Sélection et upload d'image
    Frontend->>Cloudinary: Envoi du fichier
    Cloudinary-->>Frontend: URL de l'image optimisée
    Frontend->>Backend: Envoi des données du bien
    Backend->>MongoDB: Sauvegarde du bien
    MongoDB-->>Backend: Confirmation
    Backend->>Clients: Diffusion mise à jour catalogue (via Socket.io)
```

---

## 5. Diagramme de classes de la base de données MongoDB

```mermaid
erDiagram
    USER ||--o{ RESERVATION : "a plusieurs"
    USER ||--o{ FAVORITE : "a plusieurs"
    PROPERTY ||--o{ RESERVATION : "a plusieurs"
    PROPERTY ||--o{ FAVORITE : "est dans plusieurs"

    USER {
        ObjectId _id
        String nom
        String prenom
        String email "unique"
        String password "hashé"
        String role "client/agent/admin"
        String telephone
        Date createdAt
    }

    PROPERTY {
        ObjectId _id
        String titre
        String description
        Number prix
        Object localisation "adresse, coordonnées"
        String type "appartement/maison/terrain"
        String statut "disponible/réservé/vendu"
        Array images "URLs Cloudinary"
        Object caractéristiques "surface, pièces, chambres"
        ObjectId createdBy "→ User"
    }

    RESERVATION {
        ObjectId _id
        String reference "RSV-XXXX"
        ObjectId client "→ User"
        ObjectId property "→ Property"
        Date dateDebut
        Date dateFin
        String statut "en attente/confirmée/annulée"
        Array historique "suivi des changements"
        Date createdAt
    }

    FAVORITE {
        ObjectId _id
        ObjectId client "→ User"
        ObjectId property "→ Property"
        Date createdAt
    }
```

---

## 6. Diagramme d'activité - Parcours croisés client et agent

```mermaid
graph TB
    subgraph "Parcours Client"
        C_Début[Début]
        C_Consultation[Consultation catalogue]
        C_Filtres[Utilisation filtres]
        C_Détail[Accès fiche détaillée]
        C_Favoris[Ajout favoris]
        C_Réservation[Soumission réservation]
        C_Attente[Attente validation]
        C_Notification[Réception notification]
        C_Fin[Fin]
        
        C_Début --> C_Consultation
        C_Consultation --> C_Filtres
        C_Filtres --> C_Détail
        C_Détail --> C_Favoris
        C_Favoris --> C_Réservation
        C_Réservation --> C_Attente
        C_Attente --> C_Notification
        C_Notification --> C_Fin
    end
    
    subgraph "Parcours Agent"
        A_Début[Début]
        A_Connexion[Connexion tableau de bord]
        A_Consultation[Consultation demandes en attente]
        A_Vérification[Vérification disponibilité]
        A_Décision{Validation ou rejet}
        A_Valide[Confirmation]
        A_Rejet[Annulation avec motif]
        A_NotifClient[Notification client]
        A_MiseAJour[Mise à jour statut]
        A_Fin[Fin]
        
        A_Début --> A_Connexion
        A_Connexion --> A_Consultation
        A_Consultation --> A_Vérification
        A_Vérification --> A_Décision
        A_Décision -->|Valide| A_Valide
        A_Décision -->|Rejette| A_Rejet
        A_Valide --> A_NotifClient
        A_Rejet --> A_NotifClient
        A_NotifClient --> A_MiseAJour
        A_MiseAJour --> A_Fin
    end
    
    C_Réservation -.->|Point de synchronisation| A_Consultation
    A_NotifClient -.->|Point de synchronisation| C_Notification
```

---

## 7. Diagramme d'activité - Processus de création de réservation détaillé

```mermaid
flowchart TD
    Start[Début]
    RemplirFormulaire[Client remplit formulaire]
    VérifierDisponibilité[Système vérifie disponibilité]
    DécisionDispo{Disponible ?}
    Enregistrement[Enregistrement demande]
    Suggestion[Suggestion alternatives]
    GénérationRéférence[Génération référence RSV-XXXX]
    NotificationAgent[Notification agent]
    AgentAnalyse[Agent analyse demande]
    DécisionValide{Valide ?}
    Confirmation[Confirmation]
    Annulation[Annulation avec motif]
    NotificationClient[Notification client]
    Fin[Fin]

    Start --> RemplirFormulaire
    RemplirFormulaire --> VérifierDisponibilité
    VérifierDisponibilité --> DécisionDispo
    DécisionDispo -->|Oui| Enregistrement
    DécisionDispo -->|Non| Suggestion
    Suggestion --> RemplirFormulaire
    Enregistrement --> GénérationRéférence
    GénérationRéférence --> NotificationAgent
    NotificationAgent --> AgentAnalyse
    AgentAnalyse --> DécisionValide
    DécisionValide -->|Oui| Confirmation
    DécisionValide -->|Non| Annulation
    Confirmation --> NotificationClient
    Annulation --> NotificationClient
    NotificationClient --> Fin
```

---

## 8. Diagramme de séquence - Flux de notification temps réel via Socket.io

```mermaid
sequenceDiagram
    participant Agent as Agent
    participant Backend as Backend (Node.js + Socket.io)
    participant MongoDB as MongoDB
    participant SocketRoom as "Socket.io Room (userId)"
    participant Client as Client

    Agent->>Backend: PUT /api/reservations/:id (changement statut)
    Backend->>MongoDB: Mise à jour
    MongoDB-->>Backend: Confirmation
    Backend->>Backend: io.to(clientId).emit('reservationUpdated')
    Backend->>SocketRoom: Événement reservationUpdated
    SocketRoom->>Client: Notification en temps réel
    Client->>Client: Mise à jour interface sans rechargement
```

---

## 9. Diagramme d'évolution (cas d'utilisation étendu)

```mermaid
graph LR
    subgraph Acteurs
        Client[Client]
        Agent[Agent/Administrateur]
        Partenaire[Partenaires financiers]
        Agence[Autres agences immobilières]
    end
    
    subgraph "Évolutions futures"
        UC11(Paiement en ligne)
        UC12(Application mobile native)
        UC13(Système de recommandation IA)
        UC14(Mode hors ligne)
        UC15(Module multi-tenant)
        UC16(Connecteurs sites externes)
        UC17(Interface solutions comptables)
        UC18(Estimation automatisée)
    end
    
    Client --- UC11
    Client --- UC12
    Client --- UC13
    Client --- UC14
    
    Agent --- UC15
    Agent --- UC16
    Agent --- UC17
    Agent --- UC18
    
    Partenaire --- UC11
    Agence --- UC15
    Agence --- UC16
    
    style Client fill:#4ade80,stroke:#22c55e
    style Agent fill:#60a5fa,stroke:#3b82f6
    style Partenaire fill:#f472b6,stroke:#ec4899
    style Agence fill:#fbbf24,stroke:#f59e0b
```
