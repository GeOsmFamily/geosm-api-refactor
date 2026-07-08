# Changelog

Toutes les modifications notables de ce projet sont documentees dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).

## [Unreleased]

### Ajoute

- **Authentification OpenStreetMap (OAuth 2.0)** : connexion en un clic via un compte OSM, creation automatique d'un compte GeOSM local (role `VIEWER`) au premier login, liaison/deliaison d'un compte OSM a un compte GeOSM existant, consultation du profil OSM lie (nom, avatar, date de creation du compte, nombre de contributions). Token d'acces OSM chiffre au repos (AES-256-GCM).
- **Assistant IA conversationnel** (Gemini, function-calling) : discussion en langage naturel avec pilotage des fonctionnalites existantes (recherche, analyse spatiale, plan de localisation) comme des "outils", historique de conversations persiste par utilisateur/instance.
- **Synthese et redaction assistees par IA** : statistiques de couche narrees en langage naturel, resume de la vue courante de la carte, redaction automatique (description + point de repere) d'un plan de localisation.
- **Suggestions et recommandations de recherche** : suggestions de couches par frequence d'activation passee, recommandations de couches co-activees ("les utilisateurs qui ont active X ont aussi active Y").
- **Geosignets (signets de carte)** : sauvegarde d'une position de carte (centre + zoom) nommee, pour y revenir rapidement.
- **Sauvegardes automatiques de la base de donnees** : `pg_dump` planifie quotidiennement (cron configurable), upload vers MinIO, retention glissante configurable ; endpoint de backup manuel immediat pour les administrateurs.
- **CI/CD** : etape de deploiement SSH complete dans `deploy.yml` (backend et frontend), `docker-compose.prod.yml` durci, ESLint frontend ajoute de zero, seuil de couverture de tests reellement applique (`vitest.config.ts`).
- **Metriques Prometheus** : requetes base de donnees (via une Client Extension Prisma instrumentant tous les modeles/operations en un seul point), connexions/echecs de login, envois d'email, appels Gemini (latence/volume/erreurs).
- **Tracing OpenTelemetry manuel** : spans autour des appels Gemini/OSRM/Nominatim et de l'execution des jobs BullMQ (au-dela de l'auto-instrumentation HTTP/DNS/ioredis existante).
- **Logging etendu** : couverture de logging ajoutee a l'ensemble des domaines de use-cases precedemment silencieux (authentification complete, gestion des utilisateurs par un administrateur, operations destructrices sensibles a la securite).
- **Remontee des erreurs frontend** : nouvel endpoint `POST /logs/frontend-error` associe a un `GlobalErrorHandler` Angular - une erreur JS non geree cote client n'est plus invisible en dehors de la console du navigateur.
- **Formulaire de signalement** (bouton "Infos" cote frontend) : nouvel endpoint `POST /feedback` (authentification optionnelle - un visiteur non connecte peut signaler un probleme), notification Slack automatique via `AlertingService` (canal deja existant, jusque-la jamais raccorde a aucun flux applicatif).
- Suite de tests unitaires backend etendue (couverture des flux d'authentification critiques, des operations destructrices, de la gestion des utilisateurs, du formulaire de signalement).
- **Auto-hebergement de Nominatim et OSRM** (`docker-compose.prod.yml`) : remplace les serveurs publics de demonstration (`nominatim.openstreetmap.org`, `router.project-osrm.org`), dont les politiques d'usage ("light testing only", 1 requete/seconde) ne supportent pas un trafic de production. Nouveau script `scripts/setup-osrm-data.sh` (extract/partition/customize via l'image officielle `osrm/osrm-backend`). Teste de bout en bout avec un extract reel du Cameroun (import Nominatim complet, calcul d'itineraire OSRM reel entre Douala et Yaounde).
- **`docs/deploiement.md` entierement reecrit** en checklist etape par etape (VPS vierge jusqu'a l'application fonctionnelle) : provisionnement, generation des secrets, auto-hebergement Nominatim/OSRM, reverse proxy/TLS, initialisation de la base, activation du deploiement continu (secrets GitHub Actions), verification post-deploiement. Nouvelle section dediee de rotation des secrets (tableau recapitulatif secret par secret, avec une mise en garde specifique sur `ENCRYPTION_KEY` qui n'est pas une simple valeur de verification).
- **Selecteur de limite administrative pour les instances** (`Instance.boundaryTable/boundaryId/boundaryGeomCol/adminLevel`, jusque-la inaccessibles via l'API malgre leur presence dans le modele de domaine) : nouveaux endpoints `GET /geoportail/admin-boundaries/search` et `/:table/:id` (recherche par nom + apercu geometrique), et `POST /geoportail/admin-boundaries/import` (SUPER_ADMIN, shapefile/GeoJSON avec mapping de champ + niveau administratif, reutilise le pipeline `ogr2ogr` deja utilise pour l'import de couches). Nouvelle table de reference `public.admin_boundaries` (modele Prisma `@@ignore`, hors du cycle de vie de `prisma db push`), pre-remplie pour le Cameroun via un nouveau script `scripts/seed-admin-boundaries.sh` qui extrait les polygones `boundary=administrative` du meme extract OSM que Nominatim/OSRM (589 limites reelles importees en verification, du pays aux communes).

### Corrige

- **[Securite, critique]** Reinitialisation de mot de passe : le jeton de reinitialisation etait traite comme l'identifiant utilisateur lui-meme et jamais stocke, permettant a quiconque connaissant l'UUID d'un compte de reinitialiser son mot de passe sans jamais avoir eu acces a la boite mail. Corrige par un modele `PasswordResetToken` dedie (jeton aleatoire, expiration, usage unique).
- **[Securite, critique]** Meme faille sur la verification d'email : corrigee par un modele `EmailVerificationToken` dedie suivant le meme principe.
- **[Securite, critique]** Suppression de commentaires/dessins/geosignets (IDOR) : aucune verification de propriete n'etait effectuee, permettant a un utilisateur authentifie de supprimer les donnees de n'importe quel autre utilisateur en connaissant leur identifiant. Corrige par une verification de propriete systematique avant suppression.
- Fuites de JSON multilingue brut (`{"fr":"...","en":"..."}`) dans plusieurs reponses API et dans l'indexation MeiliSearch (degradant la pertinence de recherche) - remplacees par un texte localise coherent selon `Accept-Language`.
- Message d'erreur de connexion/inscription cote frontend : lisait le mauvais niveau d'imbrication de l'enveloppe d'erreur backend, affichant systematiquement un message generique au lieu du vrai message serveur.
- Bug de compilation JIT sous `ng serve` : un import circulaire entre un composant enfant et son parent charge en lazy (`loadComponent`) cassait la navigation vers la carte en developpement (sans affecter le build de production, AOT).
- Sauvegarde de base de donnees : mise en memoire tampon integrale du dump provoquant un OOM sur une base volumineuse - corrige par une ecriture sur disque temporaire (bornee par l'espace disque, pas la RAM).

### Securite

- Token Mapillary retire du code source committe cote frontend (production) au profit d'une injection au build via un secret Docker BuildKit.
