# 0001. Multi-instance sur une seule base (schema PostGIS par pays, metadonnees partagees)

Statut : Accepte
Date : 2026-08-08

## Contexte

GeOSM est concu pour etre deploye pays par pays ("instances" - voir le modele `Instance` dans
`schema.prisma`, et `docs/fonctionnalites-detaillees.md` section 2). Deux architectures etaient
possibles : un deploiement Docker complet et independant par pays (sa propre API, sa propre
base, son propre reverse proxy), ou une seule application partagee par plusieurs pays.

Le contexte de deploiement compte beaucoup ici : la cible n'est pas une multinationale avec une
equipe DevOps par pays, mais souvent une seule petite equipe technique (parfois une seule
personne) gerant plusieurs deploiements nationaux avec un budget serveur limite. Multiplier les
VPS, les certificats TLS, les bases a sauvegarder et les mises a jour de securite a appliquer
N fois n'etait pas soutenable.

## Decision

Une seule application (une seule base de donnees PostgreSQL/PostGIS, un seul processus API) sert
plusieurs "instances" (pays). Le partitionnement se fait a deux niveaux differents selon la
nature de la donnee :

- **Metadonnees applicatives** (utilisateurs, instances, groupes/sous-groupes, couches,
  fonds de carte, commentaires...) : partagees dans le schema `public`, filtrees par
  `instanceId` (colonne/relation Prisma classique).
- **Donnees geographiques reelles** de chaque couche : isolees dans un schema PostGIS dedie par
  pays (`Layer.schemaName`/`Layer.tableName`, voir `schema.prisma` lignes 300-301 et 350-351) -
  par exemple les tables du Cameroun vivent dans un schema `cameroun`, distinct de celles d'un
  autre pays. Ce n'est PAS le "schema-per-tenant" complet parfois vu ailleurs (qui isolerait
  aussi les tables de metadonnees) : seule la donnee geographique volumineuse est separee, la
  couche applicative reste commune.

## Consequences

- Un seul deploiement (un seul `docker-compose.prod.yml`, un seul certificat, une seule base a
  sauvegarder) sert un nombre arbitraire de pays - le cout marginal d'ajouter un pays est une
  ligne dans la table `Instance` plus un schema PostGIS, pas un nouveau serveur.
- Les mises a jour de securite/fonctionnalites beneficient a tous les pays simultanement, sans
  synchronisation manuelle entre N deploiements.
- En contrepartie, une panne applicative (bug, incident base de donnees) affecte potentiellement
  tous les pays a la fois - pas d'isolation de panne entre instances au niveau processus/DB.
- Une instance particulierement volumineuse (beaucoup de couches, beaucoup de trafic) partage
  les memes ressources CPU/memoire que les autres - pas de scaling independant par pays sans
  changement d'architecture.
- Le controle d'acces (roles `SUPER_ADMIN`/`ADMIN_INSTANCE`/`EDITOR`/`VIEWER`) doit
  systematiquement verifier l'appartenance a l'instance cote application - une omission ici est
  une vraie faille (fuite de donnees entre pays), pas juste un bug fonctionnel.

## Alternatives envisagees

- **Un deploiement Docker complet par pays** : ecarte pour le cout operationnel (N serveurs,
  N certificats, N bases a sauvegarder, N mises a jour a appliquer manuellement) - disproportionne
  face a la taille reelle des equipes qui operent GeOSM en pratique.
- **Schema-per-tenant complet** (metadonnees ET donnees geographiques isolees par pays) : plus
  proche d'une vraie isolation multi-tenant, mais alourdit chaque requete/migration Prisma (qui
  devrait cibler dynamiquement N schemas au lieu d'un seul `public`) pour un gain d'isolation
  qui n'etait pas juge necessaire au vu du modele de menace reel (pas de tenants mutuellement
  mefiants payant pour une isolation stricte - des instances gerees par la meme organisation ou
  des partenaires de confiance).
