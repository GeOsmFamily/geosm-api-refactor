# 0004. BullMQ/Redis pour tout le travail asynchrone

Statut : Accepte
Date : 2026-08-08

## Contexte

Plusieurs operations de GeOSM sont trop longues pour repondre dans le cycle requete/reponse HTTP
habituel : import OSM (osm2pgsql sur un extract entier), export de couche, generation d'un plan
de localisation PDF (PyQGIS), generation d'un rapport d'analyse IA (redaction Gemini puis rendu
Puppeteer/Chromium), sauvegarde complete de la base (`pg_dump`), reimport OSM programme mensuel.
Toutes ces operations doivent survivre a un redemarrage du serveur, permettre de suivre une
progression, et parfois etre relancees apres echec (voir `POST /admin/jobs/:id/retry`).

Le projet utilise deja Redis pour le cache applicatif (voir `RedisService`) - une file d'attente
persistante n'introduit donc pas une nouvelle brique d'infrastructure a operer, seulement un
nouvel usage d'une brique existante.

## Decision

Toutes les taches longues passent par BullMQ (`QueueService`, `infrastructure/queue/`), adosse a
la meme instance Redis que le cache. Chaque famille de job a sa propre queue nommee
(`analysis-report`, `location-plan`, `layer-import`, `export`, `raster-analysis`,
`database-backup`, `scheduled-osm-import`...) avec son propre worker
(`infrastructure/queue/workers/*.worker.ts`). La progression et l'issue de chaque job sont
poussees en temps reel au client via WebSocket (`NotificationService`), et pour les jobs dont le
resultat doit rester consultable au-dela d'une session (ex. rapports d'analyse), un historique
est aussi persiste en base (voir `ListMyAnalysisReportsUseCase`) independamment du canal
temps reel.

## Consequences

- Un redemarrage du serveur (deploiement, crash) ne perd aucun job en attente - BullMQ le
  reprend au redemarrage du worker, contrairement a une simple queue en memoire.
- Le suivi de progression fin a fin (creation -> jobId -> WebSocket -> historique persiste)
  demande plus de code que de repondre directement en HTTP, pour chaque nouvelle fonctionnalite
  asynchrone - un cout repete a chaque nouveau type de job, pas juste une fois.
- Redis devient une dependance critique au meme titre que PostgreSQL : une panne Redis arrete a
  la fois le cache ET toutes les taches en arriere-plan, pas seulement une optimisation de
  performance qui degraderait gracieusement.
- Le decoupage en queues nommees separees (plutot qu'une queue generique) permet de superviser
  et de dimensionner chaque type de travail independamment (voir `GET /admin/jobs`), au prix
  d'un worker dedie a ecrire pour chaque nouvelle famille de tache.

## Alternatives envisagees

- **Un message broker dedie** (RabbitMQ, SQS...) : ecarte pour ne pas ajouter une brique
  d'infrastructure supplementaire a operer et sauvegarder, alors que Redis remplit deja ce role
  correctement pour le volume de jobs concerne (pas un besoin de tres haut debit justifiant un
  broker specialise).
- **Jobs "fire and forget" en memoire du processus** (ex. juste une `Promise` lancee sans queue
  persistante) : ecarte des le depart - un redemarrage de serveur en cours d'import OSM ou de
  generation de rapport aurait perdu le travail silencieusement, sans aucune trace ni moyen de
  reprendre.
- **Un cron systeme externe** (crontab du serveur) pour les jobs programmes (backup quotidien,
  reimport OSM mensuel) plutot que `QueueService.addRepeatableJob` : ecarte pour garder toute la
  logique de planification dans le code applicatif (versionnee, testable), plutot que dans une
  configuration serveur separee et invisible depuis le depot.
