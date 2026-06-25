# Reference API GeOSM v3.0

Documentation complete de tous les endpoints de l'API GeOSM. Le prefixe par defaut est `/api/v1` (configurable via `API_PREFIX`).

La documentation interactive Swagger est disponible sur `/docs` quand le serveur est en marche.

## Format des reponses

Toutes les reponses suivent un format standardise :

```json
// Succes
{
  "success": true,
  "data": { ... }
}

// Succes pagine
{
  "success": true,
  "data": [ ... ],
  "page": 1,
  "limit": 20,
  "total": 150,
  "totalPages": 8
}

// Erreur
{
  "success": false,
  "message": "Description de l'erreur"
}
```

## Authentification

Les endpoints proteges necessitent un header `Authorization: Bearer <accessToken>`. Les tokens sont obtenus via `POST /api/v1/auth/login`.

Les roles disponibles sont : `SUPER_ADMIN`, `ADMIN_INSTANCE`, `EDITOR`, `VIEWER`.

---

## Sante et metriques

### `GET /health`

Verification de sante generale.

- **Auth** : Non
- **Reponse** : `{ status, uptime, timestamp }`

### `GET /health/ready`

Sonde de disponibilite (readiness probe).

- **Auth** : Non
- **Reponse** : `{ status: "ready" }`

### `GET /health/live`

Sonde de vivacite (liveness probe).

- **Auth** : Non
- **Reponse** : `{ status: "live" }`

### `GET /metrics`

Metriques Prometheus au format texte.

- **Auth** : Non
- **Reponse** : Texte brut (format Prometheus)

---

## Auth (`/api/v1/auth`)

### `POST /register`

Inscription d'un nouvel utilisateur.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "email": "string (email)",
    "password": "string (8-128 caracteres)",
    "firstName": "string (1-100)",
    "lastName": "string (1-100)"
  }
  ```
- **Reponse** : `201` -- Utilisateur cree
- **Exemple** :
  ```bash
  curl -X POST http://localhost:3000/api/v1/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"MonMotDePasse123","firstName":"Jean","lastName":"Dupont"}'
  ```

### `POST /login`

Connexion et obtention des tokens.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "email": "string (email)",
    "password": "string"
  }
  ```
- **Reponse** : `{ accessToken, refreshToken, user }`
- **Exemple** :
  ```bash
  curl -X POST http://localhost:3000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user@example.com","password":"MonMotDePasse123"}'
  ```

### `POST /refresh`

Rafraichissement de l'access token.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "refreshToken": "string (UUID)"
  }
  ```
- **Reponse** : `{ accessToken, refreshToken }`

### `POST /logout`

Revocation du refresh token.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "refreshToken": "string (UUID)"
  }
  ```
- **Reponse** : `null`

### `POST /verify-email`

Verification de l'adresse email.

- **Auth** : Non
- **Corps** : `{ "token": "string" }`
- **Reponse** : `null`

### `POST /forgot-password`

Demande de reinitialisation du mot de passe.

- **Auth** : Non
- **Corps** : `{ "email": "string (email)" }`
- **Reponse** : `null`

### `POST /reset-password`

Reinitialisation du mot de passe avec token.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "token": "string",
    "password": "string (8-128 caracteres)"
  }
  ```
- **Reponse** : `null`

### `GET /me`

Profil de l'utilisateur connecte.

- **Auth** : Oui
- **Reponse** : Objet utilisateur (sans mot de passe)

### `PATCH /me`

Mise a jour du profil.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "firstName": "string (optionnel)",
    "lastName": "string (optionnel)",
    "avatar": "string URL (optionnel)"
  }
  ```
- **Reponse** : Profil mis a jour

### `PUT /me/password`

