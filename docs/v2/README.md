# GeOsm Family v2 : journal de projet (API)

Ce dossier accueille les notes d'implementation, comptes rendus de recette et conventions du
projet GeOsm Family v2. Les decisions structurantes sont dans les ADR
([0007](../adr/0007-geosm-family-v2-cadrage.md)).

## Points de depart (15 octobre 2026)

- Branche de travail : `geosm-v2` (depuis `dev`, commit `edbf067`).
- Tag de retour arriere : `v1-stable` (meme commit), pose localement sur les deux depots.
- Pile : Node 24 en local (Node 22 en production), Fastify 5, Prisma 6, Vitest 4.

### Baseline de tests API

Executer depuis PowerShell dans `D:\Projets\NodeJS\geosm-api-refactor` (depuis Git Bash avec un
chemin `/d/...` les 165 fichiers echouent avec `Cannot read properties of undefined (reading
'config')`, probleme de casse du chemin Windows, pas de code) :

```powershell
$env:DATABASE_URL='postgresql://u:p@localhost:5432/test'
$env:JWT_ACCESS_SECRET='<32+ caracteres>'
$env:JWT_REFRESH_SECRET='<32+ caracteres>'
npx vitest run
```

Resultat de reference : **160 fichiers passent, 648 tests passent**. Echecs connus, sans lien
avec le code metier (environnement local) :

| Test | Cause |
|---|---|
| `tests/docker/validate-docker.test.ts` (2) | `docker-compose.yml` ne declare pas `redis` ni ses volumes |
| `auth/osm-login`, `auth/link-osm-account` (5) | `ENCRYPTION_KEY` factice au mauvais format |
| `tests/load/basic-load.test.ts` | exige un serveur en marche |

Toute regression se mesure par rapport a ce tableau.

## Plan

| Phase | Dates | Contenu |
|---|---|---|
| 0 Socle | 15 > 20 oct | cadrage, renommage LayerGroup, conventions, container |
| 1 Lot 1 | 21 oct > 6 nov | hierarchie des instances, app-shell, auth, notifications |
| 2 Lot 2 | 9 > 27 nov | carte et outils, fil social geolocalise |
| 3 Lot 3 | 30 nov > 18 dec | groupes, evenements, messagerie, connexions, profil |
| 4 Durcissement | 21 > 31 dec | securite, performance, tests, documentation, production |
