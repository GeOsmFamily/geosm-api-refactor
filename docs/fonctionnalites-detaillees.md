# GeOSM API v3.0 -- Guide Detaille des Fonctionnalites

> API backend du geoportail GeOSM (Geographic OpenStreetMap), plateforme open-source de cartographie basee sur les donnees OpenStreetMap pour l'Afrique.

## Table des matieres

1. [Authentification et Gestion des Utilisateurs](#1-authentification-et-gestion-des-utilisateurs)
2. [Gestion des Instances (Pays)](#2-gestion-des-instances-pays)
3. [Thematiques (Groupes)](#3-thematiques-groupes)
4. [Sous-thematiques (Sous-groupes)](#4-sous-thematiques-sous-groupes)
5. [Couches (Layers)](#5-couches-layers)
6. [Features (Entites geographiques)](#6-features-entites-geographiques)
7. [Donnees OpenStreetMap](#7-donnees-openstreetmap)
8. [Styles et Symbologie](#8-styles-et-symbologie)
9. [Export de Donnees](#9-export-de-donnees)
10. [Import de Donnees](#10-import-de-donnees)
11. [Projets QGIS et Scripts PyQGIS](#11-projets-qgis-et-scripts-pyqgis)
12. [Proxy WMS/WFS (QGIS Server)](#12-proxy-wmswfs-qgis-server)
13. [Geoportail](#13-geoportail)
14. [Geocodage (Nominatim)](#14-geocodage-nominatim)
15. [Itineraires (OSRM)](#15-itineraires-osrm)
16. [Recherche (MeiliSearch)](#16-recherche-meilisearch)
17. [Analyse Spatiale](#17-analyse-spatiale)
18. [Gestion des Rasters](#18-gestion-des-rasters)
19. [Adressage](#19-adressage)
20. [Dessins (Drawings)](#20-dessins-drawings)
21. [Partage de Cartes](#21-partage-de-cartes)
22. [Analytiques et Statistiques](#22-analytiques-et-statistiques)
23. [Compositions de Cartes](#23-compositions-de-cartes)
24. [Documents](#24-documents)
25. [Catalogue Public](#25-catalogue-public)
26. [SEO (Metadonnees)](#26-seo-metadonnees)
27. [Fonds de Carte (Base Maps)](#27-fonds-de-carte-base-maps)
28. [Themes et Tags par Defaut](#28-themes-et-tags-par-defaut)
29. [Administration](#29-administration)
30. [Notifications Temps Reel (WebSocket)](#30-notifications-temps-reel-websocket)
31. [Service Email](#31-service-email)
32. [Upload de Fichiers](#32-upload-de-fichiers)
33. [Sante et Monitoring](#33-sante-et-monitoring)

---

## 1. Authentification et Gestion des Utilisateurs

### 1.1 Inscription (Register)

**Description** : Permet a un nouvel utilisateur de creer un compte sur la plateforme. Le systeme verifie l'unicite de l'email, hash le mot de passe avec Argon2id, cree l'utilisateur en base de donnees Prisma, et envoie un email de verification.

**Cas d'usage** : Un nouvel administrateur de l'instance Cameroun veut creer son compte pour gerer les couches cartographiques du pays.

**Implementation technique** :
- Route : `POST /api/v1/auth/register` (`src/presentation/routes/auth.routes.ts`)
- Use case : `RegisterUseCase` -> verifie unicite email via `PrismaUserRepository` -> hash Argon2id via `Argon2PasswordService` -> cree user Prisma -> envoie email verification via `SmtpEmailService`
- Modele BD : `User` (id UUID, email, passwordHash, firstName, lastName, role, isActive, emailVerifiedAt)

**Exemple de requete** :
```json
POST /api/v1/auth/register
{
  "email": "admin@cameroun.geosm.org",
  "password": "MotDePasseSecurise123!",
  "firstName": "Boris",
  "lastName": "Tchoukouaha"
}
```

**Reponse** :
```json
{
  "success": true,
  "data": { "id": "uuid", "email": "admin@cameroun.geosm.org", "firstName": "Boris", "lastName": "Tchoukouaha" }
}
```

**Flux de donnees** : Route -> parseBody (Zod) -> RegisterUseCase.execute() -> UserRepository.findByEmail() -> PasswordService.hash() -> UserRepository.create() -> EmailService.sendVerification() -> reponse 201

### 1.2 Connexion (Login)

**Description** : Authentifie un utilisateur existant en verifiant ses identifiants. Retourne un access token JWT RS256 et un refresh token stocke en base de donnees avec famille de rotation.

**Cas d'usage** : L'editeur de l'instance Benin se connecte pour ajouter de nouvelles couches de donnees sur les ecoles.

**Implementation technique** :
- Route : `POST /api/v1/auth/login` (`auth.routes.ts`)
- Use case : `LoginUseCase` -> `UserRepository.findByEmail()` -> `PasswordService.verify()` -> `TokenService.generateAccessToken()` -> `RefreshTokenRepository.create()`
- Le refresh token utilise un systeme de famille pour detecter les vols de token

**Exemple de requete** :
```json
POST /api/v1/auth/login
{ "email": "admin@cameroun.geosm.org", "password": "MotDePasseSecurise123!" }
```

**Reponse** :
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "rt_abc123...",
    "user": { "id": "uuid", "email": "...", "role": "ADMIN_INSTANCE" }
  }
}
```

### 1.3 Rafraichissement de Token

**Description** : Permet de renouveler un access token expire en utilisant un refresh token valide. Le systeme implemente la rotation de tokens : chaque utilisation invalide l'ancien refresh token et en genere un nouveau.

**Cas d'usage** : Le token d'acces de l'utilisateur expire apres 15 minutes ; le frontend appelle automatiquement cet endpoint pour obtenir un nouveau token sans redemander les identifiants.

**Implementation technique** :
- Route : `POST /api/v1/auth/refresh` (`auth.routes.ts`)
- Use case : `RefreshTokenUseCase` -> verifie token en BD -> verifie famille (detection vol) -> genere nouveau couple access/refresh -> revoque ancien refresh token

**Exemple de requete** :
```json
POST /api/v1/auth/refresh
{ "refreshToken": "rt_abc123..." }
```

### 1.4 Deconnexion (Logout)

**Description** : Revoque le refresh token fourni, empechant toute utilisation ulterieure pour generer de nouveaux access tokens.

**Cas d'usage** : Un utilisateur quitte son poste et souhaite invalider sa session pour des raisons de securite.

**Implementation technique** :
- Route : `POST /api/v1/auth/logout` (`auth.routes.ts`)
- Use case : `LogoutUseCase` -> `RefreshTokenRepository.revoke()`

**Exemple de requete** :
```json
POST /api/v1/auth/logout
{ "refreshToken": "rt_abc123..." }
```

### 1.5 Verification d'Email

**Description** : Valide l'adresse email d'un utilisateur via un token envoye par email. Met a jour le champ `emailVerifiedAt` dans la base de donnees.

**Cas d'usage** : Apres inscription, l'utilisateur clique sur le lien dans l'email de verification pour activer son compte.

**Implementation technique** :
- Route : `POST /api/v1/auth/verify-email` (`auth.routes.ts`)
- Use case : `VerifyEmailUseCase` -> `UserRepository.verifyEmail()`

### 1.6 Mot de Passe Oublie

**Description** : Declenche l'envoi d'un email contenant un lien de reinitialisation de mot de passe avec un token temporaire.

**Cas d'usage** : Un editeur a oublie son mot de passe et demande un lien de reinitialisation.

**Implementation technique** :
- Route : `POST /api/v1/auth/forgot-password` (`auth.routes.ts`)
- Use case : `ForgotPasswordUseCase` -> `UserRepository.findByEmail()` -> `EmailService.sendPasswordReset()`

### 1.7 Reinitialisation de Mot de Passe

**Description** : Permet de definir un nouveau mot de passe en utilisant le token de reinitialisation recu par email. Tous les refresh tokens existants sont revoques pour securiser le compte.

**Cas d'usage** : L'utilisateur clique sur le lien recu par email et definit un nouveau mot de passe.

**Implementation technique** :
- Route : `POST /api/v1/auth/reset-password` (`auth.routes.ts`)
- Use case : `ResetPasswordUseCase` -> verifie token -> `PasswordService.hash()` -> `UserRepository.updatePassword()` -> `RefreshTokenRepository.revokeAll()`

### 1.8 Profil Utilisateur (Consultation)

**Description** : Retourne les informations du profil de l'utilisateur actuellement authentifie.

**Cas d'usage** : Le frontend affiche le tableau de bord avec les informations personnelles de l'utilisateur connecte.

**Implementation technique** :
- Route : `GET /api/v1/auth/me` (authentifie) (`auth.routes.ts`)
- Use case : `GetProfileUseCase` -> `UserRepository.findById(request.user.sub)`

### 1.9 Mise a Jour du Profil

**Description** : Permet a l'utilisateur connecte de modifier son prenom, nom, avatar et autres informations personnelles.

**Cas d'usage** : Un utilisateur souhaite mettre a jour sa photo de profil et corriger une faute dans son nom.

**Implementation technique** :
- Route : `PATCH /api/v1/auth/me` (authentifie) (`auth.routes.ts`)
- Use case : `UpdateProfileUseCase` -> `UserRepository.update()`

### 1.10 Changement de Mot de Passe

**Description** : Permet a l'utilisateur connecte de changer son mot de passe en fournissant l'ancien et le nouveau. Tous les refresh tokens existants sont revoques.

**Cas d'usage** : Un administrateur decide de changer son mot de passe suite a une alerte de securite.

**Implementation technique** :
- Route : `PUT /api/v1/auth/me/password` (authentifie) (`auth.routes.ts`)
- Use case : `ChangePasswordUseCase` -> verifie ancien mot de passe -> hash nouveau -> revoque tous les refresh tokens

---

### 1.11 Gestion des Utilisateurs (Admin)

Les endpoints suivants sont reserves aux `SUPER_ADMIN` et permettent la gestion complete des utilisateurs de la plateforme.

#### 1.11.1 Liste des Utilisateurs

**Description** : Retourne la liste paginee de tous les utilisateurs de la plateforme avec filtrage possible.

**Implementation technique** :
- Route : `GET /api/v1/users` (SUPER_ADMIN) (`user.routes.ts`)
- Use case : `ListUsersUseCase` -> `UserRepository.findMany()`
- Pagination : `?page=1&limit=20`

#### 1.11.2 Detail d'un Utilisateur

**Description** : Retourne les informations detaillees d'un utilisateur specifique.

- Route : `GET /api/v1/users/:id` (SUPER_ADMIN)
- Use case : `GetUserUseCase`

#### 1.11.3 Creation d'un Utilisateur

**Description** : Cree un nouvel utilisateur avec un role specifique directement par un super administrateur.

**Cas d'usage** : Le super administrateur cree un compte pour un nouveau gestionnaire d'instance sans passer par l'inscription publique.

- Route : `POST /api/v1/users` (SUPER_ADMIN)
- Use case : `CreateUserUseCase` -> hash mot de passe -> cree user

#### 1.11.4 Modification d'un Utilisateur

- Route : `PATCH /api/v1/users/:id` (SUPER_ADMIN)
- Use case : `UpdateUserUseCase`

#### 1.11.5 Suppression d'un Utilisateur

- Route : `DELETE /api/v1/users/:id` (SUPER_ADMIN)
- Use case : `DeleteUserUseCase`

#### 1.11.6 Changement de Role

**Description** : Modifie le role d'un utilisateur (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR, VIEWER).

- Route : `PATCH /api/v1/users/:id/role` (SUPER_ADMIN)
- Use case : `ChangeUserRoleUseCase`

#### 1.11.7 Activation/Desactivation d'un Utilisateur

**Description** : Active ou desactive le compte d'un utilisateur, empechant toute connexion si desactive.

- Route : `PATCH /api/v1/users/:id/activate` (SUPER_ADMIN)
- Use case : `ToggleUserActiveUseCase`

---

## 2. Gestion des Instances (Pays)

Une instance represente un pays ou une region geographique. Chaque instance possede ses propres couches, groupes thematiques, fonds de carte et projets QGIS.

### 2.1 Liste des Instances

**Description** : Retourne la liste paginee de toutes les instances (pays) disponibles sur la plateforme.

**Cas d'usage** : Le frontend affiche le selecteur de pays (Cameroun, Benin, Senegal...) sur la page d'accueil.

**Implementation technique** :
- Route : `GET /api/v1/instances` (authentifie) (`instance.routes.ts`)
- Use case : `ListInstancesUseCase` -> `InstanceRepository.findMany()`
- Modele BD : `Instance` (id, name, slug, description, logo, bbox, centerLat, centerLon, defaultZoom, isActive)

**Reponse paginee** :
```json
{
  "success": true,
  "data": [{ "id": "uuid", "name": "Cameroun", "slug": "cameroun", "bbox": [8.5, 1.6, 16.2, 13.1], "centerLat": 7.37, "centerLon": 12.35 }],
  "pagination": { "page": 1, "limit": 20, "total": 5, "totalPages": 1 }
}
```

### 2.2 Detail d'une Instance

- Route : `GET /api/v1/instances/:id` (authentifie)
- Use case : `GetInstanceUseCase`

### 2.3 Creation d'une Instance

**Description** : Cree une nouvelle instance geographique avec sa bounding box, son centre et son zoom par defaut.

**Cas d'usage** : Le super administrateur deploie GeOSM pour un nouveau pays africain, le Togo, en definissant les coordonnees du pays.

**Implementation technique** :
- Route : `POST /api/v1/instances` (SUPER_ADMIN) (`instance.routes.ts`)
- Use case : `CreateInstanceUseCase` -> `InstanceRepository.create()`

**Exemple de requete** :
```json
POST /api/v1/instances
{
  "name": "Togo",
  "slug": "togo",
  "description": "Instance GeOSM pour le Togo",
  "bbox": [-0.15, 6.1, 1.8, 11.14],
  "centerLat": 8.62,
  "centerLon": 0.82,
  "defaultZoom": 7
}
```

### 2.4 Mise a Jour d'une Instance

- Route : `PATCH /api/v1/instances/:id` (SUPER_ADMIN ou ADMIN_INSTANCE)
- Use case : `UpdateInstanceUseCase`

### 2.5 Suppression d'une Instance

- Route : `DELETE /api/v1/instances/:id` (SUPER_ADMIN)
- Use case : `DeleteInstanceUseCase` (cascade : supprime groupes, couches, projets QGIS associes)

### 2.6 Gestion des Utilisateurs d'Instance

#### 2.6.1 Liste des Utilisateurs d'une Instance

**Description** : Retourne la liste des utilisateurs associes a une instance avec leurs roles.

- Route : `GET /api/v1/instances/:instanceId/users` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `GetInstanceUsersUseCase`
- Modele BD : `InstanceUser` (userId, instanceId, role)

#### 2.6.2 Ajout d'un Utilisateur a une Instance

**Description** : Associe un utilisateur existant a une instance avec un role specifique.

**Cas d'usage** : L'administrateur de l'instance Cameroun ajoute un nouvel editeur pour gerer les couches de transport.

- Route : `POST /api/v1/instances/:instanceId/users` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `AddInstanceUserUseCase`

```json
POST /api/v1/instances/:instanceId/users
{ "userId": "uuid-de-lutilisateur", "role": "EDITOR" }
```

#### 2.6.3 Suppression d'un Utilisateur d'une Instance

- Route : `DELETE /api/v1/instances/:instanceId/users/:userId` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `RemoveInstanceUserUseCase`

#### 2.6.4 Changement de Role dans une Instance

- Route : `PATCH /api/v1/instances/:instanceId/users/:userId/role` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `ChangeInstanceUserRoleUseCase`

---

## 3. Thematiques (Groupes)

Les groupes representent des categories thematiques (Transport, Sante, Education...) au sein d'une instance. Ils organisent les couches cartographiques de maniere hierarchique.

### 3.1 Liste des Groupes

**Description** : Retourne tous les groupes thematiques d'une instance, ordonnes par le champ `order`.

**Cas d'usage** : Le geoportail affiche le panneau lateral avec les thematiques disponibles pour le Cameroun.

**Implementation technique** :
- Route : `GET /api/v1/instances/:instanceId/groups` (authentifie) (`group.routes.ts`)
- Use case : `ListGroupsUseCase` -> `GroupRepository.findByInstanceId()`
- Modele BD : `Group` (id, name, slug, description, icon, color, order, isActive, instanceId)

### 3.2 Detail d'un Groupe

- Route : `GET /api/v1/instances/:instanceId/groups/:id` (authentifie)
- Use case : `GetGroupUseCase`

### 3.3 Creation d'un Groupe

**Description** : Cree un nouveau groupe thematique pour une instance. Verifie l'unicite du slug au sein de l'instance.

**Cas d'usage** : L'administrateur de l'instance Benin cree le groupe "Agriculture" pour y placer les couches de cultures et zones agricoles.

- Route : `POST /api/v1/instances/:instanceId/groups` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `CreateGroupUseCase` -> verifie existence instance -> `GroupRepository.create()`

```json
POST /api/v1/instances/:instanceId/groups
{ "name": "Agriculture", "slug": "agriculture", "icon": "agriculture", "color": "#4CAF50" }
```

### 3.4 Mise a Jour d'un Groupe

- Route : `PATCH /api/v1/instances/:instanceId/groups/:id` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `UpdateGroupUseCase`

### 3.5 Suppression d'un Groupe

- Route : `DELETE /api/v1/instances/:instanceId/groups/:id` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `DeleteGroupUseCase` (cascade : supprime sous-groupes et couches)

### 3.6 Reordonnancement des Groupes

**Description** : Modifie l'ordre d'affichage des groupes dans le panneau lateral du geoportail.

**Cas d'usage** : L'administrateur souhaite mettre la thematique "Sante" avant "Transport" dans le menu.

- Route : `PATCH /api/v1/instances/:instanceId/groups/reorder` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `ReorderGroupsUseCase`

```json
PATCH /api/v1/instances/:instanceId/groups/reorder
{ "items": [{ "id": "uuid-sante", "order": 0 }, { "id": "uuid-transport", "order": 1 }] }
```

---

## 4. Sous-thematiques (Sous-groupes)

Les sous-groupes permettent un second niveau de categorisation au sein d'un groupe thematique.

### 4.1 Liste des Sous-groupes

**Description** : Retourne les sous-groupes d'un groupe thematique donne.

**Cas d'usage** : Dans le groupe "Sante", on affiche les sous-groupes "Hopitaux", "Pharmacies", "Centres de sante".

- Route : `GET /api/v1/groups/:groupId/sub-groups` (authentifie) (`sub-group.routes.ts`)
- Use case : `ListSubGroupsUseCase`
- Modele BD : `SubGroup` (id, name, slug, description, icon, order, isActive, groupId)

### 4.2 Detail d'un Sous-groupe

- Route : `GET /api/v1/groups/:groupId/sub-groups/:id`

### 4.3 Creation d'un Sous-groupe

**Cas d'usage** : L'administrateur cree le sous-groupe "Ecoles primaires" dans le groupe "Education".

- Route : `POST /api/v1/groups/:groupId/sub-groups` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `CreateSubGroupUseCase` -> verifie existence du groupe parent -> `SubGroupRepository.create()`

### 4.4 Mise a Jour d'un Sous-groupe

- Route : `PATCH /api/v1/groups/:groupId/sub-groups/:id` (SUPER_ADMIN, ADMIN_INSTANCE)

### 4.5 Suppression d'un Sous-groupe

- Route : `DELETE /api/v1/groups/:groupId/sub-groups/:id` (SUPER_ADMIN, ADMIN_INSTANCE)
- Cascade : supprime les couches associees

---

## 5. Couches (Layers)

Les couches sont le coeur du systeme. Chaque couche represente un jeu de donnees geographiques (ecoles, routes, hopitaux...) stocke dans PostGIS et publie via QGIS Server en WMS/WFS.

### 5.1 Liste des Couches

**Description** : Retourne les couches d'une instance avec pagination et filtrage. Inclut les metadonnees : type de geometrie, source, visibilite, opacite.

**Cas d'usage** : Le geoportail charge la liste des couches disponibles pour construire l'arbre thematique dans le panneau lateral.

**Implementation technique** :
- Route : `GET /api/v1/instances/:instanceId/layers` (authentifie) (`layer.routes.ts`)
- Use case : `ListLayersUseCase` -> `LayerRepository.findByInstanceId()`
- Modele BD : `Layer` (id, name, slug, geometryType, sourceType, sourceUrl, tableName, schemaName, minZoom, maxZoom, isVisible, isQueryable, opacity, subGroupId, instanceId, qgisProjectId)

### 5.2 Detail d'une Couche

- Route : `GET /api/v1/instances/:instanceId/layers/:id` (authentifie)
- Use case : `GetLayerUseCase`

### 5.3 Creation d'une Couche

**Description** : Cree une nouvelle couche cartographique. Lors de la creation, la couche est automatiquement indexee dans MeiliSearch pour la recherche.

**Cas d'usage** : L'editeur cree une couche "Ecoles primaires" de type POINT dans l'instance Cameroun, rattachee au sous-groupe "Education primaire".

- Route : `POST /api/v1/instances/:instanceId/layers` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `CreateLayerUseCase` -> `LayerRepository.create()` -> `IndexLayerUseCase` (indexation MeiliSearch)

```json
POST /api/v1/instances/:instanceId/layers
{
  "name": "Ecoles primaires",
  "slug": "ecoles-primaires",
  "geometryType": "POINT",
  "sourceType": "WFS",
  "tableName": "ecoles_primaires",
  "schemaName": "cameroun",
  "subGroupId": "uuid-sous-groupe-education"
}
```

### 5.4 Mise a Jour d'une Couche

- Route : `PATCH /api/v1/instances/:instanceId/layers/:id` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `UpdateLayerUseCase` -> met a jour -> reindexe dans MeiliSearch

### 5.5 Suppression d'une Couche

- Route : `DELETE /api/v1/instances/:instanceId/layers/:id` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `DeleteLayerUseCase` -> supprime couche -> `RemoveLayerIndexUseCase` (supprime index MeiliSearch)

### 5.6 Statistiques de Couche

**Description** : Retourne les statistiques d'une couche : nombre de features, emprise spatiale (bbox), nombre de colonnes.

**Cas d'usage** : L'administrateur veut verifier combien d'ecoles ont ete importees dans la couche.

- Route : `POST /api/v1/geoportail/layers/:layerId/stats` (authentifie) (`geoportail.routes.ts`)
- Use case : `GetLayerStatsUseCase` -> `PostGISService` -> requetes SQL sur la table PostGIS

**Flux de donnees** : Route -> GetLayerStatsUseCase -> LayerRepository.findById() -> PostGISService.getTableStats(schemaName, tableName) -> `SELECT count(*), ST_Extent(geom) FROM schema.table` -> reponse

### 5.7 Recuperation du Fichier Source

**Description** : Genere une URL presignee pour telecharger le fichier source original d'une couche depuis le stockage MinIO.

- Route : `GET /api/v1/instances/:instanceId/layers/:id/source-file` (authentifie)
- Use case : `GetSourceFileUseCase` -> `LayerRepository.findById()` -> `StorageService.getPresignedUrl()`

---

## 6. Features (Entites geographiques)

Gestion CRUD des entites geographiques individuelles (points, lignes, polygones) au sein d'une couche. Les operations sont effectuees directement sur les tables PostGIS.

### 6.1 Liste des Features

**Description** : Retourne les features d'une couche en format GeoJSON avec support du filtrage par bounding box, pagination par limit/offset.

**Cas d'usage** : Le geoportail charge les ecoles visibles dans la vue actuelle de la carte.

**Implementation technique** :
- Route : `GET /api/v1/layers/:layerId/features` (authentifie) (`feature.routes.ts`)
- Use case : `GetFeaturesUseCase` -> `PostGISService.getFeatures(tableName, { bbox, limit, offset })`
- SQL : `SELECT gid, ST_AsGeoJSON(geom) as geometry, hstore_to_json(tags) FROM schema.table WHERE ST_Intersects(geom, ST_MakeEnvelope(xmin, ymin, xmax, ymax, 4326)) LIMIT $limit OFFSET $offset`

```
GET /api/v1/layers/:layerId/features?bbox=11.5,3.8,11.6,3.9&limit=100&offset=0
```

### 6.2 Detail d'une Feature

- Route : `GET /api/v1/layers/:layerId/features/:featureId` (authentifie)
- Use case : `GetFeatureUseCase` -> `PostGISService.getFeature()`

### 6.3 Ajout d'une Feature

**Description** : Insere une nouvelle entite geographique dans la table PostGIS de la couche.

**Cas d'usage** : Un editeur ajoute manuellement une nouvelle ecole detectee sur le terrain.

- Route : `POST /api/v1/layers/:layerId/features` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `AddFeatureUseCase` -> `PostGISService.insertFeature()`
- SQL : `INSERT INTO schema.table (geom, ...) VALUES (ST_SetSRID(ST_GeomFromGeoJSON($geometry), 4326), ...)`

```json
POST /api/v1/layers/:layerId/features
{
  "geometry": { "type": "Point", "coordinates": [11.52, 3.87] },
  "properties": { "name": "Ecole de Bastos", "type": "primaire" }
}
```

### 6.4 Modification d'une Feature

- Route : `PATCH /api/v1/layers/:layerId/features/:featureId` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `UpdateFeatureUseCase` -> `PostGISService.updateFeature()`

### 6.5 Suppression d'une Feature

- Route : `DELETE /api/v1/layers/:layerId/features/:featureId` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `DeleteFeatureUseCase` -> `PostGISService.deleteFeature()`

---

## 7. Donnees OpenStreetMap

Integration des donnees OSM brutes importees via osm2pgsql. Permet d'interroger les tables `planet_osm_point/line/polygon` et de creer des tables thematiques derivees.

### 7.1 Import des Donnees OSM Brutes (osm2pgsql)

**Description** : Lance l'importation d'un fichier PBF OpenStreetMap dans la base PostGIS via l'outil osm2pgsql. Supporte les modes creation et append (mise a jour incrementale).

**Cas d'usage** : Le super administrateur importe le dernier extract OSM du Cameroun (cameroun-latest.osm.pbf) pour mettre a jour les donnees de base.

**Implementation technique** :
- Route : `POST /api/v1/admin/osm/import` (SUPER_ADMIN) (`admin.routes.ts`)
- Use case : `ImportOsmDataUseCase` -> `Osm2pgsqlService.import()`
- Service : `Osm2pgsqlService` (`src/infrastructure/osm/osm2pgsql.service.ts`) execute la commande `osm2pgsql` en sous-processus

```json
POST /api/v1/admin/osm/import
{
  "pbfPath": "/data/osm/cameroun-latest.osm.pbf",
  "slim": true,
  "append": false,
  "cache": 2000
}
```

### 7.2 Requete par Tags OSM

**Description** : Permet d'interroger les tables OSM importees par combinaison de tags (cle=valeur). Retourne les resultats en GeoJSON avec filtrage optionnel par bbox et par type de geometrie (point, line, polygon).

**Cas d'usage** : L'administrateur recherche toutes les ecoles (`amenity=school`) dans une zone specifique du Cameroun.

**Implementation technique** :
- Route : `POST /api/v1/osm/query` (authentifie) (`osm.routes.ts`)
- Use case : `QueryOsmUseCase` -> `OsmQueryService.query()`
- SQL : `SELECT osm_id, name, ST_AsGeoJSON(way) FROM planet_osm_point WHERE amenity = 'school' AND way && ST_MakeEnvelope(...)`

```json
POST /api/v1/osm/query
{
  "tables": ["point"],
  "conditions": [{ "key": "amenity", "value": "school" }],
  "bbox": [11.4, 3.7, 11.7, 4.0],
  "limit": 500
}
```

### 7.3 Creation de Table Thematique depuis OSM

**Description** : Cree une nouvelle table PostGIS a partir d'une selection de donnees OSM. Permet de materialiser les resultats d'une requete OSM en table persistante, optionnellement decoupee par une limite administrative.

**Cas d'usage** : L'administrateur cree la table `cameroun.ecoles` a partir des donnees `amenity=school` d'OSM, decoupee par les limites administratives du Cameroun.

**Implementation technique** :
- Route : `POST /api/v1/osm/create-table` (SUPER_ADMIN) (`osm.routes.ts`)
- Use case : `CreateOsmTableUseCase` -> `OsmQueryService.createTable()`
- SQL : `CREATE TABLE schema.table AS SELECT * FROM planet_osm_point WHERE amenity = 'school' AND ST_Within(way, (SELECT geom FROM boundary_table WHERE id = $id))`

```json
POST /api/v1/osm/create-table
{
  "schema": "cameroun",
  "table": "ecoles",
  "sourceTable": "planet_osm_point",
  "conditions": [{ "key": "amenity", "value": "school" }],
  "boundaryTable": "admin_boundaries",
  "boundaryId": 1,
  "boundaryGeomColumn": "geom"
}
```

---

## 8. Styles et Symbologie

Gestion des styles visuels des couches : SLD pour QGIS Server, Mapbox GL Style pour le rendu client.

### 8.1 Consultation du Style

**Description** : Retourne les styles associes a une couche (SLD et/ou Mapbox GL Style).

- Route : `GET /api/v1/layers/:layerId/style` (authentifie) (`style.routes.ts`)
- Use case : `GetLayerStyleUseCase` -> `LayerStyleRepository.findByLayerId()`
- Modele BD : `LayerStyle` (id, name, sldBody, mapboxStyle, isDefault, layerId)

### 8.2 Mise a Jour du Style SLD

**Description** : Applique un nouveau style SLD (Styled Layer Descriptor) a une couche. Le SLD est utilise par QGIS Server pour le rendu WMS.

**Cas d'usage** : L'administrateur modifie la couleur des polygones de limites administratives du rouge au bleu.

- Route : `PUT /api/v1/layers/:layerId/style/sld` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `UpdateLayerStyleUseCase`

```json
PUT /api/v1/layers/:layerId/style/sld
{ "sldBody": "<?xml version=\"1.0\"?><StyledLayerDescriptor>...</StyledLayerDescriptor>" }
```

### 8.3 Mise a Jour du Style Mapbox

**Description** : Applique un style Mapbox GL JSON pour le rendu vectoriel cote client.

- Route : `PUT /api/v1/layers/:layerId/style/mapbox` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)

```json
PUT /api/v1/layers/:layerId/style/mapbox
{ "mapboxStyle": { "fill-color": "#3388ff", "fill-opacity": 0.6, "line-color": "#2255aa" } }
```

### 8.4 Reinitialisation du Style

**Description** : Remet le style par defaut sur une couche, supprimant les personnalisations.

- Route : `POST /api/v1/layers/:layerId/style/reset` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- Use case : `ResetLayerStyleUseCase`

### 8.5 Styles par Defaut

**Description** : Liste les styles par defaut disponibles dans le systeme.

- Route : `GET /api/v1/layers/:layerId/style/defaults` (authentifie)
- Use case : `ListDefaultStylesUseCase`

---

## 9. Export de Donnees

Systeme d'export asynchrone de couches geographiques en differents formats, traite par des workers BullMQ.

### 9.1 Creation d'un Export

**Description** : Lance un export asynchrone d'une couche dans un format specifique. L'export est place dans une file d'attente BullMQ et traite par un worker dedie.

**Cas d'usage** : Un chercheur veut telecharger les donnees des ecoles du Cameroun en format Shapefile pour les analyser dans QGIS Desktop.

**Implementation technique** :
- Route : `POST /api/v1/exports` (authentifie) (`export.routes.ts`)
- Use case : `CreateExportUseCase` -> `ExportRepository.create()` -> `QueueService.addJob('layer-export', ...)`
- Worker : `createExportProcessor` (`src/infrastructure/queue/workers/export.worker.js`) -> `Ogr2OgrService.export()` -> upload vers MinIO
- Modele BD : `Export` (id, format, status [PENDING/PROCESSING/COMPLETED/FAILED], layerId, userId, filePath, fileSize, bbox)

```json
POST /api/v1/exports
{
  "layerId": "uuid-couche",
  "format": "SHAPEFILE",
  "bbox": [11.4, 3.7, 11.7, 4.0]
}
```

**Reponse** :
```json
{ "success": true, "data": { "id": "uuid-export", "status": "PENDING", "format": "SHAPEFILE" } }
```

### 9.2 Formats Supportes

- **GEOJSON** : Format JSON standard pour les donnees geographiques
- **SHAPEFILE** : Archive ZIP contenant .shp, .dbf, .shx, .prj
- **GEOPACKAGE** : Format OGC SQLite (.gpkg)
- **KML** : Google Earth / Maps
- **CSV** : Tableur avec coordonnees en colonnes
- **PDF** : Document cartographique

### 9.3 Liste des Exports

- Route : `GET /api/v1/exports` (authentifie, filtre par userId)
- Parametres : `?page=1&limit=20&status=COMPLETED`

### 9.4 Detail d'un Export

- Route : `GET /api/v1/exports/:id` (authentifie)

### 9.5 Telechargement

**Description** : Retourne l'URL de telechargement du fichier exporte.

- Route : `GET /api/v1/exports/:id/download` (authentifie)
- Retourne : `{ downloadUrl: "/downloads/exports/uuid.shp.zip" }`

Egalement disponible via l'upload route :
- Route : `GET /api/v1/layers/exports/:exportId/download` (authentifie)
- Use case : `DownloadExportUseCase` -> `StorageService.getPresignedUrl()`

### 9.6 Suppression d'un Export

- Route : `DELETE /api/v1/exports/:id` (authentifie)

---

## 10. Import de Donnees

Pipeline d'importation de fichiers geospatiaux dans PostGIS, traite de maniere asynchrone via BullMQ.

### 10.1 Upload et Import

**Description** : Permet d'uploader un fichier geospatial et de l'importer dans la table PostGIS d'une couche. Le fichier est d'abord stocke dans MinIO, puis un job d'import est ajoute a la file BullMQ.

**Cas d'usage** : L'editeur uploade un fichier GeoJSON des ecoles primaires collectees sur le terrain pour les ajouter a la couche correspondante.

**Implementation technique** :
- Route : `POST /api/v1/layers/:layerId/import` (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR) (`upload.routes.ts`)
- Use case : `ImportLayerUseCase` -> `StorageService.upload()` -> `QueueService.addJob('layer-import', ...)`
- Worker : `createLayerImportProcessor` -> `Ogr2OgrService.importToPostGIS()` -> `PostGISService` -> notification WebSocket
- Taille max : 100 MB
- Detection automatique du format par extension

```
POST /api/v1/layers/:layerId/import
Content-Type: multipart/form-data
[file: ecoles.geojson]
```

**Reponse** (HTTP 202 Accepted) :
```json
{ "success": true, "data": { "exportId": "uuid", "status": "PENDING", "message": "Import queued" } }
```

### 10.2 Formats Supportes

- GeoJSON (.geojson, .json)
- Shapefile (.zip contenant .shp)
- GeoPackage (.gpkg)
- KML (.kml)
- CSV (.csv avec colonnes lat/lon)

### 10.3 Worker d'Import (BullMQ)

**Flux de donnees** : Worker recoit le job -> telecharge fichier depuis MinIO -> `Ogr2OgrService.importToPostGIS()` (commande ogr2ogr) -> met a jour statut export en BD -> envoie notification WebSocket au client -> nettoie fichier temporaire

---

## 11. Projets QGIS et Scripts PyQGIS

Gestion des projets QGIS (.qgs) et execution de scripts Python QGIS pour manipuler les couches et styles.

### 11.1 Consultation du Projet QGIS

**Description** : Retourne les informations du projet QGIS associe a une instance.

- Route : `GET /api/v1/instances/:instanceId/qgis-project` (authentifie) (`qgis-project.routes.ts`)
- Use case : `GetQgisProjectUseCase`
- Modele BD : `QgisProject` (id, name, filePath, description, instanceId)

### 11.2 Rechargement du Projet QGIS

**Description** : Force le rechargement de toutes les couches du projet QGIS. Utile apres ajout de nouvelles couches ou modification de la structure des tables.

- Route : `POST /api/v1/instances/:instanceId/qgis-project/reload` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `ReloadQgisProjectUseCase`

### 11.3 Scripts PyQGIS

Le service `QGISProjectService` (`src/infrastructure/qgis/qgis-project.service.ts`) orchestre l'execution des 14 scripts Python situes dans `python_scripts/`. Chaque script est execute en sous-processus avec `python3` et retourne un resultat JSON.

#### 11.3.1 Ajout de Couche Vectorielle (`add_vector_layer.py`)

**Description** : Ajoute une couche vectorielle au projet QGIS. Supporte l'application de style QML et d'icone SVG pour les couches ponctuelles avec rendu par cluster.

**Parametres** : `<project_path> <layer_path> <layer_name> [style_path] [icon_path] [icon_color]`

#### 11.3.2 Ajout de Couche Raster (`add_raster_layer.py`)

**Description** : Ajoute une couche raster (GeoTIFF) au projet QGIS avec style optionnel.

**Parametres** : `<project_path> <raster_path> <layer_name> [style_path]`

#### 11.3.3 Application de Style QML (`set_style.py`)

**Description** : Charge et applique un fichier de style QML a une couche existante dans le projet.

**Parametres** : `<project_path> <layer_name> <qml_path>`

#### 11.3.4 Icones SVG sur Couches Ponctuelles (`set_icon_on_layer.py`)

**Description** : Configure un rendu par cluster avec icone SVG sur une couche ponctuelle. Definit la taille, la couleur et la tolerance de clustering.

**Parametres** : `<project_path> <layer_name> <icon_path> [icon_size] [icon_color]`

#### 11.3.5 Export de Couche (`export_layer.py`)

**Description** : Exporte une couche du projet QGIS vers un fichier dans le format specifie (GeoJSON, GPKG, Shapefile...) via `QgsVectorFileWriter`.

**Parametres** : `<project_path> <layer_name> <output_path> <format>`

#### 11.3.6 Clip/Decoupage (`clip_export.py`, `download_data.py`)

**Description** : Decoupe une couche par une geometrie de limite (boundary) en utilisant l'algorithme `native:clip` de QGIS Processing. Deux scripts pour des flux differents.

**Parametres** : `<project_path> <layer_name> <boundary_geojson_path> <output_path>`

#### 11.3.7 Information Couche (`get_layer_info.py`)

**Description** : Retourne les informations detaillees d'une couche : nom, CRS, emprise, nombre de features, type de geometrie, liste des champs avec leurs types, type de renderer.

**Parametres** : `<project_path> <layer_name>`

#### 11.3.8 Rechargement Projet (`reload_project.py`)

**Description** : Recharge toutes les couches du projet pour prendre en compte les modifications de donnees.

**Parametres** : `<project_path>`

#### 11.3.9 Suppression de Couche (`remove_layer.py`)

**Description** : Supprime une couche du projet QGIS et sauvegarde.

**Parametres** : `<project_path> <layer_name>`

#### 11.3.10 Sauvegarde de Style (`save_style.py`)

**Description** : Exporte le style actuel d'une couche vers un fichier QML.

**Parametres** : `<project_path> <layer_name> <output_qml_path>`

#### 11.3.11 Edition des Proprietes (`edit_layer_properties.py`)

**Description** : Modifie les proprietes d'affichage d'une couche : opacite, visibilite, zoom min/max, CRS.

**Parametres** : `<project_path> <layer_name> <properties_json>`

#### 11.3.12 Configuration WMS (`setup_wms_capabilities.py`)

**Description** : Configure les capabilities WMS du projet : titre, resume, contact, organisation, liste CRS supportes, emprise. Active egalement le WFS sur toutes les couches.

**Parametres** : `<project_path> <config_json>`

#### 11.3.13 Configuration WFS (`configure_wfs.py`)

**Description** : Active le service WFS sur des couches specifiques du projet.

**Parametres** : `<project_path> <layer_names_json>`

---

## 12. Proxy WMS/WFS (QGIS Server)

### 12.1 Proxy WMS

**Description** : Relaie les requetes WMS vers QGIS Server. Permet au frontend d'acceder aux tuiles cartographiques rendues par QGIS sans exposer directement le serveur.

**Cas d'usage** : Le geoportail affiche les couches en WMS (GetMap, GetCapabilities, GetFeatureInfo) via ce proxy.

**Implementation technique** :
- Route : `GET /api/v1/wms` (`wms-proxy.routes.ts`)
- Service : `QgisServerService.proxyWmsRequest(params, mapPath)`
- Pas d'authentification requise (acces public)

```
GET /api/v1/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=ecoles&BBOX=11.4,3.7,11.7,4.0&WIDTH=256&HEIGHT=256&FORMAT=image/png&MAP=/data/qgis/cameroun.qgs
```

### 12.2 Proxy WFS

**Description** : Relaie les requetes WFS vers QGIS Server pour l'acces aux donnees vectorielles.

- Route : `GET /api/v1/wfs`
- Service : `QgisServerService.proxyWfsRequest(params, mapPath)`

---

## 13. Geoportail

Fonctionnalites geographiques specifiques du geoportail.

### 13.1 Altitude (SRTM)

**Description** : Retourne l'altitude d'un point geographique a partir des donnees SRTM stockees en raster PostGIS.

**Cas d'usage** : Un utilisateur clique sur la carte et voit l'altitude du point (ex: 720m pour un point dans les montagnes de l'Ouest Cameroun).

**Implementation technique** :
- Route : `POST /api/v1/geoportail/altitude` (`geoportail.routes.ts`)
- Service : `PostGISService.getAltitude(lon, lat)` -> `SELECT ST_Value(rast, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)) FROM srtm_raster`

```json
POST /api/v1/geoportail/altitude
{ "lon": 10.15, "lat": 5.95 }
```

**Reponse** :
```json
{ "success": true, "data": { "lon": 10.15, "lat": 5.95, "altitude": 720.5 } }
```

### 13.2 Profil Altimetrique

**Description** : Calcule un profil d'elevation le long d'une ligne (LineString) en echantillonnant N points equidistants et en recuperant leur altitude depuis les donnees SRTM.

**Cas d'usage** : Un ingenieur routier trace une route et visualise les variations d'altitude le long du trace.

- Route : `POST /api/v1/geoportail/elevation-profile`
- Service : `PostGISService.drapeElevationProfile(geometry, numPoints)`

```json
POST /api/v1/geoportail/elevation-profile
{
  "geometry": { "type": "LineString", "coordinates": [[10.1, 5.9], [10.2, 6.0], [10.3, 6.1]] },
  "numPoints": 50
}
```

### 13.3 Limites Administratives

**Description** : Trouve les limites administratives (pays, region, departement, commune) contenant un point donne.

**Cas d'usage** : L'utilisateur clique sur la carte et voit : "Cameroun > Region du Centre > Mfoundi > Yaounde".

- Route : `GET /api/v1/geoportail/admin-boundary?lat=3.87&lon=11.52`
- Use case : `FindAdminBoundaryUseCase` -> requete SQL avec `ST_Contains(geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326))`

### 13.4 Geolocalisation IP

**Description** : Determine la localisation geographique approximative de l'utilisateur a partir de son adresse IP.

**Cas d'usage** : A l'ouverture du geoportail, la carte se centre automatiquement sur la position estimee de l'utilisateur.

- Route : `GET /api/v1/geoportail/geolocate`
- Use case : `GeolocateIpUseCase` -> utilise `request.ip`

### 13.5 Recherche de Limites dans une Table

**Description** : Recherche les entites d'une table specifique qui contiennent un point donne.

- Route : `GET /api/v1/geoportail/search-limit?lat=3.87&lon=11.52&table=cameroun.regions`
- Use case : `SearchLimitInTableUseCase`

### 13.6 Sauvegarde de Coordonnees en PDF

**Description** : Genere un document PDF contenant une liste de coordonnees geographiques pour une instance donnee.

- Route : `POST /api/v1/geoportail/save-coord-pdf` (authentifie)
- Use case : `SaveCoordPdfUseCase`

---

## 14. Geocodage (Nominatim)

Integration du service de geocodage Nominatim pour la recherche d'adresses et de lieux.

### 14.1 Recherche d'Adresses

**Description** : Recherche de lieux/adresses par texte libre. Retourne les resultats avec coordonnees et informations detaillees.

**Cas d'usage** : L'utilisateur tape "Marche Central Yaounde" dans la barre de recherche et obtient la localisation exacte.

**Implementation technique** :
- Route : `GET /api/v1/geocode/search?q=Marche+Central+Yaounde&limit=5` (`geocoding.routes.ts`)
- Use case : `SearchGeocodingUseCase` -> `NominatimService.search()`
- Service : requete HTTP vers l'instance Nominatim configuree

### 14.2 Geocodage Inverse

**Description** : A partir de coordonnees GPS, retourne l'adresse correspondante.

**Cas d'usage** : L'utilisateur clique sur la carte et voit l'adresse du point clique.

- Route : `GET /api/v1/geocode/reverse?lat=3.87&lon=11.52`
- Use case : `ReverseGeocodingUseCase` -> `NominatimService.reverse()`

### 14.3 Lookup par OSM ID

**Description** : Recupere les informations detaillees d'un ou plusieurs objets OSM par leurs identifiants.

- Route : `GET /api/v1/geocode/lookup?osm_ids=R192830,N12345`
- Use case : `LookupGeocodingUseCase` -> `NominatimService.lookup()`

---

## 15. Itineraires (OSRM)

Integration du service OSRM (Open Source Routing Machine) pour le calcul d'itineraires.

### 15.1 Calcul d'Itineraire

**Description** : Calcule le meilleur itineraire entre deux ou plusieurs points. Supporte differents profils (voiture, velo, pieton) et peut retourner des alternatives.

**Cas d'usage** : L'utilisateur trace un itineraire de Douala a Yaounde et voit la distance (240 km), la duree estimee et le trace sur la carte.

**Implementation technique** :
- Route : `GET /api/v1/routing/route?coordinates=9.7,4.05;11.52,3.87&profile=car&alternatives=true&steps=true` (`routing.routes.ts`)
- Use case : `CalculateRouteUseCase` -> `OSRMService.route()`
- Service : requete HTTP vers l'instance OSRM configuree

### 15.2 Point le Plus Proche

**Description** : Trouve le point le plus proche sur le reseau routier a partir d'une coordonnee.

- Route : `GET /api/v1/routing/nearest?lon=11.52&lat=3.87&number=3`
- Use case : `FindNearestUseCase` -> `OSRMService.nearest()`

---

## 16. Recherche (MeiliSearch)

Moteur de recherche full-text base sur MeiliSearch pour la recherche de couches et de features.

### 16.1 Recherche Globale

**Description** : Recherche transversale sur tous les index (couches, features) par texte libre.

**Cas d'usage** : L'utilisateur tape "ecoles" et obtient les couches et features contenant ce terme.

**Implementation technique** :
- Route : `GET /api/v1/search?q=ecoles&limit=10` (`search.routes.ts`)
- Use case : `GlobalSearchUseCase` -> `MeiliSearchService.multiSearch()`
- Service : `MeiliSearchService` (`src/infrastructure/external-apis/meilisearch.service.ts`)

### 16.2 Recherche de Couches

**Description** : Recherche specifiquement dans les couches d'une instance.

- Route : `GET /api/v1/search/layers?q=ecoles&instanceId=uuid&limit=10&offset=0`
- Use case : `SearchLayersUseCase`

### 16.3 Recherche de Features

**Description** : Recherche dans les features (entites) d'une couche specifique.

- Route : `GET /api/v1/search/features?q=bastos&layerId=uuid&limit=10&offset=0`
- Use case : `SearchFeaturesUseCase`

### 16.4 Indexation d'une Couche

**Description** : Cree ou met a jour l'index MeiliSearch pour une couche. Appele automatiquement lors de la creation/modification de couche.

- Use case : `IndexLayerUseCase` -> `MeiliSearchService.addDocuments()`

### 16.5 Suppression d'Index

- Use case : `RemoveLayerIndexUseCase` -> `MeiliSearchService.deleteIndex()`

---

## 17. Analyse Spatiale

Operations d'analyse spatiale executees via PostGIS.

### 17.1 Analyse Spatiale Generique

**Description** : Execute une operation spatiale (buffer, intersection, union, difference) sur une ou deux geometries. Les calculs sont effectues cote serveur via les fonctions PostGIS.

**Cas d'usage** : Un urbaniste cree une zone tampon de 500m autour d'une ecole pour identifier les batiments a proximite.

**Implementation technique** :
- Route : `POST /api/v1/analysis/spatial` (`analysis.routes.ts`)
- Use case : `SpatialAnalysisUseCase`
- Operations supportees :
  - **buffer** : `ST_Buffer(geometry, distance)` -- zone tampon
  - **intersection** : `ST_Intersection(geomA, geomB)` -- partie commune
  - **union** : `ST_Union(geomA, geomB)` -- fusion
  - **difference** : `ST_Difference(geomA, geomB)` -- soustraction

```json
POST /api/v1/analysis/spatial
{
  "operation": "buffer",
  "geometryA": { "type": "Point", "coordinates": [11.52, 3.87] },
  "distance": 500,
  "srid": 4326
}
```

**Reponse** :
```json
{ "success": true, "data": { "type": "Polygon", "coordinates": [...] } }
```

---

## 18. Gestion des Rasters

Upload, telechargement et interrogation de donnees raster (GeoTIFF).

### 18.1 Upload de Raster

**Description** : Uploade un fichier raster (GeoTIFF) et l'importe dans PostGIS via raster2pgsql. Le fichier est temporairement stocke sur disque puis importe.

**Cas d'usage** : L'administrateur importe un modele numerique de terrain (MNT) pour activer la fonctionnalite d'altitude.

**Implementation technique** :
- Route : `POST /api/v1/rasters/upload` (multipart, SUPER_ADMIN, ADMIN_INSTANCE) (`raster.routes.ts`)
- Use case : `UploadRasterUseCase` -> `RasterService.importRaster()` -> `StorageService`
- Service : `RasterService` (`src/infrastructure/gdal/raster.service.ts`) execute `raster2pgsql`

### 18.2 Telechargement de Raster

**Description** : Exporte un raster stocke en base PostGIS vers un fichier dans le format demande.

- Route : `POST /api/v1/rasters/download` (authentifie)
- Use case : `DownloadRasterUseCase` -> `RasterService.exportRaster()`

```json
POST /api/v1/rasters/download
{ "tableName": "srtm_cameroun", "format": "GTiff" }
```

### 18.3 Informations sur un Raster

**Description** : Retourne les metadonnees d'un fichier raster : dimensions, CRS, nombre de bandes, resolution.

- Route : `POST /api/v1/rasters/info` (authentifie)
- Service : `RasterService.getRasterInfo(filePath)` -> execute `gdalinfo`

---

## 19. Adressage

Systeme d'adressage geographique specifique pour la localisation par coordonnees et recherche d'adresses dans les donnees locales.

### 19.1 Recuperation d'Adresse par Geometrie

**Description** : Retrouve l'adresse associee a une entite dans une table PostGIS specifique.

- Route : `POST /api/v1/adressage/adresse` (`adressage.routes.ts`)
- Use case : `GetAdresseUseCase` -> `AdressageService`

```json
POST /api/v1/adressage/adresse
{ "shema": "cameroun", "table": "adresses", "geom": "POINT(11.52 3.87)" }
```

### 19.2 Position a partir d'une Adresse

**Description** : Retourne les coordonnees GPS a partir d'une adresse textuelle dans les donnees locales.

- Route : `POST /api/v1/adressage/position`
- Use case : `GetPositionUseCase`

### 19.3 Points le Long d'une Rue

**Description** : Retourne les points d'adressage situes le long d'une rue specifique.

- Route : `POST /api/v1/adressage/points`
- Use case : `GetPointsUseCase`

### 19.4 Recherche par Usage

**Description** : Recherche des adresses par type d'usage (residentiel, commercial...).

- Route : `POST /api/v1/adressage/search`
- Use case : `SearchAdresseUseCase`

### 19.5 Adresse par Clic

**Description** : Retourne l'adresse la plus proche d'un point clique sur la carte.

- Route : `POST /api/v1/adressage/click`
- Use case : `GetAdresseByClickUseCase`

```json
POST /api/v1/adressage/click
{ "coord": [11.52, 3.87] }
```

### 19.6 Codes d'Usage

**Description** : Retourne la liste des codes d'usage disponibles pour l'adressage.

- Route : `GET /api/v1/adressage/code-usage`
- Use case : `CodeUsageUseCase`

### 19.7 Donnees Elastiques

**Description** : Recupere des donnees formatees pour Elasticsearch a partir de tables PostGIS.

- Route : `POST /api/v1/adressage/elastic-data`
- Service : `AdressageService.getElasticData()`

---

## 20. Dessins (Drawings)

Permet aux utilisateurs de sauvegarder et gerer des dessins (annotations geographiques) sur la carte.

### 20.1 Liste des Dessins

**Description** : Retourne les dessins d'un utilisateur pour une instance donnee.

- Route : `GET /api/v1/drawings?instanceId=uuid` (authentifie) (`drawing.routes.ts`)
- Use case : `GetDrawingsUseCase`
- Modele BD : `Drawing` (id, userId, instanceId, name, geojson, description, isPublic)

### 20.2 Detail d'un Dessin

- Route : `GET /api/v1/drawings/:id` (authentifie)

### 20.3 Creation d'un Dessin

**Description** : Sauvegarde un dessin GeoJSON (polygone, ligne, marqueur) sur la carte.

**Cas d'usage** : Un responsable municipal dessine les zones inondables sur la carte pour les partager avec son equipe.

- Route : `POST /api/v1/drawings` (authentifie)
- Use case : `SaveDrawingUseCase`

```json
POST /api/v1/drawings
{
  "instanceId": "uuid",
  "name": "Zones inondables Douala",
  "geojson": { "type": "FeatureCollection", "features": [...] },
  "description": "Zones identifiees en saison des pluies 2024",
  "isPublic": false
}
```

### 20.4 Suppression d'un Dessin

- Route : `DELETE /api/v1/drawings/:id` (authentifie, HTTP 204)

---

## 21. Partage de Cartes

Permet de generer des liens de partage avec un etat de carte specifique (couches visibles, centre, zoom).

### 21.1 Creation d'un Partage

**Description** : Genere un code court (8 caracteres) pour partager l'etat actuel de la carte. L'etat inclut les couches visibles, le centre, le zoom, etc. Possibilite de definir une date d'expiration.

**Cas d'usage** : Un utilisateur partage une vue montrant les ecoles et hopitaux de Yaounde avec un collegue via un lien court.

**Implementation technique** :
- Route : `POST /api/v1/share` (authentifie) (`sharing.routes.ts`)
- Use case : `CreateSharedMapUseCase` -> genere shortCode unique -> `SharedMapRepository.create()`
- Modele BD : `SharedMap` (id, userId, instanceId, mapState JSON, shortCode, expiresAt)

```json
POST /api/v1/share
{
  "instanceId": "uuid",
  "mapState": { "center": [11.52, 3.87], "zoom": 14, "layers": ["uuid-ecoles", "uuid-hopitaux"] },
  "expiresInDays": 30
}
```

**Reponse** :
```json
{ "success": true, "data": { "shortCode": "AbCd1234", "expiresAt": "2026-07-25T00:00:00Z" } }
```

### 21.2 Consultation d'un Partage

**Description** : Recupere l'etat de carte d'un lien de partage.

- Route : `GET /api/v1/share/:code` (public)
- Use case : `GetSharedMapUseCase`

---

## 22. Analytiques et Statistiques

Systeme de tracking d'evenements et de consultation de vues pour mesurer l'utilisation de la plateforme.

### 22.1 Tracking d'Evenement

**Description** : Enregistre un evenement utilisateur (consultation de couche, telechargement, partage...).

- Route : `POST /api/v1/analytics/track` (`analytics.routes.ts`)
- Use case : `TrackEventUseCase`
- Modele BD : `AnalyticsEvent` (id, eventType, userId, instanceId, layerId, metadata, ipAddress)

```json
POST /api/v1/analytics/track
{ "instanceId": "uuid", "eventType": "layer_view", "layerId": "uuid", "metadata": { "zoom": 14 } }
```

### 22.2 Increment de Vue

**Description** : Compteur de vues pour couches et instances.

- Route : `POST /api/v1/analytics/view`
- Use case : `IncrementViewUseCase`

```json
POST /api/v1/analytics/view
{ "type": "layer", "id": "uuid-couche" }
```

### 22.3 Consultation des Analytiques

**Description** : Retourne les statistiques agregees pour une instance sur une periode donnee (SUPER_ADMIN).

- Route : `GET /api/v1/analytics?instanceId=uuid&startDate=2026-01-01&endDate=2026-06-25` (SUPER_ADMIN)
- Use case : `GetAnalyticsUseCase`

---

## 23. Compositions de Cartes

Permet de sauvegarder des compositions de cartes (combinaison de couches avec styles specifiques).

### 23.1 Liste des Compositions

- Route : `GET /api/v1/instances/:instanceId/maps` (authentifie) (`map-composition.routes.ts`)
- Use case : `GetMapCompositionsUseCase`
- Modele BD : `MapComposition` (id, name, slug, description, instanceId, layers JSON, center JSON, zoom, isPublic, userId)

### 23.2 Detail d'une Composition

- Route : `GET /api/v1/instances/:instanceId/maps/:id` (authentifie)

### 23.3 Creation d'une Composition

**Description** : Cree une carte precombinee avec des couches, styles, opacites et un centre/zoom definis.

**Cas d'usage** : L'administrateur cree une carte "Infrastructures scolaires" regroupant les couches ecoles, colleges et universites.

- Route : `POST /api/v1/instances/:instanceId/maps` (authentifie)

```json
POST /api/v1/instances/:instanceId/maps
{
  "name": "Infrastructures scolaires",
  "slug": "infra-scolaires",
  "layers": [
    { "layerId": "uuid-ecoles", "opacity": 1, "visible": true },
    { "layerId": "uuid-colleges", "opacity": 0.8, "visible": true }
  ],
  "center": { "lat": 3.87, "lon": 11.52 },
  "zoom": 12,
  "isPublic": true
}
```

### 23.4 Mise a Jour d'une Composition

- Route : `PUT /api/v1/instances/:instanceId/maps/:id` (authentifie)

### 23.5 Suppression d'une Composition

- Route : `DELETE /api/v1/instances/:instanceId/maps/:id` (authentifie, HTTP 204)

---

## 24. Documents

Gestion de fichiers PDF et autres documents associes aux instances et couches.

### 24.1 Liste des Documents

- Route : `GET /api/v1/documents?instanceId=uuid&layerId=uuid` (authentifie) (`document.routes.ts`)
- Use case : `ListDocumentsUseCase`
- Modele BD : `Document` (id, name, description, filePath, fileSize, mimeType, layerId, instanceId, userId)

### 24.2 Detail d'un Document

- Route : `GET /api/v1/documents/:id` (authentifie)

### 24.3 Upload d'un Document

**Description** : Uploade un fichier document (PDF, image...) et le stocke dans MinIO. Le document est associe a une instance et optionnellement a une couche.

**Cas d'usage** : L'administrateur attache un rapport PDF de collecte de donnees a la couche "Ecoles primaires".

- Route : `POST /api/v1/documents` (authentifie, multipart)
- Use case : `UploadDocumentUseCase` -> `StorageService.upload()`

### 24.4 Suppression d'un Document

- Route : `DELETE /api/v1/documents/:id` (authentifie, HTTP 204)
- Use case : `DeleteDocumentUseCase` -> `StorageService.delete()` + supprime en BD

---

## 25. Catalogue Public

Expose un catalogue public des couches disponibles sans authentification.

### 25.1 Catalogue Global

**Description** : Retourne le catalogue hierarchique de toutes les instances publiques avec leurs groupes, sous-groupes et couches.

**Cas d'usage** : La page d'accueil publique affiche les donnees disponibles pour chaque pays.

- Route : `GET /api/v1/catalog` (`catalog.routes.ts`)
- Use case : `GetCatalogUseCase` -> requete Prisma avec includes imbriques

### 25.2 Catalogue par Instance

**Description** : Retourne le catalogue d'une instance specifique par son slug.

- Route : `GET /api/v1/catalog/:instanceSlug`

---

## 26. SEO (Metadonnees)

Generation de metadonnees pour le referencement (SEO) des pages du geoportail.

### 26.1 Metadonnees par Instance

**Description** : Retourne les metadonnees SEO (titre, description, Open Graph, canonical URL) pour une instance.

**Cas d'usage** : Le frontend genere les balises meta pour le referencement Google de la page "GeOSM Cameroun".

- Route : `GET /api/v1/seo/:instanceSlug` (`seo.routes.ts`)
- Use case : `GetSeoMetadataUseCase`

---

## 27. Fonds de Carte (Base Maps)

Gestion des fonds de carte (tuiles de fond) pour chaque instance.

### 27.1 Liste des Fonds de Carte

**Description** : Retourne les fonds de carte disponibles pour une instance (OpenStreetMap, satellite, etc.).

- Route : `GET /api/v1/instances/:instanceId/base-maps` (public) (`base-map.routes.ts`)
- Use case : `ListBaseMapsUseCase`
- Modele BD : `BaseMap` (id, name, slug, type [XYZ/WMS/WMTS/MAPBOX], url, thumbnail, attribution, isDefault, config, instanceId)

### 27.2 Creation d'un Fond de Carte

**Cas d'usage** : L'administrateur ajoute un fond de carte satellite Bing pour l'instance Cameroun.

- Route : `POST /api/v1/instances/:instanceId/base-maps` (SUPER_ADMIN, ADMIN_INSTANCE)

```json
POST /api/v1/instances/:instanceId/base-maps
{
  "name": "Satellite",
  "slug": "satellite",
  "type": "XYZ",
  "url": "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  "attribution": "Google Satellite",
  "isDefault": false
}
```

### 27.3 Mise a Jour d'un Fond de Carte

- Route : `PATCH /api/v1/instances/:instanceId/base-maps/:id` (SUPER_ADMIN, ADMIN_INSTANCE)

### 27.4 Suppression d'un Fond de Carte

- Route : `DELETE /api/v1/instances/:instanceId/base-maps/:id` (SUPER_ADMIN, ADMIN_INSTANCE)

---

## 28. Themes et Tags par Defaut

Systeme de themes et tags preconfigures pour standardiser la categorisation des couches a travers les instances.

### 28.1 Liste des Themes par Defaut

- Route : `GET /api/v1/default-themes` (public) (`default-theme.routes.ts`)
- Use case : `ListDefaultThemesUseCase`
- Modele BD : `DefaultTheme` (id, name, slug, icon, color, order) + `DefaultTag` (id, name, slug, themeId)

### 28.2 Detail d'un Theme

- Route : `GET /api/v1/default-themes/:id` (public)

### 28.3 Creation d'un Theme

- Route : `POST /api/v1/default-themes` (SUPER_ADMIN)

### 28.4 Mise a Jour d'un Theme

- Route : `PATCH /api/v1/default-themes/:id` (SUPER_ADMIN)

### 28.5 Suppression d'un Theme

- Route : `DELETE /api/v1/default-themes/:id` (SUPER_ADMIN)

### 28.6 Tags d'un Theme

- Route : `GET /api/v1/default-themes/:id/tags` (public)
- Route : `POST /api/v1/default-themes/:id/tags` (SUPER_ADMIN)

### 28.7 Pre-remplissage des Themes

**Description** : Initialise la base avec les themes par defaut (Education, Sante, Transport, etc.).

- Route : `POST /api/v1/default-themes/seed` (SUPER_ADMIN)
- Use case : `SeedDefaultThemesUseCase`

---

## 29. Administration

Endpoints reserves aux super administrateurs pour la gestion globale de la plateforme.

### 29.1 Tableau de Bord

**Description** : Retourne les statistiques globales : nombre d'instances, utilisateurs, exports, themes.

- Route : `GET /api/v1/admin/dashboard` (SUPER_ADMIN) (`admin.routes.ts`)
- Use case : `GetDashboardUseCase`

### 29.2 Sante Systeme

**Description** : Verifie la connectivite de tous les services : PostgreSQL, Redis, file d'attente.

- Route : `GET /api/v1/admin/health` (SUPER_ADMIN)
- Use case : `GetSystemHealthUseCase` -> teste Prisma.$queryRaw + Redis.ping()

### 29.3 Monitoring des Jobs

#### 29.3.1 Liste des Jobs

- Route : `GET /api/v1/admin/jobs` (SUPER_ADMIN)
- Use case : `ListJobsUseCase` -> `QueueService.getJobs()`

#### 29.3.2 Detail d'un Job

- Route : `GET /api/v1/admin/jobs/:id` (SUPER_ADMIN)
- Use case : `GetJobDetailsUseCase`

#### 29.3.3 Relance d'un Job Echoue

- Route : `POST /api/v1/admin/jobs/:id/retry` (SUPER_ADMIN)
- Use case : `RetryJobUseCase`

### 29.4 Generation d'Icones SVG

**Description** : Genere des icones SVG de marqueurs cartographiques dans differentes formes (cercle, carre, triangle, etoile, pin) et couleurs.

**Cas d'usage** : L'administrateur genere des icones personnalisees pour representer les hopitaux (croix rouge sur fond blanc).

- Route : `POST /api/v1/admin/icons/generate` (SUPER_ADMIN, ADMIN_INSTANCE)
- Use case : `GenerateIconUseCase` -> `SvgGeneratorService`
- Supporte la generation d'une seule icone ou d'un batch

```json
POST /api/v1/admin/icons/generate
{ "color": "#FF0000", "shape": "pin", "size": 32, "strokeColor": "#FFFFFF", "strokeWidth": 2, "label": "H" }
```

### 29.5 Configuration BD

**Description** : Retourne les informations de connexion a la base de donnees (sanitisees, sans mot de passe).

- Route : `GET /api/v1/admin/config/db` (SUPER_ADMIN)
- Use case : `ConfigDbUseCase`

### 29.6 Templates d'Instance

**Description** : Cree une instance avec une structure par defaut (groupes et sous-groupes preconfigures) a partir d'un template.

- Route : `POST /api/v1/admin/instances/template` (SUPER_ADMIN)
- Use case : `CreateInstanceTemplateUseCase`

```json
POST /api/v1/admin/instances/template
{
  "name": "Mali",
  "slug": "mali",
  "description": "Instance GeOSM pour le Mali",
  "thematiques": ["education", "sante", "transport"]
}
```

### 29.7 Gestion des Sequences PostgreSQL

**Description** : Permet de lister, creer et supprimer des sequences PostgreSQL utilisees pour l'auto-increment des identifiants dans les tables geographiques.

- Route : `GET /api/v1/admin/sequences` (SUPER_ADMIN) -- liste
- Route : `POST /api/v1/admin/sequences` (SUPER_ADMIN) -- creation
- Route : `DELETE /api/v1/admin/sequences` (SUPER_ADMIN) -- suppression
- Use case : `ManageSequenceUseCase`

### 29.8 Vidage du Cache Redis

- Route : `POST /api/v1/admin/cache/clear` (SUPER_ADMIN)
- Service : `RedisService.getClient().flushdb()`

### 29.9 Import OSM

Voir [Section 7.1 - Import des Donnees OSM Brutes](#71-import-des-donnees-osm-brutes-osm2pgsql).

---

## 30. Notifications Temps Reel (WebSocket)

### 30.1 Canal WebSocket

**Description** : Le service `NotificationService` (`src/infrastructure/websocket/notification.service.ts`) enregistre des routes WebSocket sur l'application Fastify. Les clients se connectent pour recevoir en temps reel les notifications de progression des imports et exports.

**Cas d'usage** : Lors de l'import d'un fichier Shapefile de 50 MB, l'utilisateur voit une barre de progression en temps reel grace aux notifications WebSocket.

**Implementation technique** :
- Plugin : `websocketPlugin` (`src/presentation/plugins/websocket.plugin.ts`)
- Service : `NotificationService.registerRoutes(app)` -> enregistre les handlers WebSocket
- Evenements envoyes : progression d'import, completion, erreur
- Les workers BullMQ envoient les notifications via `notificationService.notify()`

---

## 31. Service Email

### 31.1 Envoi d'Emails

**Description** : Le service `SmtpEmailService` (`src/infrastructure/email/smtp.service.ts`) gere l'envoi d'emails transactionnels : verification d'email, reinitialisation de mot de passe, notifications.

**Implementation technique** :
- Service : `SmtpEmailService` (singleton, injecte dans les use cases d'authentification)
- Utilise dans : `RegisterUseCase` (email verification), `ForgotPasswordUseCase` (reset password)

---

## 32. Upload de Fichiers

### 32.1 Stockage MinIO

**Description** : Le service `MinioStorageService` (`src/infrastructure/storage/minio.service.ts`) gere le stockage objet compatible S3 pour les fichiers uploades (fichiers geospatiaux, documents, exports).

**Operations** :
- Upload de fichier avec generation de cle unique
- Generation d'URLs presignees pour le telechargement
- Suppression de fichier

### 32.2 Plugin Multipart

**Description** : Le plugin `multipartPlugin` (`src/presentation/plugins/multipart.plugin.ts`) configure le support des uploads multipart/form-data via `@fastify/multipart`.

---

## 33. Sante et Monitoring

### 33.1 Health Check

**Description** : Endpoints de verification de sante pour les orchestrateurs (Kubernetes, Docker).

- Route : `GET /health` -- etat general + uptime
- Route : `GET /health/ready` -- serveur pret
- Route : `GET /health/live` -- serveur vivant

### 33.2 Metriques Prometheus

**Description** : Expose les metriques au format Prometheus pour le monitoring (requetes/sec, latence, erreurs).

- Route : `GET /metrics`
- Service : `metricsRegister` (`src/infrastructure/observability/metrics.ts`)
- Middleware : `metricsMiddleware` (active si `appConfig.prometheus.enabled`)

### 33.3 Journalisation

**Description** : Logger structure (`src/infrastructure/observability/logger.ts`) avec middleware de logging des requetes (`requestLoggerMiddleware`).

---

## Architecture Technique

### Stack Technologique

| Composant | Technologie |
|-----------|------------|
| Framework HTTP | Fastify |
| ORM | Prisma |
| Base de donnees | PostgreSQL + PostGIS |
| Cache | Redis |
| File d'attente | BullMQ (Redis) |
| Stockage fichiers | MinIO (S3) |
| Authentification | JWT RS256 + Argon2id |
| Recherche | MeiliSearch |
| Geocodage | Nominatim |
| Itineraires | OSRM |
| Cartographie serveur | QGIS Server |
| Outils geospatiaux | GDAL/OGR, osm2pgsql |
| Injection de dependances | Awilix |
| Validation | Zod |
| WebSocket | @fastify/websocket |
| Monitoring | Prometheus |

### Roles et Permissions

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Acces total a la plateforme |
| `ADMIN_INSTANCE` | Gestion d'une instance specifique |
| `EDITOR` | Edition des couches et features |
| `VIEWER` | Consultation uniquement |

### Pattern Architectural

L'API suit une architecture hexagonale (Clean Architecture) :
- **Presentation** (`src/presentation/`) : Routes Fastify, schemas Zod, middleware
- **Application** (`src/application/`) : Use cases (logique metier)
- **Domaine** (`src/domain/`) : Entites, erreurs, enums
- **Infrastructure** (`src/infrastructure/`) : Implementations BD, services externes, GDAL, QGIS