Changement de mot de passe.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string (8-128 caracteres)"
  }
  ```
- **Reponse** : `null`

---

## Utilisateurs (`/api/v1/users`)

Tous les endpoints necessitent le role **SUPER_ADMIN**.

### `GET /`

Liste des utilisateurs (paginee).

- **Auth** : Oui (SUPER_ADMIN)
- **Parametres de requete** :
  | Parametre | Type | Defaut | Description |
  |---|---|---|---|
  | `page` | int | 1 | Numero de page |
  | `limit` | int (1-100) | 20 | Nombre par page |
  | `search` | string | - | Recherche par nom/email |
  | `role` | Role | - | Filtrer par role |
  | `isActive` | boolean | - | Filtrer par statut actif |
- **Reponse** : Liste paginee d'utilisateurs

### `GET /:id`

Detail d'un utilisateur.

- **Auth** : Oui (SUPER_ADMIN)
- **Parametres** : `id` (UUID)
- **Reponse** : Objet utilisateur

### `POST /`

Creation d'un utilisateur.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** :
  ```json
  {
    "email": "string (email)",
    "password": "string (8-128)",
    "firstName": "string (1-100)",
    "lastName": "string (1-100)",
    "role": "Role (optionnel, defaut: VIEWER)"
  }
  ```
- **Reponse** : `201` -- Utilisateur cree

### `PATCH /:id`

Mise a jour d'un utilisateur.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ firstName?, lastName?, avatar?, email? }` (tous optionnels)
- **Reponse** : Utilisateur mis a jour

### `DELETE /:id`

Suppression d'un utilisateur.

- **Auth** : Oui (SUPER_ADMIN)
- **Reponse** : `null`

### `PATCH /:id/role`

Changement de role.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ "role": "Role" }`
- **Reponse** : Utilisateur mis a jour

### `PATCH /:id/activate`

Activation/desactivation.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ "isActive": boolean }`
- **Reponse** : Utilisateur mis a jour

---

## Instances (`/api/v1/instances`)

### `GET /`

Liste des instances (paginee).

- **Auth** : Oui
- **Parametres de requete** : `page`, `limit`, `search`, `isActive`
- **Reponse** : Liste paginee

### `GET /:id`

Detail d'une instance.

- **Auth** : Oui
- **Reponse** : Objet instance

### `POST /`

Creation d'une instance.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** :
  ```json
  {
    "name": "string",
    "slug": "string (unique)",
    "description": "string (optionnel)",
    "logo": "string URL (optionnel)",
    "bbox": [number, number, number, number],
    "centerLat": "number (optionnel)",
    "centerLon": "number (optionnel)",
    "defaultZoom": "int 0-22 (optionnel, defaut: 6)"
  }
  ```
- **Reponse** : `201`
- **Exemple** :
  ```bash
  curl -X POST http://localhost:3000/api/v1/instances \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Cameroun","slug":"cameroon","bbox":[8.5,1.7,16.2,13.1],"centerLat":7.4,"centerLon":12.4}'
  ```

### `PATCH /:id`

Mise a jour d'une instance.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ name?, description?, logo?, bbox?, centerLat?, centerLon?, defaultZoom?, isActive? }`
- **Reponse** : Instance mise a jour

### `DELETE /:id`

Suppression d'une instance.

- **Auth** : Oui (SUPER_ADMIN)
- **Reponse** : `null`

### `GET /:instanceId/users`

Liste des utilisateurs de l'instance.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : Liste des utilisateurs avec leurs roles

### `POST /:instanceId/users`

Ajouter un utilisateur a l'instance.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ "userId": "UUID", "role": "Role (optionnel)" }`
- **Reponse** : `201`

### `DELETE /:instanceId/users/:userId`

Retirer un utilisateur de l'instance.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : `null`

### `PATCH /:instanceId/users/:userId/role`

