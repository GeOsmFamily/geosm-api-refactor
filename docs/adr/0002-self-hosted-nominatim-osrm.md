# 0002. Auto-hebergement de Nominatim et OSRM plutot que les serveurs publics de demonstration

Statut : Accepte
Date : 2026-08-08

## Contexte

Le geocodage (recherche d'adresses) et le calcul d'itineraires sont d'abord partis integres via
les serveurs de demonstration publics d'OpenStreetMap (`nominatim.openstreetmap.org`,
`router.project-osrm.org`). Ces serveurs sont gratuits mais soumis a une politique d'usage
explicite ("light testing only", limite a environ 1 requete/seconde, blocage par User-Agent en
cas d'abus) - une politique pensee pour du test ponctuel, pas pour absorber le trafic reel d'un
geoportail public en production, potentiellement plusieurs pays a la fois.

## Decision

Nominatim et OSRM sont auto-heberges dans `docker-compose.prod.yml`, a partir d'un extract OSM
reel du pays concerne (voir `scripts/setup-osrm-data.sh` pour OSRM - extract/partition/customize
via l'image officielle `osrm/osrm-backend`). OSRM va plus loin : chaque profil de deplacement
(voiture/velo/pieton) tourne dans son **propre conteneur**, avec son propre graphe de routage
construit a partir d'un profil Lua different (`OSRM_URL_CAR`/`OSRM_URL_BICYCLE`/`OSRM_URL_FOOT`,
voir `OSRMService.resolveBaseUrl()`), plutot qu'un unique serveur mono-profil.

Les serveurs publics restent le comportement de repli par defaut en developpement local (`.env`
pointe vers `localhost` pour les deux), pour ne pas forcer chaque contributeur a importer un
extract OSM reel juste pour lancer l'application.

## Consequences

- Le geoportail ne depend plus d'un tiers dont la politique d'usage est explicitement
  incompatible avec un trafic de production - plus de risque de blocage brutal du service de
  recherche/routage en pleine utilisation reelle.
- En contrepartie, chaque deploiement doit desormais gerer un extract OSM par pays (le
  telecharger, le maintenir a jour), et les conteneurs Nominatim/OSRM consomment des ressources
  serveur significatives (RAM/disque) qui n'existaient pas avant - le cout d'infrastructure par
  pays deploye augmente reellement.
- Le graphe OSRM etant construit une fois a l'import, un changement du reseau routier reel
  (nouvelle route, route fermee) n'est visible qu'apres un reimport manuel - pas de mise a jour
  incrementale automatique aujourd'hui.
- Multiplier les conteneurs OSRM (un par profil) plutot qu'un seul serveur multi-profil
  augmente la complexite operationnelle (trois processus a superviser au lieu d'un) en echange
  d'un routage reellement adapte a chaque mode de deplacement (un graphe voiture n'emprunte pas
  les memes voies qu'un graphe pieton).

## Alternatives envisagees

- **Garder les serveurs publics de demonstration** : ecarte des le premier test de charge reel -
  la politique d'usage aurait fini par bloquer le service en production, silencieusement, au pire
  moment.
- **Un fournisseur commercial de geocodage/routage** (Google, Mapbox, HERE...) : ecarte pour deux
  raisons - le cout par requete devient vite prohibitif a l'echelle d'un geoportail public
  gratuit, et ca introduirait une dependance a un service tiers non-libre dans un projet dont la
  donnee source (OpenStreetMap) est elle-meme entierement libre - incoherent avec la philosophie
  du projet.
- **Un unique serveur OSRM multi-profil** (comme le serveur de demonstration public) : reste
  possible en repli (`OSRM_URL` sans les variables par profil), mais pas retenu comme
  configuration de production par defaut - le detail par profil etait juge suffisamment
  important pour la qualite du routage pieton/velo pour justifier la complexite additionnelle.
