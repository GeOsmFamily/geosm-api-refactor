# Fil social géolocalisé (étape 2.2, API)

Référence : cahier fonctionnel 4.5 (RG-E-01 à RG-E-10), cahier technique 4.4 et 5.2, ADR 0007 point 5.

## Modèle

| Table | Rôle |
|---|---|
| `tags` | 17 ODD globaux (`category = SDG`, couleur officielle) et étiquettes libres par pays (`CUSTOM`), libellés JSON fr/en/es |
| `posts` | publication : texte, lieu (`lat`, `lon`, `geom` indexée GiST), rayon, libellé du lieu, visibilité, statut, compteurs |
| `post_tags`, `post_media` | étiquettes et médias (clé MinIO, URL présignée à la lecture) |
| `post_reactions` | « j'aime » (un par utilisateur et par publication) |
| `post_comments`, `post_comment_likes` | commentaires sur un niveau, « j'aime » sur les commentaires |
| `content_reports` | signalements génériques (publications, commentaires, puis groupes et événements) |

`geom` (`geography(Point, 4326)`) est déclarée dans le schéma Prisma (`Unsupported`) pour que
`prisma db push`, exécuté au démarrage, la conserve ; le dépôt la renseigne à chaque écriture.

Seed : `prisma/post-tags.ts`, appelé par `prisma/seed.ts` et `npm run db:seed:territories`.

## Routes

| Méthode | Route | Accès |
|---|---|---|
| GET | `/tags?instanceId&category` | public |
| GET | `/instances/:instanceId/posts?lat&lon&radius&bbox&tags&authorId&sort&cursor&limit` | auth facultative |
| GET | `/instances/:instanceId/posts/pins?bbox&...` | auth facultative |
| POST | `/instances/:instanceId/posts` | e-mail vérifié |
| POST | `/posts/media` (multipart) | e-mail vérifié |
| GET / PATCH / DELETE | `/posts/:id` | facultative / auteur / auteur ou modération |
| POST | `/posts/:id/reactions` | e-mail vérifié |
| POST | `/posts/:id/shares` | auth facultative |
| GET / POST | `/posts/:id/comments` | facultative / e-mail vérifié |
| DELETE | `/post-comments/:id` | auteur du commentaire ou de la publication, modération |
| POST | `/post-comments/:id/likes` | e-mail vérifié |
| POST | `/posts/:id/reports`, `/post-comments/:id/reports` | connecté |
| GET | `/admin/instances/:instanceId/reports` | super-admin, admin de l'instance |
| POST | `/admin/posts/:id/review`, `/admin/post-comments/:id/review` | super-admin, admin de l'instance |

Fil : sans `lat`/`lon`, tout le pays actif (nouveau compte) ; tri `recent` (curseur
createdAt + id) ou `popular` (interactions). La visibilité est appliquée dans la requête SQL.

## Écarts au cahier technique

- Identifiants UUID et tables en snake_case (conventions du dépôt) au lieu de `cuid`.
- Rayon de 100 m à 25 km (ADR 0007 et RG-E-01) ; le cahier technique écrivait 20 km.
- `placeLabel` ajouté (libellé « Carrefour Nkoabang » des maquettes 51 et 54).
- `MediaType` a une valeur `GIF` (ADR : GIF envoyé comme fichier) ; route `POST /posts/media`
  créée, car aucun flux d'envoi d'image n'existait. Format contrôlé par les premiers octets.
- Signalement citoyen sur `POST /posts/:id/reports` (au lieu de `/admin/posts/:id/flag`, qui
  mélangeait citoyens et administration) ; table générique `content_reports` ; masquage au 3e
  signaleur distinct (`FLAGGED`), décision `APPROVE` / `REJECT` notifiée à l'auteur (`POST_MODERATED`).
- « J'aime » sur les commentaires (ADR 0007).
- Auteur supprimé : `authorId` passe à null (« Utilisateur supprimé »), la publication reste.
- Publications de groupe (`groupId`, `visibility = GROUP`) refusées jusqu'à la phase 3.
- Compte non vérifié : lecture seule (RG-A-05), y compris pour l'envoi de médias.

## Tests

- Unitaires : `tests/unit/application/use-cases/posts/`.
- PostGIS réel : `tests/integration-db/posts-repository.test.ts` (distance, emprise, curseur,
  visibilité, compteurs, signalements).
- Recette : `D:\geosm-recette\recette-posts.mjs` (hors dépôt).