Changer le role d'un utilisateur dans l'instance.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ "role": "Role" }`
- **Reponse** : Mise a jour

---

## Groupes (`/api/v1/instances/:instanceId/groups`)

### `GET /`

- **Auth** : Oui
- **Reponse** : Liste des groupes

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail du groupe

### `POST /`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** :
  ```json
  {
    "name": "string",
    "slug": "string",
    "description": "string (optionnel)",
    "icon": "string (optionnel)",
    "color": "string (optionnel)",
    "order": "int (optionnel)"
  }
  ```
- **Reponse** : `201`

### `PATCH /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ name?, description?, icon?, color?, order?, isActive? }`
- **Reponse** : Groupe mis a jour

### `DELETE /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : `null`

### `PATCH /reorder`

Reordonnancer les groupes.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** :
  ```json
  {
    "orders": [
      { "id": "UUID", "order": 0 },
      { "id": "UUID", "order": 1 }
    ]
  }
  ```
- **Reponse** : `null`

---

## Sous-groupes (`/api/v1/groups/:groupId/sub-groups`)

### `GET /`

- **Auth** : Oui
- **Reponse** : Liste des sous-groupes

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail

### `POST /`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ name, slug, description?, icon?, order? }`
- **Reponse** : `201`

### `PATCH /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ name?, description?, icon?, order?, isActive? }`
- **Reponse** : Mis a jour

### `DELETE /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : `null`

---

## Couches (`/api/v1/instances/:instanceId/layers`)

### `GET /`

Liste des couches (paginee).

- **Auth** : Oui
- **Parametres de requete** :
  | Parametre | Type | Description |
  |---|---|---|
  | `page` | int | Numero de page |
  | `limit` | int | Nombre par page |
  | `search` | string | Recherche par nom |
  | `geometryType` | GeometryType | Filtrer par type de geometrie |
  | `subGroupId` | UUID | Filtrer par sous-groupe |
- **Reponse** : Liste paginee

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail de la couche

### `POST /`

Creation d'une couche.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** :
  ```json
  {
    "name": "string",
    "slug": "string",
    "description": "string (optionnel)",
    "geometryType": "POINT | LINESTRING | POLYGON | MULTIPOINT | MULTILINESTRING | MULTIPOLYGON",
    "sourceType": "WMS | WFS | WMTS | GEOJSON | MVT | XYZ",
    "sourceUrl": "string (optionnel)",
    "sourceLayer": "string (optionnel)",
    "tableName": "string (optionnel)",
    "schemaName": "string (optionnel)",
    "minZoom": "int (defaut: 0)",
    "maxZoom": "int (defaut: 22)",
    "isVisible": "boolean (defaut: true)",
    "isQueryable": "boolean (defaut: true)",
    "opacity": "number 0-1 (defaut: 1.0)",
    "order": "int (optionnel)",
    "metadata": "objet (optionnel)",
    "subGroupId": "UUID"
  }
  ```
- **Reponse** : `201`

### `PATCH /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** : Champs partiels (sans slug, geometryType, sourceType, subGroupId)
- **Reponse** : Couche mise a jour

### `DELETE /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Reponse** : `null`

### `GET /:id/source-file`

Obtenir les informations du fichier source.

- **Auth** : Oui
- **Reponse** : Informations du fichier source

---

## Import de couche (`/api/v1/layers`)

### `POST /:layerId/import`

Import de donnees spatiales (upload multipart).

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** : Formulaire multipart avec fichier (max 100 Mo)
  - Formats : GeoJSON, Shapefile (.zip), GeoPackage, KML, CSV
- **Reponse** : `202 Accepted` -- Job d'import cree
- **Exemple** :
  ```bash
  curl -X POST http://localhost:3000/api/v1/layers/$LAYER_ID/import \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@donnees.geojson"
  ```

### `GET /exports/:exportId/download`

Telecharger un fichier d'export.

- **Auth** : Oui
- **Reponse** : `{ downloadUrl }` (URL pre-signee MinIO)

---

## Features (`/api/v1/layers/:layerId/features`)

### `GET /`

Liste des features avec filtres spatiaux.

