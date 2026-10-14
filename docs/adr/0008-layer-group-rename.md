# 0008. Renommer Group/SubGroup en LayerGroup/LayerSubGroup sans toucher aux tables

Statut : Accepte
Date : 2026-10-19

## Contexte

Le modele `Group` designe aujourd'hui une categorie du catalogue de couches (par exemple
« Hebergement »). Le reseau social de GeOsm Family introduit un autre `Group` (communaute
d'utilisateurs). Les deux ne peuvent pas partager de nom Prisma, de route ni de cle d'injection.
Le cahier technique (4.2) prevoit un `ALTER TABLE ... RENAME` et le renommage des colonnes
(`Layer.groupId` -> `layerGroupId`). Or le conteneur de production execute `prisma db push` au
demarrage (`docker/entrypoint.sh`) : un diff mal interprete peut emettre un `DROP`/`CREATE` sur
des tables de catalogue qui referencent toutes les couches.

## Decision

On renomme les **noms logiques** uniquement :

- modeles Prisma `LayerGroup` et `LayerSubGroup`, avec `@@map("groups")` / `@@map("sub_groups")`
  deja en place : **aucun changement de table, de colonne, de contrainte ni d'index** ;
- relation `Instance.layerGroups` (le nom `groups` est reserve a la relation sociale) ;
- code TypeScript : entites, DTO, repositories, use cases, schemas Zod, routes, cles
  Awilix (`layerGroupRepository`, `layerSubGroupRepository`...) et noms de fichiers ;
- routes : `/instances/:instanceId/layer-groups` et
  `/layer-groups/:groupId/layer-sub-groups`, avec redirections 308 des anciens chemins
  (`legacy-layer-group-redirects.ts`).

On **ne renomme pas** les champs visibles dans le JSON ou la base : `groupId`, `subGroupId`,
`subGroups`, `includeSubGroups`, `groupName`, `subGroupName`.

La preuve d'innocuite est executable : `prisma migrate diff` entre l'ancien et le nouveau
schema retourne « This is an empty migration ».

## Consequences

- Deploiement et retour arriere sans migration : il suffit de changer l'image applicative.
- Les clients qui appellent encore `/groups` suivent la redirection 308 (methode et corps
  conserves). Cette redirection est temporaire : elle doit etre retiree avant l'etape 3.1,
  car `/instances/:instanceId/groups` et `/groups/:id` appartiendront alors au social.
- Le code et le schema divergent legerement du cahier technique (`Layer.subGroupId` conserve).
  Ce choix evite de casser le frontend et d'eventuels clients externes pour un gain purement
  esthetique.
- Le client Prisma change (`prisma.layerGroup`, `prisma.layerSubGroup`) : tout script externe
  qui l'utilise doit etre adapte.

## Alternatives envisagees

- **Renommer les tables et colonnes** (cahier technique) : ecarte pour le risque `db push`
  decrit plus haut, sans benefice fonctionnel.
- **Prefixer le social** (`/social/groups`) et garder `Group` pour le catalogue : ecarte, car le
  cahier technique et la maquette retiennent `/instances/:instanceId/groups` pour le social, et
  le nom `Group` devait de toute facon etre libere dans le code pour eviter la confusion.
