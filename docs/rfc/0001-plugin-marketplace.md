# 0001. Marketplace de plugins PyQGIS/QGIS Server

Statut : Brouillon
Date : 2026-08-08
Auteur : etude de faisabilite demandee par le porteur du projet

## Resume

GeOSM utilise deja PyQGIS (scripts serveur) et QGIS Server (WMS/WFS) au coeur de son
architecture. L'idee : permettre a des developpeurs SIG externes d'ecrire des "plugins GeOSM"
en PyQGIS, de les publier, et de laisser un administrateur d'instance les installer sur son
portail pour ajouter une nouvelle capacite de visualisation/analyse - sans toucher au code du
coeur GeOSM.

**Verdict de cette etude : faisable et coherent avec la philosophie du projet (elle prolonge
l'usage de PyQGIS deja existant), mais un vrai chantier - pas un projet d'un week-end.** La
partie difficile n'est pas de "faire tourner un plugin", c'est de le faire tourner **de facon
sure** quand le code vient d'un tiers non verifie. Cette RFC propose donc un phasage explicite
qui commence delibrement PETIT et FERME (un registre curie, pas de code arbitraire auto-execute)
avant d'envisager une vraie ouverture self-service.

## 1. Etat des lieux (ce sur quoi s'appuyer)

Cette section resume une investigation reelle du code existant, pas des hypotheses :

- **Un contrat d'invocation existe deja, informellement.** Les 20 scripts de
  `python_scripts/*.py` passent tous par un unique point d'entree cote Node,
  `QGISProjectService.runPythonScript()` (`src/infrastructure/qgis/qgis-project.service.ts`) :
  arguments positionnels en ligne de commande (une structure complexe passe en un seul argument
  JSON stringifie), et **une seule ligne JSON sur stdout** en sortie (`{success, error?, ...}`),
  parsee par le wrapper Node. Ce n'est pas un contrat pense pour du code tiers, mais c'est deja
  un contrat coherent - la base naturelle a formaliser plutot qu'a reinventer.
- **QGIS Processing a deja un precedent reel dans ce depot.** `python_scripts/clip_export.py`
  appelle `processing.run('native:clip', {...})` - un vrai algorithme `QgsProcessingAlgorithm`
  natif, pas juste des appels procéduraux a l'API `QgsVectorLayer`/`QgsProject`. C'est important :
  la tres grande majorite des plugins QGIS Desktop existants dans l'ecosysteme (des centaines,
  publies sur `plugins.qgis.org`) exposent leur logique via des sous-classes
  `QgsProcessingAlgorithm`, un format que des developpeurs PyQGIS connaissent deja. S'appuyer sur
  ce format plutot que d'inventer un format de plugin totalement nouveau reduit enormement la
  barriere d'entree pour les contributeurs cibles.
- **Aucune sandbox aujourd'hui - a corriger AVANT tout code tiers, marketplace ou pas.** Les
  scripts PyQGIS tournent actuellement dans le **meme conteneur** que l'API (memes paquets
  systeme installes dans le `Dockerfile` racine), heritent de **tout l'environnement du process
  Node parent** (`clip_export.py`/`generate_location_plan.py` lisent `DATABASE_URL` heritee),
  et sont invoques via `child_process.exec` (une chaine shell, pas `execFile` + tableau d'argv) -
  un point d'echappement shell a corriger independamment de cette RFC. Le seul garde-fou existant
  est un timeout de 10 minutes. Publier un marketplace sans corriger ce point reviendrait a
  donner a n'importe quel auteur de plugin un acces de fait aux identifiants de la base de
  production.
- **Aucun registre d'operations extensible n'existe.** `RasterAnalysisType` (dans
  `src/application/use-cases/rasters/run-raster-analysis.use-case.ts`) est un type TypeScript
  ferme (`'global' | 'zonal' | 'custom'`), pas une liste ouverte. Un marketplace demande de faire
  evoluer ce genre de type ferme vers un registre pilote par une table en base.
- **QGIS Server (`3liz/qgis-map-server:3.34`, alias "Py-QGIS-Server") n'a, a ma connaissance
  verifiee dans ce depot, aucune configuration de plugin server-side** (pas de repertoire de
  plugins monte, pas de variable d'env liee, aucune reference a `QgsServerFilter`/`serverIface`
  nulle part dans le code). Je n'ai pas pu determiner depuis ce depot si cette implementation
  supporte meme l'API classique des plugins QGIS Server (celle de `qgis_mapserver` derriere
  Apache/mod_wsgi) - **point a verifier auprès du projet 3liz avant de s'engager sur cette voie**.
  Consequence pour cette RFC : le design propose n'essaie PAS de brancher les plugins sur QGIS
  Server directement, il reste sur le pattern deja maitrise (backend Node -> script PyQGIS ->
  resultat JSON), plus sur, plus documente, et qui ne depend pas d'une fonctionnalite non
  confirmee d'une image tierce.