- **Auth** : Oui
- **Parametres de requete** :
  | Parametre | Type | Defaut | Description |
  |---|---|---|---|
  | `bbox` | string | - | Emprise "x1,y1,x2,y2" |
  | `limit` | int (1-10000) | 100 | Nombre max |
  | `offset` | int | 0 | Decalage |
- **Reponse** : GeoJSON FeatureCollection
- **Exemple** :
  ```bash
  curl "http://localhost:3000/api/v1/layers/$LAYER_ID/features?bbox=8.5,3.5,16.0,13.0&limit=50" \
    -H "Authorization: Bearer $TOKEN"
  ```

### `GET /:featureId`

- **Auth** : Oui
- **Parametres** : `featureId` (int)
- **Reponse** : GeoJSON Feature

### `POST /`

Ajouter une feature.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** :
  ```json
  {
    "geometry": { "type": "Point", "coordinates": [11.5, 3.8] },
    "properties": { "name": "Mon point", "type": "exemple" }
  }
  ```
- **Reponse** : `201`

### `PATCH /:featureId`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** : `{ geometry?, properties? }`
- **Reponse** : `null`

### `DELETE /:featureId`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Reponse** : `null`

---

## Styles (`/api/v1/layers/:layerId/style`)

### `GET /`

- **Auth** : Oui
- **Reponse** : Liste des styles de la couche

### `PUT /sld`

Mettre a jour le style SLD.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** : `{ "sldBody": "string XML SLD" }`
- **Reponse** : Style mis a jour

### `PUT /mapbox`

Mettre a jour le style Mapbox GL.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Corps** : `{ "mapboxStyle": { ... } }`
- **Reponse** : Style mis a jour

### `POST /reset`

Reinitialiser au style par defaut.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE, EDITOR)
- **Reponse** : `null`

### `GET /defaults`

Lister les styles par defaut disponibles.

- **Auth** : Oui
- **Reponse** : Liste des styles par defaut

---

## Fonds de carte (`/api/v1/instances/:instanceId/base-maps`)

### `GET /`

- **Auth** : Non
- **Reponse** : Liste des fonds de carte

### `POST /`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** :
  ```json
  {
    "name": "string",
    "slug": "string",
    "type": "XYZ | WMS | WMTS | MAPBOX",
    "url": "string URL",
    "thumbnail": "string URL (optionnel)",
    "attribution": "string (optionnel)",
    "isDefault": "boolean (optionnel)",
    "order": "int (optionnel)",
    "config": "objet (optionnel)"
  }
  ```
- **Reponse** : `201`

### `PATCH /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : `{ name?, url?, thumbnail?, attribution?, isDefault?, order?, config? }`
- **Reponse** : Mis a jour

### `DELETE /:id`

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : `null`

---

## Exports (`/api/v1/exports`)

### `POST /`

