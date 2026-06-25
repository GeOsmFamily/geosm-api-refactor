# Flux de travail GeOSM API v3.0

Ce document decrit en detail les principaux flux de travail de l'API GeOSM, etape par etape.

---

## A. Flux de creation d'une instance (pays)

Une instance represente un deploiement geographique (typiquement un pays ou une region).

### Etapes

1. **Authentification** : Le super administrateur se connecte (`POST /api/v1/auth/login`)
2. **Creation de l'instance** : `POST /api/v1/instances`
   - Corps : `{ name, slug, description, logo, bbox, centerLat, centerLon, defaultZoom }`
   - Le slug doit etre unique (ex: `cameroon`, `senegal`)
   - La bbox definit l'emprise geographique `[ouest, sud, est, nord]`
3. **Creation du projet QGIS** : Un fichier `.qgs` est cree dans `QGIS_PROJECTS_DIR` pour l'instance (via les scripts PyQGIS)
4. **Ajout d'utilisateurs** : `POST /api/v1/instances/:instanceId/users`
   - Assigner des roles par instance (ADMIN_INSTANCE, EDITOR, VIEWER)
5. **Creation des groupes** : `POST /api/v1/instances/:instanceId/groups`
   - Organiser les couches par thematique (ex: "Transport", "Sante", "Education")
6. **Creation des sous-groupes** : `POST /api/v1/groups/:groupId/sub-groups`
   - Sous-categories (ex: sous le groupe "Transport" : "Routes principales", "Pistes")
7. **Configuration des fonds de carte** : `POST /api/v1/instances/:instanceId/base-maps`
   - Ajouter les tuiles de fond (OSM, satellite, etc.)
8. **Import de donnees OSM** : Voir flux B ci-dessous
9. **Import de donnees complementaires** : Voir flux C ci-dessous

### Alternative : Creation par template

Le super admin peut utiliser `POST /api/v1/admin/instances/template` pour creer une instance avec des thematiques predefinies, ce qui genere automatiquement les groupes et sous-groupes.

---

## B. Flux d'import de donnees OSM

Le flux principal de GeOSM : transformer les donnees OSM en couches cartographiques.

### Etape 1 : Import PBF avec osm2pgsql

```
Fichier PBF (ex: cameroon-latest.osm.pbf)
        |
        v
POST /api/v1/admin/osm/import
        |
        v
osm2pgsql --create --slim --hstore \
          --style default.style \
          cameroon-latest.osm.pbf
        |
        v
Tables planet_osm_* creees dans PostgreSQL/PostGIS :
  - planet_osm_point   (entites ponctuelles)
  - planet_osm_line     (entites lineaires)
  - planet_osm_polygon  (entites surfaciques)
  - planet_osm_roads    (routes, optimise pour le rendu)
```

Le super admin lance l'import via `POST /api/v1/admin/osm/import` avec les parametres :
- `pbfPath` : chemin vers le fichier PBF
- `slim` : mode slim (recommande, permet les mises a jour incrementales)
- `append` : mode ajout (au lieu de recreation)
- `cache` : taille du cache en Mo

### Etape 2 : Requete des tags OSM

```
POST /api/v1/osm/query
        |
Corps : {
  tables: ["polygon"],
  conditions: [
    { key: "building", value: "yes" },
    { key: "amenity", value: "hospital" }
  ],
  bbox: [8.5, 3.5, 16.0, 13.0]
}
        |
        v
SELECT osm_id, name, tags, ST_AsGeoJSON(way)
FROM planet_osm_polygon
WHERE building = 'yes' OR amenity = 'hospital'
AND way && ST_MakeEnvelope(8.5, 3.5, 16.0, 13.0, 4326)
        |
        v
Reponse GeoJSON
```

### Etape 3 : Creation d'une table PostGIS a partir des tags

```
POST /api/v1/osm/create-table
        |
Corps : {
  schema: "cameroon",
  table: "hopitaux",
  sourceTable: "planet_osm_polygon",
  conditions: [{ key: "amenity", value: "hospital" }],
  bbox: [8.5, 3.5, 16.0, 13.0]
}
        |
        v
CREATE TABLE cameroon.hopitaux AS
SELECT osm_id, name, tags->'addr:street' as rue, ...
FROM planet_osm_polygon
WHERE amenity = 'hospital'
AND way && ST_MakeEnvelope(...)
```

### Etape 4 : Creation de la couche

