# Architecture Decision Records (ADR)

Ce dossier documente le **pourquoi** des choix d'architecture structurants de l'API GeOSM - pas
le comment (deja couvert par `docs/architecture.md` et `docs/fonctionnalites-detaillees.md`).
Une ADR n'est pas un journal de toutes les decisions techniques : seulement celles qui sont
couteuses a revenir dessus, ou qui surprennent systematiquement les nouveaux contributeurs qui
les redecouvrent par essai-erreur faute de les avoir lues quelque part.

## Pourquoi ce dossier existe

Ce projet est open source et accepte des contributions externes. Sans ADR, un nouveau
contributeur qui se demande "pourquoi PostGIS en SQL brut a certains endroits plutot que
Prisma partout ?" ou "pourquoi deux moteurs de PDF differents ?" doit soit deviner, soit
redecouvrir la raison en cassant quelque chose. Une ADR courte (une page) evite ca.

## Index

| # | Titre | Statut |
|---|---|---|
| [0001](0001-multi-instance-single-database.md) | Multi-instance sur une seule base (schema PostGIS par pays, metadonnees partagees) | Accepte |
| [0002](0002-self-hosted-nominatim-osrm.md) | Auto-hebergement de Nominatim et OSRM plutot que les serveurs publics de demonstration | Accepte |
| [0003](0003-prisma-plus-raw-postgis.md) | Prisma pour le metier, SQL PostGIS brut pour le spatial | Accepte |
| [0004](0004-bullmq-for-async-work.md) | BullMQ/Redis pour tout le travail asynchrone | Accepte |
| [0005](0005-two-pdf-pipelines.md) | Deux moteurs de PDF distincts (PyQGIS vs Puppeteer/HTML) | Accepte |
| [0006](0006-minio-object-storage.md) | MinIO (S3-compatible) plutot qu'un stockage cloud proprietaire | Accepte |
| [0007](0007-geosm-family-v2-cadrage.md) | GeOsm Family v2 : decisions de cadrage (reseau social geolocalise) | Accepte |
| [0008](0008-layer-group-rename.md) | Renommer Group/SubGroup en LayerGroup/LayerSubGroup sans toucher aux tables | Accepte |

## Proposer une nouvelle ADR

1. Copiez `template.md` vers `NNNN-titre-court-en-kebab-case.md` (numero suivant disponible).
2. Remplissez Contexte / Decision / Consequences / Alternatives envisagees - restez concret,
   citez le code/fichier concerne plutot que de rester abstrait.
3. Ouvrez une PR. Une ADR se discute comme du code : elle peut etre amendee, mais son *statut*
   ("Propose", "Accepte", "Remplace par NNNN") retrace l'historique, on ne reecrit pas le passe.
4. Ajoutez une ligne dans le tableau ci-dessus.

Une ADR "Accepte" n'est pas gravee dans le marbre : si le contexte change, ouvrez-en une
nouvelle qui la remplace (`Statut: Remplace par 00NN`) plutot que d'editer silencieusement
l'ancienne - l'interet d'une ADR est justement de garder la trace du raisonnement d'origine.