Creer un job d'export.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "format": "GEOJSON | SHAPEFILE | GEOPACKAGE | KML | CSV | PDF",
    "layerId": "UUID",
    "bbox": [number, number, number, number]
  }
  ```
- **Reponse** : `201` -- Export cree (traitement asynchrone)

### `GET /`

Liste des exports de l'utilisateur (paginee).

- **Auth** : Oui
- **Parametres** : `page`, `limit`, `status` (JobStatus)
- **Reponse** : Liste paginee

### `GET /:id`

Detail d'un export.

- **Auth** : Oui
- **Reponse** : Detail avec statut

### `GET /:id/download`

Telecharger le fichier d'export.

- **Auth** : Oui
- **Reponse** : `{ downloadUrl }` (URL pre-signee)

### `DELETE /:id`

- **Auth** : Oui
- **Reponse** : `null`

---

## Geocodage (`/api/v1/geocode`)

### `GET /search`

Geocodage direct (texte vers coordonnees).

- **Auth** : Non
- **Parametres** :
  | Parametre | Type | Description |
  |---|---|---|
  | `q` | string | Texte de recherche |
  | `viewbox` | string | Emprise de priorite |
  | `bounded` | boolean | Restreindre a la viewbox |
  | `limit` | int | Nombre max de resultats |
  | `countrycodes` | string | Codes pays (virgules) |
- **Reponse** : Liste de resultats Nominatim

### `GET /reverse`

Geocodage inverse (coordonnees vers adresse).

- **Auth** : Non
- **Parametres** : `lat` (number -90..90), `lon` (number -180..180)
- **Reponse** : Resultat Nominatim

### `GET /lookup`

Recherche par identifiant OSM.

- **Auth** : Non
- **Parametres** : `osm_ids` (string, identifiants separes par virgules)
- **Reponse** : Resultats Nominatim

---

## Routage (`/api/v1/routing`)

### `GET /route`

Calcul d'itineraire.

- **Auth** : Non
- **Parametres** :
  | Parametre | Type | Defaut | Description |
  |---|---|---|---|
  | `coordinates` | string | - | Points "lon,lat;lon,lat;..." |
  | `profile` | string | `driving` | Profil de deplacement |
  | `alternatives` | boolean | false | Itineraires alternatifs |
  | `steps` | boolean | false | Instructions detaillees |
  | `geometries` | string | - | Format de la geometrie |
- **Reponse** : Resultat OSRM

### `GET /nearest`

Point le plus proche sur le reseau routier.

- **Auth** : Non
- **Parametres** : `lon`, `lat`, `number` (int, optionnel)
- **Reponse** : Resultat OSRM

---

## Recherche (`/api/v1/search`)

### `GET /`

Recherche globale.

- **Auth** : Non
- **Parametres** : `q` (string), `limit` (int, optionnel)
- **Reponse** : Resultats fusionnes

### `GET /layers`

Recherche de couches.

- **Auth** : Non
- **Parametres** : `q`, `instanceId` (optionnel), `limit`, `offset`
- **Reponse** : Liste de couches

### `GET /features`

Recherche de features.

- **Auth** : Non
- **Parametres** : `q`, `layerId` (optionnel), `limit`, `offset`
- **Reponse** : Liste de features

---

## Projets QGIS (`/api/v1/instances/:instanceId/qgis-project`)

### `GET /`

Obtenir le projet QGIS de l'instance.

- **Auth** : Oui
- **Reponse** : Detail du projet

### `POST /reload`

Recharger le projet QGIS.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Reponse** : Succes

---

## Proxy WMS/WFS

### `GET /api/v1/wms`

Proxy WMS vers QGIS Server.

- **Auth** : Non
- **Parametres** : Parametres WMS standard (MAP, SERVICE, REQUEST, LAYERS, BBOX, WIDTH, HEIGHT, FORMAT, etc.)
- **Reponse** : Image ou XML selon la requete

### `GET /api/v1/wfs`

Proxy WFS vers QGIS Server.

- **Auth** : Non
- **Parametres** : Parametres WFS standard (MAP, SERVICE, REQUEST, TYPENAME, etc.)
- **Reponse** : XML ou GeoJSON selon la requete

---

## OSM (`/api/v1/osm`)

### `POST /query`

Requeter les donnees OSM.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "tables": ["point", "line", "polygon"],
    "conditions": [
      { "key": "amenity", "value": "hospital" }
    ],
    "bbox": [8.5, 3.5, 16.0, 13.0],
    "limit": 1000,
    "offset": 0,
    "columns": ["osm_id", "name", "amenity"]
  }
  ```
- **Reponse** : GeoJSON FeatureCollection

### `POST /create-table`

Creer une table PostGIS a partir de donnees OSM.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** :
  ```json
  {
    "schema": "string",
    "table": "string",
    "sourceTable": "planet_osm_point | planet_osm_line | planet_osm_polygon",
    "conditions": [{ "key": "amenity", "value": "hospital" }],
    "bbox": [8.5, 3.5, 16.0, 13.0],
    "boundaryTable": "string (optionnel)",
    "boundaryId": "string (optionnel)",
    "boundaryGeomColumn": "string (optionnel)"
  }
  ```
