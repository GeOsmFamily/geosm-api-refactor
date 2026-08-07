# Plan de scalabilité

> Document de constat, pas de prescription théorique : chaque limite listée ci-dessous a été
> vérifiée dans le code réel de ce dépôt (pas déduite d'une architecture "typique"), à la date du
> 2026-08-06 (voir plan "Centre de notifications unifié + plan de scalabilité documenté"). Sert de
> base de décision avant tout scaling horizontal (plusieurs répliques de `api`) ou vertical
> (augmentation des ressources d'un seul conteneur).

## 1. Résumé - premier levier avant tout le reste

Le premier goulot d'étranglement réel de cette application n'est **ni** la base de données
**ni** le nombre de répliques de `api`, mais la **concurrence des workers BullMQ, figée à 1
partout** (voir §2). Avant d'envisager une infrastructure plus lourde (répliques, load
balancer, cache applicatif), augmenter cette concurrence est le changement le moins coûteux et
le plus directement mesurable. Le second levier réel, structurel celui-là (pas un simple
paramètre), est de sortir le canal de notifications WebSocket de la mémoire d'un seul process
(voir §4) - un blocage net à toute réplication horizontale de `api` tant qu'il n'est pas résolu.

## 2. Files d'attente BullMQ - concurrence par défaut partout

`QueueService.registerWorker(queueName, processor, concurrency = 1)` accepte un troisième
paramètre de concurrence, mais **aucun des 10 appels `registerWorker(...)` du code
(`server.ts` : `layer-import`, `layer-export`, `location-plan`, `scheduled-osm-import`,
`database-backup`, `raster-analysis`, `analysis-report`, `activity-reports`, `faq-generation`,
`layer-freshness-report`) ne le fournit** - les 10 files tournent donc à concurrence 1, un job à
la fois par file, quel que soit le nombre de CPU disponibles sur le conteneur `api`.

**Conséquence concrète** : un import de couche volumineux ou une génération de rapport IA en
cours retarde tous les autres jobs de la MÊME file (pas des autres files, qui sont indépendantes)
jusqu'à sa fin, même si le conteneur a des CPU inutilisés.

**Recommandation** : avant toute réplication d'infrastructure, passer les files les plus
sollicitées en usage réel (`layer-export`, `analysis-report`, `location-plan`) à une concurrence
de 2-4, en surveillant la mémoire (voir §3 - `gdalwarp`/GDAL sont déjà la cause connue du seul
OOM réel observé sur ce projet, une concurrence plus élevée multiplie ce risque par le nombre de
jobs simultanés). Les files purement planifiées et rares (`scheduled-osm-import`,
`database-backup`, `layer-freshness-report`) n'ont aucune raison d'être concurrentes - un seul
job de ce type tourne jamais en pratique à un instant donné.

## 3. Base de données - pool de connexions Prisma

`container.ts` instancie `new PrismaClient()` **sans aucune configuration explicite** - ni
`datasources` personnalisé, ni `connection_limit`/`pool_timeout` dans `DATABASE_URL`. Le pool de
connexions dépend donc entièrement des valeurs par défaut de Prisma (dérivées du nombre de CPU
visibles par le conteneur), jamais dimensionné pour ce projet spécifiquement.

**Limite mémoire Docker déjà réelle et documentée** : le service `api` de `docker-compose.yml`
a été monté à **4096M** après un OOM réel constaté en conditions réelles avec `gdalwarp`
(traitement raster) - cette limite n'est pas un chiffre théorique, c'est un correctif appliqué
suite à un incident. Toute augmentation de concurrence (workers BullMQ §2, ou répliques
horizontales) doit re-questionner cette limite : plusieurs `gdalwarp`/imports simultanés sur un
même conteneur à 4096M reproduiraient probablement l'incident d'origine.

**Recommandation** : avant une réplication horizontale de `api`, fixer explicitement
`connection_limit` dans `DATABASE_URL` (calculé en fonction du nombre de répliques prévues × pool
par réplique, pour ne pas dépasser `max_connections` de PostgreSQL) - actuellement chaque
réplique ouvrirait son propre pool par défaut, sans coordination.

## 4. Canal de notifications WebSocket - en mémoire, par process

`NotificationService` (voir aussi le nouveau centre de notifications unifié, §6) garde la table
de correspondance `userId → connexions WebSocket` dans une simple `Map` **en mémoire du
process Node courant** (`private clients: Map<string, WSClient[]>`). `notifyUser()` ne fait que
parcourir cette Map locale et écrire directement sur les sockets qu'elle contient.

**C'est un blocage net à toute réplication horizontale de `api`** : si l'application tourne un
jour derrière un load balancer avec plusieurs répliques, un utilisateur connecté à la réplique A
ne recevra JAMAIS en direct une notification déclenchée par un événement traité sur la réplique
B (ex. un job BullMQ traité par le worker de la réplique B, ou un autre utilisateur qui répond à
son commentaire via une requête HTTP routée vers B) - rien ne fait le pont entre les Map en
mémoire des différents process.

**Ce que le centre de notifications unifié (§6) corrige déjà, et ce qu'il ne corrige pas** :
depuis ce lot, `notifyUser()` persiste toujours la notification en base AVANT de tenter le push
WebSocket - un utilisateur sur la mauvaise réplique (ou simplement déconnecté) ne perd donc plus
l'événement, il le verra à son prochain chargement du centre de notifications (`GET
/notifications`). Ce qui reste non résolu : le push **temps réel** (badge qui s'incrémente sans
recharger la page) ne fonctionne encore que si l'émetteur et le destinataire sont traités par
la MÊME réplique.

**Recommandation si une réplication horizontale est un jour décidée** : introduire un bus
pub/sub partagé entre répliques pour le seul événement "pousser en direct" (Redis pub/sub est le
choix naturel ici - `RedisService` existe déjà dans le code, actuellement utilisé pour du
cache-aside simple, voir couches vivantes) - chaque réplique s'abonnerait au canal Redis et
relaierait vers ses propres connexions WebSocket locales. La persistance en base (déjà en place)
reste la garantie de fond quel que soit l'état de ce bus.

## 5. Test de charge existant - à qualifier honnêtement

`tests/load/basic-load.test.ts` est le seul test de charge présent dans le dépôt. Il **n'exerce
que l'endpoint `/health`, via injection interne Fastify (`app.inject()`), pas un vrai serveur
HTTP réseau** - aucune connexion TCP réelle, aucun test de la couche réseau/reverse proxy, et
`/health` est le endpoint le plus léger possible (pas de requête PostGIS/MeiliSearch/Redis
substantielle). **Ce test ne donne aucun chiffre de capacité réelle de l'application** (débit
soutenable, latence sous charge sur un vrai endpoint métier) - à traiter comme un smoke test de
démarrage (le process répond, rien de plus), jamais comme une preuve de scalabilité. Un vrai test
de charge (k6, Artillery, ou équivalent, contre un déploiement réel) reste à écrire avant toute
annonce de capacité.

## 6. Ce que ce lot a déjà changé (pour référence)

- `Notification` (nouveau modèle Prisma) : `notifyUser()` persiste désormais systématiquement
  avant tout push WebSocket (voir §4) - la persistance seule ne résout pas le temps réel
  multi-réplique, mais garantit qu'aucun événement n'est plus perdu silencieusement.
- Deux nouveaux points d'appel effectivement notifiants qui ne l'étaient pas avant ce lot :
  réponse à un commentaire (`ReplyToCommentUseCase`), changement de statut d'un signalement
  (`UpdateFeedbackStatusUseCase`, uniquement si `FeedbackSubmission.userId` est renseigné - un
  retour anonyme n'a pas de compte à notifier).
