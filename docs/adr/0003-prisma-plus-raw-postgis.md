# 0003. Prisma pour le metier, SQL PostGIS brut pour le spatial

Statut : Accepte
Date : 2026-08-08

## Contexte

Prisma est l'ORM du projet (modeles, migrations, client type-sur pour tout ce qui touche aux
entites metier : utilisateurs, instances, couches, commentaires...). Mais Prisma n'a pas de
support natif pour les types et fonctions spatiales PostGIS (`geometry`, `ST_Intersects`,
`ST_Buffer`, index GiST...) - c'est un choix delibere de Prisma de rester agnostique du SGBD,
pas une limitation qui allait etre corrigee.

Une partie non negligeable de ce que fait GeOSM est intrinsequement spatiale : buffer,
intersection/union/difference, recherche du plus proche, agregation par zone (choroplethe,
carroyage), statistiques zonales sur raster. Tout ca s'exprime naturellement en SQL PostGIS,
tres mal (ou pas du tout) via un ORM generique.

## Decision

Le projet assume un modele hybride plutot que de forcer un seul outil partout :

- **Prisma** pour tout ce qui est relationnel classique (CRUD, relations, migrations de schema,
  transactions metier).
- **`PostGISService`** (SQL brut via `$queryRaw`/`$executeRaw`) pour toutes les operations
  spatiales - buffer, intersections, stats zonales, recherche par distance routiere reelle
  couplee a OSRM, etc.
- **Une table de reference `public.admin_boundaries`** est explicitement exclue du cycle de vie
  Prisma (`@@ignore` dans `schema.prisma`) - alimentee par un script d'import direct
  (`scripts/seed-admin-boundaries.sh`), pas par `prisma db push`/`migrate`, parce que son contenu
  (limites administratives officielles) est une donnee geographique importee en masse, pas un
  schema qui evolue par migration incrementale comme le reste du modele metier.
- Les tables de donnees des **couches elles-memes** (celles referencees par
  `Layer.schemaName`/`Layer.tableName`, voir ADR
  [0001](0001-multi-instance-single-database.md)) sont creees dynamiquement par couche (import
  osm2pgsql/ogr2ogr, extraction OSM...) et ne passent JAMAIS par Prisma - Prisma ne connait meme
  pas leur structure a l'avance, elle depend de la source de donnees choisie a la creation.

## Consequences

- Chaque acces spatial en SQL brut perd la verification de types a la compilation que Prisma
  offre partout ailleurs - une faute de frappe dans une requete `$queryRaw` n'est detectee qu'a
  l'execution, pas par `tsc`.
- Deux façons differentes d'ecrire une requete a la base cohabitent dans le code - un
  contributeur doit savoir quand utiliser l'une ou l'autre (regle simple en pratique : des que
  `geometry`/`ST_*` entre en jeu, c'est `PostGISService`, sinon c'est Prisma).
- Les tables de couches et `admin_boundaries` echappent totalement au filet de securite des
  migrations Prisma (`prisma migrate diff` ne les voit jamais) - leur schema reel doit etre geree
  et documente separement (voir `docs/fonctionnalites-detaillees.md` sections 7 et 13).
- En echange, les operations spatiales beneficient de la performance native de PostGIS (index
  GiST, fonctions optimisees en C) sans la couche d'abstraction et les compromis de performance
  d'un ORM generique essayant de generaliser un cas que Prisma ne modelise pas.

## Alternatives envisagees

- **Un ORM avec support spatial natif** (ex. TypeORM avec extensions, ou GeoDjango cote Python) :
  aurait impose de changer d'ecosysteme/langage pour une seule categorie de fonctionnalites,
  disproportionne face au reste du projet deja construit en TypeScript/Fastify/Prisma.
- **Modeliser les geometries comme des colonnes Prisma classiques** (`Unsupported("geometry")`,
  supporte par Prisma) sans jamais descendre en SQL brut : reste possible pour du simple
  stockage/lecture, mais ne resout rien pour les vraies operations spatiales (buffer,
  intersection...) qui necessitent des fonctions PostGIS que Prisma ne sait pas exprimer -
  aurait juste deplace le SQL brut au meme endroit avec une etape de conversion en plus.
