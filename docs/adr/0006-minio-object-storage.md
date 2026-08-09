# 0006. MinIO (S3-compatible) plutot qu'un stockage cloud proprietaire

Statut : Accepte
Date : 2026-08-08

## Contexte

GeOSM stocke des fichiers binaires varies : fichiers sources importes (Shapefile, GeoJSON...),
exports generes, plans de localisation et rapports d'analyse en PDF, sauvegardes `pg_dump`,
icones generees. Ces fichiers doivent survivre aux redemarrages/redeploiements du conteneur
applicatif (donc pas de simple stockage sur le disque local du conteneur `api`), et le contexte
de deploiement cible (voir ADR [0002](0002-self-hosted-nominatim-osrm.md)) privilegie deja
l'auto-hebergement plutot que la dependance a des services cloud proprietaires payants.

## Decision

MinIO sert de stockage objet, expose derriere une interface compatible S3 (`storageService`,
`infrastructure/storage/minio.service.ts`). Le code applicatif n'utilise que le SDK S3 standard
(`@aws-sdk/client-s3` ou equivalent) - aucun appel specifique a MinIO en dehors de la
configuration de connexion (`MINIO_ENDPOINT`, `MINIO_PUBLIC_ENDPOINT` pour les URLs presignees
retournees au navigateur).

## Consequences

- Le stockage objet est auto-heberge au meme titre que PostgreSQL/Redis/Nominatim/OSRM -
  coherent avec le reste de l'infrastructure, pas de facturation a l'usage ni de compte cloud
  tiers a gerer pour un deploiement national.
- Parce que le SDK utilise est le SDK S3 standard, un deploiement qui prefererait malgre tout un
  vrai bucket S3 (AWS, ou tout autre fournisseur compatible S3) reste possible en changeant
  seulement `MINIO_ENDPOINT` et les identifiants - aucun changement de code necessaire. Ce n'etait
  pas l'objectif premier mais c'est un effet secondaire directement du a l'usage d'une interface
  standard plutot qu'un SDK proprietaire.
- MinIO devient un service supplementaire a superviser et sauvegarder (voir
  `docker-compose.prod.yml`) - un point de defaillance de plus par rapport a un service cloud
  managed qui aurait pris cette responsabilite operationnelle a sa charge.
- Les URLs de telechargement presignees dependent de la distinction entre l'endpoint interne
  (`MINIO_ENDPOINT`, resolu par nom de conteneur Docker) et l'endpoint public
  (`MINIO_PUBLIC_ENDPOINT`, ce que le navigateur du visiteur peut effectivement atteindre) - un
  detail de configuration facile a mal comprendre pour un nouveau contributeur qui deploie pour
  la premiere fois (voir `docs/deploiement.md`).

## Alternatives envisagees

- **Un bucket cloud proprietaire** (AWS S3, Google Cloud Storage...) : ecarte pour la meme
  raison que Nominatim/OSRM (ADR [0002](0002-self-hosted-nominatim-osrm.md)) - cout a l'usage
  incompatible avec un projet gratuit a but non lucratif, et dependance a un fournisseur non
  auto-hebergeable dans le contexte de deploiement vise.
- **Stockage sur disque local du conteneur/volume Docker simple** (sans couche S3) : ecarte -
  aurait fonctionne pour un seul serveur, mais aurait rendu impossible toute evolution future
  vers plusieurs instances applicatives partageant le meme stockage (scaling horizontal de
  l'API), et aurait prive le projet de la commodite des URLs presignees deja fournie
  nativement par une interface S3.
