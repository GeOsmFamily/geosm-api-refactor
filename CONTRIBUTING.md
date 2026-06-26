# Contribuer a GeOSM API

Merci de votre interet pour contribuer a GeOSM API. Ce document fournit les directives et instructions pour contribuer au projet.

## Pour commencer

1. **Forker** le depot sur GitHub
2. **Cloner** votre fork localement :
   ```bash
   git clone https://github.com/<votre-utilisateur>/geosm-api.git
   cd geosm-api
   ```
3. **Creer une branche** pour votre travail :
   ```bash
   git checkout -b feat/nom-de-votre-fonctionnalite
   ```
4. **Installer les dependances** et configurer votre environnement (voir [README.md](./README.md))
5. **Effectuer vos modifications**, ecrire les tests et verifier que tout passe
6. **Pousser** votre branche et ouvrir une **Pull Request**

---

## Style de code

- **Langage** : TypeScript (mode strict)
- **Linting** : ESLint 9 avec typescript-eslint
- **Formatage** : Prettier 3
- **Conventions de nommage** :
  - `kebab-case` pour les noms de fichiers (ex: `create-user.use-case.ts`)
  - `PascalCase` pour les classes et interfaces (ex: `CreateUserUseCase`)
  - `camelCase` pour les variables et fonctions (ex: `createUser`)

Executez ces commandes avant de commiter :

```bash
npm run lint        # Verifier les problemes de linting
npm run format      # Formater automatiquement le code avec Prettier
```

---

## Directives architecturales

Ce projet suit la **Clean Architecture** (Architecture Hexagonale). Placez votre code dans la couche appropriee.

### Couche Domaine (`src/domain/`)

- Interfaces d'entites et objets de valeur
- Enumerations et constantes
- Classes d'erreurs personnalisees
- Interfaces de depots (ports)
- **Aucune dependance** aux bibliotheques ou frameworks externes

### Couche Application (`src/application/`)

- **Cas d'utilisation** : Une classe par operation metier, chacune avec une seule methode `execute()`
- **DTOs** : Objets de transfert de donnees pour les entrees/sorties a la frontiere applicative
- **Interfaces de services** : Definitions abstraites pour les services d'infrastructure (email, mot de passe, token)
- Depend uniquement de la couche domaine

### Couche Infrastructure (`src/infrastructure/`)

- **Implementations des depots** : Implementations basees sur Prisma des interfaces de depots du domaine
- **Services externes** : Redis, MinIO, MeiliSearch, Nominatim, OSRM, QGIS Server, SMTP
- **Workers de file d'attente** : Processeurs de jobs BullMQ
- Implemente les interfaces definies dans les couches domaine et application

### Couche Presentation (`src/presentation/`)

- **Routes** : Gestionnaires de routes Fastify -- resolvent les cas d'utilisation depuis le conteneur DI, valident les entrees avec Zod et retournent les reponses
- **Middleware** : Gestion d'erreurs, autorisation RBAC, journalisation des requetes, metriques
- **Plugins** : Enregistrements de plugins Fastify (auth, CORS, Swagger, WebSocket, multipart)
- **Schemas** : Schemas de validation Zod pour les requetes/reponses

### Principes cles

- Les dependances pointent vers l'interieur (presentation -> application -> domaine)
- Utiliser le conteneur DI Awilix pour l'injection de dependances ; enregistrer les nouveaux services dans `src/container.ts`
- Utiliser Zod pour toute validation de requetes
- Suivre les conventions de nommage existantes

---

## Tests

Le projet contient **800+ tests** (unitaires et integration) ecrits avec **Vitest**.

- Placer les fichiers de test a cote des fichiers source ou dans un repertoire `__tests__`
- Tester les cas d'utilisation independamment de l'infrastructure (mocker les depots)
- Les tests d'integration necessitent PostgreSQL/PostGIS, Redis, MinIO et MeiliSearch