```
POST /api/v1/instances/:instanceId/layers
        |
Corps : {
  name: "Hopitaux",
  slug: "hopitaux",
  geometryType: "POLYGON",
  sourceType: "WMS",
  tableName: "hopitaux",
  schemaName: "cameroon",
  subGroupId: "..."
}
```

### Etape 5 : Ajout au projet QGIS

Le service `QGISProjectService` invoque le script PyQGIS `add_vector_layer.py` pour :
1. Ajouter la couche PostGIS au projet QGIS de l'instance
2. Configurer les capacites WMS/WFS
3. Recharger le projet QGIS Server

### Etape 6 : Visualisation via WMS

```
GET /api/v1/wms?MAP=/qgis-projects/cameroon.qgs
    &SERVICE=WMS&REQUEST=GetMap
    &LAYERS=hopitaux
    &BBOX=8.5,3.5,16.0,13.0
    &WIDTH=800&HEIGHT=600
    &FORMAT=image/png
        |
        v
Image PNG de la carte
```

---

## C. Flux d'import de donnees non-OSM

Pour les donnees qui ne viennent pas d'OpenStreetMap (fichiers vectoriels uploades par les utilisateurs).

### Etapes

```
1. Upload du fichier
   POST /api/v1/layers/:layerId/import
   (multipart, max 100 Mo)
   Formats acceptes : GeoJSON, Shapefile (.zip), GeoPackage, KML, CSV
        |
        v
2. Stockage temporaire dans MinIO
   Bucket: geosm / imports/:layerId/:filename
        |
        v
3. Creation d'un job BullMQ (file "layer-import")
   Reponse immediate : 202 Accepted
        |
        v
4. Worker de traitement (asynchrone)
   a. Telecharge le fichier depuis MinIO
   b. ogr2ogr convertit et importe dans PostGIS :
      ogr2ogr -f PostgreSQL \
        "PG:dbname=geosm" \
        /tmp/import.geojson \
        -nln schema.table_name \
        -overwrite \
        -t_srs EPSG:4326
   c. Met a jour Layer.tableName et Layer.schemaName
   d. Indexe la couche dans MeiliSearch
        |
        v
5. Notifications WebSocket temps reel
   - import:progress (pourcentage)
   - import:completed (succes)
   - import:failed (erreur)
        |
        v
6. Ajout au projet QGIS (via PyQGIS)
   - add_vector_layer.py
   - setup_wms_capabilities.py
```

---

## D. Flux d'export

### Etapes

```
1. Demande d'export
   POST /api/v1/exports
   Corps : {
     format: "SHAPEFILE",  // ou GEOJSON, GEOPACKAGE, KML, CSV, PDF
     layerId: "...",
     bbox: [ouest, sud, est, nord]  // optionnel
   }
   Reponse : 201 avec l'ID de l'export
        |
        v
2. Creation d'un job BullMQ (file "layer-export")
        |
        v
3. Worker de traitement (asynchrone)
   a. Lit les features depuis PostGIS
   b. ogr2ogr convertit au format demande :
      ogr2ogr -f "ESRI Shapefile" \
        /tmp/export.shp \
        "PG:dbname=geosm" \
        -sql "SELECT * FROM schema.table WHERE ..."
   c. Uploade le resultat dans MinIO
   d. Met a jour l'export (filePath, fileSize, status)
        |
        v
4. Notifications WebSocket
   - export:progress
   - export:completed
   - export:failed
        |
        v
5. Telechargement
   GET /api/v1/exports/:id/download
   -> URL pre-signee MinIO (acces temporaire)
```

---

## E. Flux d'edition de features

Les features (entites geographiques) d'une couche peuvent etre editees individuellement.

### Consultation

```
GET /api/v1/layers/:layerId/features
    ?bbox=8.5,3.5,16.0,13.0
    &limit=100
    &offset=0
        |
        v
SELECT gid, ST_AsGeoJSON(geom), *
FROM schema.table_name
WHERE geom && ST_MakeEnvelope(8.5, 3.5, 16.0, 13.0, 4326)
LIMIT 100 OFFSET 0
        |
        v
Reponse GeoJSON FeatureCollection
```

### Ajout

```
POST /api/v1/layers/:layerId/features
Corps : {
  geometry: { type: "Point", coordinates: [11.5, 3.8] },
  properties: { name: "Nouvel hopital", type: "public" }
}
        |
        v
INSERT INTO schema.table_name (geom, name, type)
VALUES (ST_GeomFromGeoJSON('...'), 'Nouvel hopital', 'public')
```