## 2. Format d'un plugin GeOSM

Un plugin est un paquet minimal :

```
mon-plugin-geosm/
├── geosm-plugin.json      # manifeste (voir ci-dessous)
├── algorithm.py           # une sous-classe QgsProcessingAlgorithm (format Processing standard)
└── README.md
```

`geosm-plugin.json` :

```json
{
  "id": "flood-risk-buffer",
  "name": { "fr": "Zone de risque d'inondation", "en": "Flood risk buffer" },
  "version": "1.0.0",
  "author": "jane-doe",
  "repository": "https://github.com/jane-doe/geosm-plugin-flood-risk",
  "category": "analysis",
  "geosmApiVersion": "^3.1.0",
  "inputs": [
    { "name": "layerId", "type": "layer", "geometryType": "LineString", "label": { "fr": "Cours d'eau", "en": "Waterway" } },
    { "name": "bufferMeters", "type": "number", "default": 100, "min": 10, "max": 2000 }
  ],
  "output": { "type": "vector-layer", "geometryType": "Polygon" },
  "algorithmId": "flood_risk:buffer_zone"
}
```

Pourquoi le format Processing plutot qu'un script procedural libre : les entrees/sorties d'un
`QgsProcessingAlgorithm` sont deja auto-descriptibles (`initAlgorithm()` declare ses parametres
avec leurs types) - le manifeste JSON ci-dessus n'est en grande partie qu'un miroir lisible cote
TypeScript de ce que l'algorithme declare deja cote Python, pas une double saisie arbitraire.
Ca permet aussi de reutiliser, en theorie et sous reserve de revue, des algorithmes deja
publies dans l'ecosysteme QGIS plutot que d'exiger que chaque auteur reparte de zero.

## 3. Modele de distribution : un registre curie, pas une auto-execution ouverte

**Ce que cette RFC ne propose PAS pour un premier lot** : un formulaire "uploadez votre script,
il tourne immediatement sur votre instance". C'est le design le plus dangereux possible pour un
projet qui deploie des donnees publiques de plusieurs pays - un seul plugin malveillant ou
buggue installe par un administrateur d'instance mal informe expose potentiellement les donnees
de TOUTES les instances partageant la meme base (voir ADR
[0001](../adr/0001-multi-instance-single-database.md), qui documente deja que l'isolation entre
instances repose sur la discipline applicative, pas sur une frontiere physique).

**Ce qui est propose a la place** : un modele proche de Homebrew Cask ou du catalogue
communautaire Docker Hub avant les builds automatises - un depot Git public
(`geosm-plugins-registry`) contenant un `index.json` + un dossier par plugin. Publier un plugin =
ouvrir une Pull Request sur ce depot. Une revue humaine legere (le code fait-il ce qu'il
pretend faire, pas de `subprocess`/`socket`/acces fichier hors de ce qui est necessaire) merge
ou refuse. Un administrateur d'instance parcourt ce registre depuis le back-office (nouvelle
section "Plugins", naturellement voisine des sections deja existantes Jobs/Observabilite/Docker,
voir `docs/fonctionnalites-detaillees.md` section 29) et installe un plugin en un clic - ce qui
declenche un `git clone`/telechargement cote serveur du plugin **deja revu**, pas un upload libre.

## 4. Executer un plugin en confiance : la sandbox (prerequis non negociable avant toute ouverture publique)

Avant tout accueil de code tiers reel (meme revu), l'execution des scripts PyQGIS doit changer
de modele :

1. **Sortir l'execution du conteneur API.** Un worker dedie, image separee, avec uniquement les
   paquets PyQGIS necessaires - pas le reste de la stack Node/API.
2. **Retirer l'heritage total de l'environnement.** Le worker ne recoit QUE ce dont un plugin a
   legitimement besoin (ex. un jeton de lecture scope a une seule couche, jamais `DATABASE_URL`
   brut).
3. **Isolation reseau/systeme de fichiers.** Filesystem en lecture seule sauf un repertoire de
   travail temporaire jete apres chaque execution ; pas d'acces reseau sortant par defaut (un
   plugin qui a legitimement besoin d'un appel externe le declare dans son manifeste, revu au
   meme titre que le reste).
4. **Limites de ressources reelles par execution** (CPU/memoire/temps), pas seulement le timeout
   global actuel de 10 minutes partage par tout le service.
5. **Options d'isolation a evaluer** (par ordre de maturite operationnelle croissante) : conteneur
   Docker durci (`--read-only`, `--network=none`, `--memory`, `--pids-limit`, utilisateur non-root
   dedie) comme premiere marche ; `gVisor` (runsc) comme isolation noyau renforcee sans changer
   l'outillage Docker existant ; Firecracker/microVM si le volume d'executions tierces justifie
   un jour cet investissement operationnel plus lourd.