- **Reponse** : Succes

---

## Themes par defaut (`/api/v1/default-themes`)

### `GET /`

- **Auth** : Non
- **Reponse** : Liste des themes

### `GET /:id`

- **Auth** : Non
- **Reponse** : Detail du theme

### `POST /`

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ name, slug, icon? (max 255), color? (max 50), order? }`
- **Reponse** : `201`

### `PATCH /:id`

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ name?, icon?, color?, order? }`
- **Reponse** : Mis a jour

### `DELETE /:id`

- **Auth** : Oui (SUPER_ADMIN)
- **Reponse** : `null`

### `GET /:id/tags`

Tags d'un theme.

- **Auth** : Non
- **Reponse** : Liste des tags

### `POST /:id/tags`

Ajouter un tag.

- **Auth** : Oui (SUPER_ADMIN)
- **Corps** : `{ "name": "string", "slug": "string" }`
- **Reponse** : `201`

### `POST /seed`

Initialiser les themes par defaut.

- **Auth** : Oui (SUPER_ADMIN)
- **Reponse** : `201`

---

## Geoportail (`/api/v1/geoportail`)

### `POST /altitude`

Obtenir l'altitude pour des coordonnees.

- **Auth** : Non
- **Corps** : `{ "lon": number (-180..180), "lat": number (-90..90) }`
- **Reponse** : `{ lon, lat, altitude }`

### `POST /elevation-profile`

Profil altimetrique le long d'une ligne.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "geometry": { "type": "LineString", "coordinates": [[...]] },
    "numPoints": 100
  }
  ```
- **Reponse** : `{ profile: [...] }`

### `GET /admin-boundary`

Trouver la limite administrative.

- **Auth** : Non
- **Parametres** : `lat`, `lon`, `table` (optionnel)
- **Reponse** : Limite administrative

### `GET /geolocate`

Geolocaliser par adresse IP.

- **Auth** : Non
- **Reponse** : Localisation estimee

### `POST /layers/:layerId/stats`

Statistiques d'une couche.

- **Auth** : Oui
- **Reponse** : Statistiques

### `GET /search-limit`

Rechercher une limite dans une table.

- **Auth** : Non
- **Parametres** : `lat`, `lon`, `table`
- **Reponse** : Resultat

### `POST /save-coord-pdf`

Sauvegarder des coordonnees en PDF.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "instanceId": "UUID",
    "coordinates": [{ "lat": number, "lon": number }],
    "title": "string (optionnel)",
    "description": "string (optionnel)"
  }
  ```
- **Reponse** : `201`

---

## Dessins (`/api/v1/drawings`)

### `GET /`

- **Auth** : Oui
- **Parametres** : `instanceId` (UUID)
- **Reponse** : Liste des dessins

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail

### `POST /`

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "instanceId": "UUID",
    "name": "string (1-255)",
    "geojson": { ... },
    "description": "string (max 1000, optionnel)",
    "isPublic": "boolean (optionnel)"
  }
  ```
- **Reponse** : `201`

### `DELETE /:id`

- **Auth** : Oui
- **Reponse** : `204`

---

## Partage (`/api/v1/share`)

### `POST /`

Creer un lien de carte partagee.

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "instanceId": "UUID",
    "mapState": { ... },
    "expiresInDays": "int 1-365 (optionnel)"
  }
  ```
- **Reponse** : `201` -- `{ shortCode, ... }`

### `GET /:code`

Consulter une carte partagee.

- **Auth** : Non
- **Parametres** : `code` (string, 8 caracteres)
- **Reponse** : Etat de la carte

---

## Analytiques (`/api/v1/analytics`)

### `POST /track`

Enregistrer un evenement.

- **Auth** : Non (utilisateur lu optionnellement)
- **Corps** :
  ```json
  {
    "instanceId": "UUID",
    "eventType": "string (1-100)",
    "layerId": "UUID (optionnel)",
    "metadata": "objet (optionnel)"
  }
  ```
