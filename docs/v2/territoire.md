# Territoire : hierarchie des instances (etape 1.1)

## Modele

`Instance.kind` (`CONTINENT` | `COUNTRY` | `REGION`, defaut `COUNTRY`), `parentInstanceId` (relation
auto-referencee, `ON DELETE SET NULL`), `flagIconUrl`, `continentCode`. `User.preferredInstanceId`
(pays choisi, `ON DELETE SET NULL`). Le Monde n'est pas materialise.

Regles (use case `UpdateInstanceHierarchyUseCase`) : continent sans parent ; pays -> continent ;
region -> pays ; un pays peut rester sans parent (instances anterieures) ; `continentCode` saisi
uniquement sur un continent, recopie sur tous ses descendants.

Les continents sont **inactifs** (`isActive = false`) pour ne pas apparaitre dans les listes
d'instances actives du geoportail ; l'arbre ignore `isActive`. Un pays inactif est « non disponible »
(RG-B-03) : visible dans l'arbre, non selectionnable.

## API

| Route | Acces | Role |
|---|---|---|
| `GET /api/v1/instances/tree` | public, `Cache-Control: max-age=60` | arbre complet, pays inactifs inclus |
| `GET /api/v1/instances/:id/children` | public | enfants directs |
| `PATCH /api/v1/admin/instances/:id` | SUPER_ADMIN | `kind`, `parentInstanceId`, `flagIconUrl`, `continentCode` ; 422 `INVALID_HIERARCHY` |
| `PUT /api/v1/auth/me/preferred-instance` | connecte | `{ instanceId }` ou `null` ; 409 si pays indisponible |
| `GET /api/v1/instances?kind=COUNTRY` | public | filtre par niveau |

`GET /auth/me` expose desormais `preferredInstanceId`.

Ecart avec le cahier technique : le cache est purement HTTP (60 s, puis `stale-while-revalidate`),
sans invalidation active a chaque PATCH. L'arbre change rarement ; 60 s de latence est acceptable.

## Seed

`npm run db:seed:territories` (aussi appele par `db:seed`). Idempotent, ne supprime rien : une
instance existante n'est mise a jour que sur sa place dans l'arbre. 6 continents, 54 pays africains
(Cameroun seul actif) et quelques pays par autre continent (`prisma/territories.ts`). Les drapeaux
pointent vers `https://flagcdn.com/<iso>.svg`. Le slug historique `cameroon` est conserve.

## Deploiement

`prisma db push` ajoute 3 colonnes a `instances`, 1 a `users`, l'enum, 2 index et 2 cles etrangeres,
sans perte de donnees (verifie sur une base v1 contenant des donnees). **Avant la production**, verifier
qu'aucune instance ne reference un parent inexistant, sinon la cle etrangere echouera :

```sql
SELECT id, slug, parent_instance_id FROM instances
WHERE parent_instance_id IS NOT NULL
  AND parent_instance_id NOT IN (SELECT id FROM instances);
```

Ordre : `db push` -> `npm run db:seed:territories` -> deploiement de l'API -> du frontend.
Retour arriere : l'ancienne API ignore les nouvelles colonnes (ajouts purs).