Ce chantier de sandbox a une valeur **independamment** du marketplace : il corrige une faiblesse
deja presente aujourd'hui (section 1) meme sans jamais accueillir de plugin tiers.

## 5. Comment un plugin devient visible/utilisable

- **Modele de donnees** (nouveau, evolution du pattern `BaseMap`/`DefaultTheme` deja existant) :
  une table `InstalledPlugin` (id, manifest JSON, algorithmId, category, source (url du registre),
  version, instanceId nullable [installation globale ou par instance], enabled, installedBy,
  installedAt).
- **Execution** : un nouveau `RunPluginUseCase` generique, qui valide les entrees fournies contre
  le schema du manifeste (Zod construit dynamiquement depuis `inputs`), puis pousse un job dans
  une queue BullMQ dediee (`plugin-execution`, meme pattern que `analysis-report`/
  `raster-analysis` deja en place, voir ADR
  [0004](../adr/0004-bullmq-for-async-work.md)) - la progression et le resultat suivent le meme
  canal WebSocket que le reste (`NotificationService`), rien de nouveau a inventer cote suivi de
  tache.
- **UI** : un panneau qui lit dynamiquement les plugins installes et genere un formulaire depuis
  `inputs` (champ couche / nombre / texte / booleen selon le type declare) + un rendu de resultat
  generique selon `output.type` (nouvelle couche vectorielle ajoutee a la carte, tableau de
  statistiques, ou document a telecharger). C'est directement le meme principe que la boite de
  dialogue auto-generee du **Processing Toolbox de QGIS Desktop** a partir des parametres d'un
  `QgsProcessingAlgorithm` - un contributeur PyQGIS qui connait deja ce panneau cote QGIS
  Desktop retrouve un principe familier cote GeOSM, pas une interface a apprendre de zero.

## 6. Phasage propose

| Phase | Livrable | Risque |
|---|---|---|
| **0 (prealable, prioritaire)** | Sortir l'execution PyQGIS du conteneur API + retirer l'heritage de `DATABASE_URL`/env complet, meme sans aucun plugin tiers | Corrige une faiblesse deja reelle aujourd'hui |
| **1 (MVP marketplace)** | Registre Git curie (revue humaine obligatoire), 3-5 plugins de reference ecrits par l'equipe coeur pour valider le format, UI d'installation dans le back-office, execution dans le worker isole de la phase 0 | Faible - tout le code execute a ete revu par des mainteneurs de confiance |
| **2** | Ouverture aux soumissions communautaires via PR sur le registre, badge "verifie" pour les auteurs recurrents, scan statique automatique (bandit/semgrep) comme premiere passe avant revue humaine | Moyen - surface plus large, mais toujours une revue humaine avant merge |
| **3 (optionnel, a ne decider qu'avec du recul d'usage reel)** | Soumission self-service avec sandbox durcie suffisamment forte pour se passer d'une revue humaine prealable systematique | Eleve si la sandbox de la phase 0/1 n'a pas ete serieusement eprouvee en production d'abord |

## 7. Questions ouvertes

- **Confirmer aupres de 3liz** si `qgis-map-server` supporte les plugins QGIS Server classiques -
  si oui, une deuxieme categorie de plugins ("plugins de rendu WMS/WFS", distincts des plugins
  d'analyse ci-dessus) devient envisageable en phase ulterieure, hors perimetre de cette RFC.
- **Licence des plugins soumis** : imposer une licence open-source compatible (le projet GeOSM
  lui-meme est open-source) pour tout plugin accepte dans le registre officiel ?
  - a trancher avec le porteur du projet, pas une decision technique.
- **Cout d'hebergement du worker isole** (phase 0) sur les VPS deja utilises pour un deploiement
  national typique (voir ADR [0001](../adr/0001-multi-instance-single-database.md) sur la
  contrainte budgetaire des deploiements cibles) - a chiffrer avant de s'engager sur la phase 0.
- **Gouvernance du registre** : qui a les droits de merge sur `geosm-plugins-registry` a terme -
  uniquement les mainteneurs coeur, ou un groupe de revue elargi avec ses propres regles ?

## 8. Conclusion

L'idee est solide et prolonge naturellement ce que GeOSM fait deja (PyQGIS, Processing,
architecture par jobs asynchrones suivis en WebSocket) plutot que d'importer un concept etranger
au projet. Le risque n'est pas dans l'idee elle-meme mais dans l'ordre d'execution : construire
la sandbox (phase 0) et le registre curie (phase 1) AVANT toute promesse publique d'un
marketplace ouvert (phase 3), pour ne jamais se retrouver a devoir fermer une porte deja ouverte
a la communaute. Recommandation : traiter la phase 0 comme un correctif de securite independant
a planifier des maintenant, et la phase 1 comme un vrai projet a chiffrer separement une fois la
phase 0 livree.