- **Reponse** : `201`

### `POST /view`

Incrementer un compteur de vues.

- **Auth** : Non
- **Corps** : `{ "type": "layer | instance", "id": "UUID" }`
- **Reponse** : `201`

### `GET /`

Consulter les donnees analytiques.

- **Auth** : Oui (SUPER_ADMIN)
- **Parametres** : `instanceId` (UUID), `startDate` (optionnel), `endDate` (optionnel)
- **Reponse** : Donnees analytiques

---

## Catalogue (`/api/v1/catalog`)

### `GET /`

Catalogue complet.

- **Auth** : Non
- **Reponse** : Catalogue avec toutes les instances, groupes, couches

### `GET /:instanceSlug`

Catalogue d'une instance.

- **Auth** : Non
- **Reponse** : Catalogue filtre par instance

---

## Compositions de carte (`/api/v1/instances/:instanceId/maps`)

### `GET /`

- **Auth** : Oui
- **Reponse** : Liste

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail

### `POST /`

- **Auth** : Oui
- **Corps** :
  ```json
  {
    "name": "string",
    "slug": "string",
    "description": "string (optionnel)",
    "layers": [
      { "layerId": "UUID", "style": "...", "opacity": 0.8, "visible": true }
    ],
    "center": { "lat": number, "lon": number },
    "zoom": "int 0-22 (optionnel)",
    "isPublic": "boolean (optionnel)"
  }
  ```
- **Reponse** : `201`

### `PUT /:id`

- **Auth** : Oui
- **Corps** : Champs partiels du schema de creation
- **Reponse** : Mis a jour

### `DELETE /:id`

- **Auth** : Oui
- **Reponse** : `204`

---

## Documents (`/api/v1/documents`)

### `GET /`

- **Auth** : Oui
- **Parametres** : `instanceId` (UUID, requis), `layerId` (UUID, optionnel)
- **Reponse** : Liste

### `GET /:id`

- **Auth** : Oui
- **Reponse** : Detail

### `POST /`

Upload d'un document (multipart).

- **Auth** : Oui
- **Corps** : Formulaire multipart avec fichier + champs `name`, `description`, `instanceId` (requis), `layerId` (optionnel)
- **Reponse** : `201`

### `DELETE /:id`

- **Auth** : Oui
- **Reponse** : `204`

---

## SEO (`/api/v1/seo`)

### `GET /:instanceSlug`

Metadonnees SEO pour une instance.

- **Auth** : Non
- **Reponse** : Metadonnees ou `404`

---

## Adressage (`/api/v1/adressage`)

### `POST /adresse`

Obtenir l'adresse pour une geometrie.

- **Auth** : Non
- **Corps** : `{ "shema": "string", "table": "string", "geom": "string" }`
- **Reponse** : Adresse

### `POST /position`

Obtenir la position pour une adresse.

- **Auth** : Non
- **Corps** : `{ "adresse": "string" }`
- **Reponse** : Position

### `POST /points`

Obtenir les points d'adressage.

- **Auth** : Non
- **Corps** : `{ "coord": [number, number], "nom_rue": "string" }`
- **Reponse** : Points

### `POST /search`

Rechercher par usage.

- **Auth** : Non
- **Corps** : `{ "usage": "string" }`
- **Reponse** : Resultats

### `POST /click`

Obtenir l'adresse par clic.

- **Auth** : Non
- **Corps** : `{ "coord": [number, number] }`
- **Reponse** : `{ adresse }`

### `GET /code-usage`

Obtenir les codes d'usage.

- **Auth** : Non
- **Reponse** : Liste des codes

### `POST /elastic-data`