```bash
npm test                  # Lancer tous les tests unitaires
npm run test:watch        # Mode watch
npm run test:coverage     # Avec rapport de couverture
npm run test:integration  # Tests d'integration (necessite les services)
```

Toutes les PRs doivent passer les tests existants. Les nouvelles fonctionnalites doivent inclure des tests.

---

## CI/CD

Le projet utilise **GitHub Actions** avec 4 pipelines :

| Pipeline | Declencheur | Description |
|---|---|---|
| **CI** (`ci.yml`) | Push/PR sur `main`, `dev`, `claude/**` | Lint, TypeScript, tests unitaires, tests d'integration, build, Docker |
| **Qualite du code** (`code-quality.yml`) | Push/PR sur `main`, `dev`, `claude/**` | ESLint avec rapport, verification TypeScript, couverture, detection de doublons (jscpd) |
| **Securite** (`security.yml`) | Push/PR + hebdomadaire | Audit npm, scan de secrets (Gitleaks), analyse SAST, scan Docker (Trivy), verification injection SQL |
| **Deploiement** (`deploy.yml`) | Push sur `main` | Tests, build Docker, push GHCR, tag de version `yyyyMMdd.numBuild`, release GitHub |

**Dependabot** est configure pour les mises a jour hebdomadaires (npm, Docker, GitHub Actions) sur la branche `dev`.

---

## Format des commits

Suivez la specification [Conventional Commits](https://www.conventionalcommits.org/) :

```
<type>(<portee>): <description courte>

[corps optionnel]

[pied de page optionnel]
```

### Types

| Type | Description |
|---|---|
| `feat` | Nouvelle fonctionnalite |
| `fix` | Correction de bogue |
| `docs` | Modifications de documentation |
| `style` | Modifications de style de code (formatage, aucun changement de logique) |
| `refactor` | Refactorisation de code (ni fonctionnalite ni correction) |
| `perf` | Amelioration des performances |
| `test` | Ajout ou mise a jour de tests |
| `chore` | Modifications du build, CI ou outillage |

### Exemples

```
feat(layers): ajouter l'import en masse de fichiers GeoJSON
fix(auth): gerer correctement la rotation des refresh tokens expires
docs(readme): ajouter la section deploiement
refactor(exports): extraire la conversion de fichiers dans un service dedie
test(users): ajouter des tests d'integration pour les changements de role
```

---

## Checklist PR

Avant de soumettre votre PR, verifiez :

- [ ] Le code compile sans erreurs (`npm run build`)
- [ ] Le linting passe (`npm run lint`)
- [ ] La verification TypeScript passe (`npx tsc --noEmit`)
- [ ] Tous les tests existants passent (`npm test`)
- [ ] Les tests d'integration passent (`npm run test:integration`)
- [ ] Des tests sont ecrits pour les nouvelles fonctionnalites ou corrections
- [ ] Les messages de commit suivent le format conventional commits
- [ ] Le titre de la PR est concis et descriptif
- [ ] La description de la PR explique le "pourquoi" du changement
- [ ] Les modifications de schema de base de donnees incluent une migration Prisma (`npm run db:migrate`)
- [ ] Les nouvelles variables d'environnement sont ajoutees a `src/config/env.config.ts` avec les valeurs par defaut appropriees
- [ ] Les nouvelles routes sont enregistrees dans `src/server.ts`
- [ ] Les nouveaux services/depots sont enregistres dans `src/container.ts`

---

## Code de conduite

Soyez respectueux, constructif et collaboratif. Nous nous engageons a offrir une experience accueillante et inclusive pour tous. Le harcelement, la discrimination et les comportements irrespectueux ne seront pas toleres.

---

## Questions ?

Ouvrez une issue sur GitHub en utilisant les templates disponibles (bug, fonctionnalite, performance, securite, documentation) pour les questions, demandes de fonctionnalites ou rapports de bogues.

---

*Derniere mise a jour : Juin 2026*
