# Client SkillForge pour Angular

Ce dossier contient le client API généré automatiquement pour l'application **SkillForge**.

## 📦 Installation

1. Copiez tout le contenu de ce dossier dans votre projet Angular (par exemple dans `src/app/core/api/SkillForge`).
2. Assurez-vous d'avoir `@angular/common` et `@angular/common/http` installés.

## 🚀 Utilisation Rapide

### 1. Configuration (app.module.ts ou app.config.ts)

Ajoutez le provider pour la configuration (optionnel si vous utilisez l'URL par défaut) :

```typescript
import { API_CONFIG } from './core/api/SkillForge';

providers: [
  {
    provide: API_CONFIG,
    useValue: {
      baseUrl: 'http://localhost:5000',
      tokenGetter: () => localStorage.getItem('token') // Auto-inject token
    }
  }
]
```

### 2. Injection dans un composant

```typescript
import { Component, OnInit } from '@angular/core';
import { SkillForgeService } from './core/api/SkillForge';

@Component({ ... })
export class MyComponent implements OnInit {
  constructor(private api: SkillForgeService) {}

  ngOnInit() {
    this.api.coursesList().subscribe(data => {
      console.log('Courses:', data);
    });
  }
}
```

## 🛠️ Scripts

Utilisez `node install.js` pour copier automatiquement les fichiers dans votre projet cible.