### Mise a jour

```
PATCH /api/v1/layers/:layerId/features/:featureId
Corps : {
  geometry: { type: "Point", coordinates: [11.6, 3.9] },
  properties: { name: "Hopital central" }
}
        |
        v
UPDATE schema.table_name
SET geom = ST_GeomFromGeoJSON('...'), name = 'Hopital central'
WHERE gid = :featureId
```

### Suppression

```
DELETE /api/v1/layers/:layerId/features/:featureId
        |
        v
DELETE FROM schema.table_name WHERE gid = :featureId
```

---

## F. Flux QGIS/WMS/WFS

### Architecture

```
Client                    GeOSM API                  QGIS Server
  |                          |                           |
  | GET /api/v1/wms?...      |                           |
  |------------------------->|                           |
  |                          | Proxy la requete           |
  |                          |-------------------------->|
  |                          |                           |
  |                          |  Image/XML/GeoJSON        |
  |                          |<--------------------------|
  |  Reponse                 |                           |
  |<-------------------------|                           |
```

### WMS (Web Map Service)

Le proxy WMS (`GET /api/v1/wms`) transmet les requetes au QGIS Server :
- **GetMap** : Obtenir une image de carte
- **GetCapabilities** : Lister les couches disponibles
- **GetFeatureInfo** : Obtenir les attributs d'un point clique

### WFS (Web Feature Service)

Le proxy WFS (`GET /api/v1/wfs`) transmet les requetes au QGIS Server :
- **GetFeature** : Obtenir les features au format GML/GeoJSON
- **DescribeFeatureType** : Obtenir le schema de la couche
- **GetCapabilities** : Lister les couches disponibles

### Gestion des projets QGIS

Les projets QGIS sont geres via les scripts PyQGIS :

| Operation | Script | Declencheur |
|---|---|---|
| Ajouter une couche vectorielle | `add_vector_layer.py` | Creation/import de couche |
| Ajouter une couche raster | `add_raster_layer.py` | Upload raster |
| Supprimer une couche | `remove_layer.py` | Suppression de couche |
| Appliquer un style | `set_style.py` | Mise a jour de style |
| Sauvegarder un style | `save_style.py` | Sauvegarde de style |
| Configurer WMS | `setup_wms_capabilities.py` | Ajout de couche |
| Configurer WFS | `configure_wfs.py` | Ajout de couche |
| Recharger le projet | `reload_project.py` | Toute modification |
| Exporter/decouper | `clip_export.py` | Export avec bbox |

---

## G. Flux de recherche

GeOSM utilise MeiliSearch pour la recherche full-text.

### Indexation

Quand une couche est creee ou mise a jour, le cas d'utilisation `IndexLayer` :
1. Extrait les metadonnees de la couche (nom, description, tags)
2. Indexe dans MeiliSearch avec l'ID de la couche comme cle

### Recherche globale

```
GET /api/v1/search?q=hopital&limit=10
        |
        v
MeiliSearch : recherche dans tous les index
        |
        v
Resultats fusionnes (couches + features)
```

### Recherche par couches

```
GET /api/v1/search/layers?q=transport&instanceId=...&limit=20
```

### Recherche par features

```
GET /api/v1/search/features?q=ecole&layerId=...&limit=50
```

---

## H. Flux d'authentification

### Inscription

```
POST /api/v1/auth/register
Corps : { email, password, firstName, lastName }
        |
        v
1. Verifier que l'email n'existe pas
2. Hacher le mot de passe avec Argon2id
3. Creer l'utilisateur (role: VIEWER par defaut)
4. Envoyer un email de verification
        |
        v
POST /api/v1/auth/verify-email
Corps : { token }
        |
        v
Mettre a jour emailVerifiedAt
```

### Connexion

```
POST /api/v1/auth/login
Corps : { email, password }
        |
        v
1. Trouver l'utilisateur par email
2. Verifier le mot de passe avec Argon2id
3. Generer un access token JWT (15 min)
4. Generer un refresh token (7 jours, stocke en BD)
5. Mettre a jour lastLoginAt
        |
        v
Reponse : { accessToken, refreshToken, user }
```

### Rafraichissement de token

```
POST /api/v1/auth/refresh
Corps : { refreshToken }
        |
        v
1. Trouver le refresh token en BD
2. Verifier qu'il n'est pas revoque ni expire
3. Revoquer l'ancien refresh token
4. Generer une nouvelle paire (access + refresh)
5. Lier le nouveau token a la meme famille
        |
        v
Reponse : { accessToken, refreshToken }
```