Obtenir des donnees elastiques.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "data": [
      { "shema": "string", "table": "string", "key_couche": "string", "id": number }
    ]
  }
  ```
- **Reponse** : Donnees

---

## Analyse spatiale (`/api/v1/analysis`)

### `POST /spatial`

Executer une operation spatiale.

- **Auth** : Non
- **Corps** :
  ```json
  {
    "operation": "buffer | intersection | union | difference",
    "geometryA": { "type": "...", "coordinates": [...] },
    "geometryB": { "type": "...", "coordinates": [...] },
    "distance": "number (pour buffer, en metres)",
    "srid": "int (optionnel)"
  }
  ```
- **Reponse** : Geometrie resultante

---

## Rasters (`/api/v1/rasters`)

### `POST /upload`

Upload d'un raster (multipart).

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** : Formulaire multipart avec fichier + champs `tableName` (defaut: `raster_import`), `srid` (optionnel)
- **Reponse** : `201`

### `POST /download`

Telecharger un raster.

- **Auth** : Oui
- **Corps** : `{ "tableName": "string", "format": "string (defaut: GTiff)" }`
- **Reponse** : Fichier

### `POST /info`

Informations sur un raster.

- **Auth** : Oui
- **Corps** : `{ "filePath": "string" }`
- **Reponse** : Metadonnees du raster

---

## Administration (`/api/v1/admin`)

Tous les endpoints necessitent le role **SUPER_ADMIN** sauf indication contraire.

### `GET /dashboard`

Statistiques du tableau de bord.

- **Reponse** : Compteurs (instances, utilisateurs, exports, themes)

### `GET /jobs`

Liste des jobs en arriere-plan.

- **Reponse** : Liste des jobs avec statuts

### `GET /jobs/:id`

Detail d'un job.

- **Reponse** : Detail ou `404`

### `POST /jobs/:id/retry`

Relancer un job echoue.

- **Reponse** : Resultat ou `400`

### `POST /osm/import`

Importer des donnees OSM (PBF).

- **Corps** :
  ```json
  {
    "pbfPath": "string",
    "slim": "boolean (optionnel)",
    "append": "boolean (optionnel)",
    "styleFile": "string (optionnel)",
    "cache": "int (optionnel)"
  }
  ```
- **Reponse** : Succes

### `GET /health`

Sante du systeme (BD, Redis, etc.).

- **Reponse** : Etat de chaque service

### `POST /cache/clear`

Vider le cache Redis.

- **Reponse** : Message de confirmation

### `POST /icons/generate`

Generer des icones SVG.

- **Auth** : Oui (SUPER_ADMIN, ADMIN_INSTANCE)
- **Corps** :
  ```json
  {
    "color": "string",
    "shape": "circle | square | triangle | star | pin",
    "size": "int (8-512)",
    "strokeColor": "string (optionnel)",
    "strokeWidth": "number (optionnel)",
    "label": "string (optionnel)"
  }
  ```
- **Reponse** : Icone SVG

### `GET /config/db`

Configuration de la base de donnees.

- **Reponse** : Configuration

### `POST /instances/template`

Creer une instance a partir d'un template.

- **Corps** : `{ name, slug, description?, thematiques? }`
- **Reponse** : `201`

### `GET /sequences`

Lister les sequences.

- **Reponse** : Liste

### `POST /sequences`

Creer une sequence.

- **Corps** : `{ name, start?, increment? }`
- **Reponse** : `201`

### `DELETE /sequences`

Supprimer une sequence.

- **Corps** : `{ "name": "string" }`
- **Reponse** : Succes

---

## WebSocket (`/ws/notifications`)

Endpoint WebSocket pour les notifications temps reel. Necessite un token JWT valide.

### Evenements

| Evenement | Description |
|---|---|
| `import:progress` | Progression de l'import de couche |
| `import:completed` | Import termine avec succes |
| `import:failed` | Import echoue |
| `export:progress` | Progression de l'export |
| `export:completed` | Export pret au telechargement |
| `export:failed` | Export echoue |
| `ping` / `pong` | Keepalive de connexion |

### Connexion

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/notifications', {
  headers: { Authorization: 'Bearer ' + accessToken }
});

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.type, data.payload);
};
```