### Mot de passe oublie

```
POST /api/v1/auth/forgot-password
Corps : { email }
        |
        v
1. Generer un token de reinitialisation
2. Envoyer par email
        |
        v
POST /api/v1/auth/reset-password
Corps : { token, password }
        |
        v
1. Verifier le token
2. Hacher le nouveau mot de passe
3. Revoquer tous les refresh tokens existants
```

---

## I. Flux de partage et analytiques

### Partage de carte

```
POST /api/v1/share
Corps : {
  instanceId: "...",
  mapState: {
    center: [11.5, 3.8],
    zoom: 12,
    layers: ["layer1", "layer2"],
    basemap: "osm"
  },
  expiresInDays: 30
}
        |
        v
1. Generer un code court unique (8 caracteres)
2. Sauvegarder l'etat de la carte en BD
        |
        v
Reponse : { shortCode: "abc12345", url: "https://geosm.org/s/abc12345" }
```

### Consultation d'une carte partagee

```
GET /api/v1/share/:code
        |
        v
1. Trouver la carte par code court
2. Verifier qu'elle n'est pas expiree
3. Retourner l'etat de la carte
```

### Suivi analytique

```
POST /api/v1/analytics/track
Corps : {
  instanceId: "...",
  eventType: "layer_view",
  layerId: "...",
  metadata: { duration: 120 }
}
        |
        v
Enregistrer l'evenement avec IP et userId (si authentifie)
```

### Compteur de vues

```
POST /api/v1/analytics/view
Corps : { type: "layer", id: "..." }
        |
        v
Incrementer le compteur de vues
```

---

## J. Flux de gestion des thematiques OSM

Les thematiques OSM definissent comment les tags OpenStreetMap sont organises dans GeOSM.

### Structure hierarchique

```
DefaultTheme (ex: "Sante")
    |
    +-- DefaultTag (ex: "hospital")
    +-- DefaultTag (ex: "clinic")
    +-- DefaultTag (ex: "pharmacy")

DefaultTheme (ex: "Education")
    |
    +-- DefaultTag (ex: "school")
    +-- DefaultTag (ex: "university")
    +-- DefaultTag (ex: "kindergarten")
```

### Initialisation des themes

```
POST /api/v1/default-themes/seed
        |
        v
Creer les themes et tags OSM par defaut :
  - Transport (highway, railway, aeroway, ...)
  - Sante (hospital, clinic, pharmacy, ...)
  - Education (school, university, ...)
  - Commerce (shop, marketplace, ...)
  - etc.
```

### Flux complet : du tag OSM a la couche GeOSM

```
1. Themes par defaut configures
   (DefaultTheme + DefaultTag)
        |
        v
2. Import des donnees OSM (osm2pgsql)
   -> Tables planet_osm_*
        |
        v
3. Requete par tag OSM
   POST /api/v1/osm/query
   { conditions: [{ key: "amenity", value: "hospital" }] }
        |
        v
4. Creation d'une table PostGIS dediee
   POST /api/v1/osm/create-table
   { schema: "cameroon", table: "hopitaux", ... }
        |
        v
5. Creation de la couche dans GeOSM
   POST /api/v1/instances/:id/layers
   { name: "Hopitaux", tableName: "hopitaux", ... }
        |
        v
6. Ajout au projet QGIS
   (PyQGIS : add_vector_layer.py)
        |
        v
7. Stylisation
   PUT /api/v1/layers/:id/style/sld
        |
        v
8. La couche est visible via WMS/WFS
   GET /api/v1/wms?LAYERS=hopitaux&...
```

### Gestion des themes

| Operation | Endpoint | Role |
|---|---|---|
| Lister les themes | `GET /api/v1/default-themes` | Public |
| Creer un theme | `POST /api/v1/default-themes` | SUPER_ADMIN |
| Modifier un theme | `PATCH /api/v1/default-themes/:id` | SUPER_ADMIN |
| Supprimer un theme | `DELETE /api/v1/default-themes/:id` | SUPER_ADMIN |
| Lister les tags d'un theme | `GET /api/v1/default-themes/:id/tags` | Public |
| Ajouter un tag | `POST /api/v1/default-themes/:id/tags` | SUPER_ADMIN |
| Initialiser les themes par defaut | `POST /api/v1/default-themes/seed` | SUPER_ADMIN |
