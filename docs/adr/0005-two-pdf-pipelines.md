# 0005. Deux moteurs de PDF distincts (PyQGIS vs Puppeteer/HTML)

Statut : Accepte
Date : 2026-08-08

## Contexte

GeOSM genere deux familles de documents PDF tres differentes dans leur nature :

- **Plans de localisation** (`python_scripts/generate_location_plan.py`) : un document
  essentiellement *cartographique* - carte principale, carton de situation, legende, echelle,
  fleche du nord, mise en page a la millimetre proche de ce qu'on attend d'un vrai plan papier.
- **Rapports d'analyse IA** (`infrastructure/pdf/report-template.ts` +
  `report-renderer.service.ts`) : un document essentiellement *editorial* - texte redige par
  Gemini, tableaux de statistiques, graphiques simples (repartition par couche), avec une carte
  de localisation en complement, pas comme piece centrale.

## Decision

Deux moteurs de rendu distincts, choisis pour ce que chacun fait le mieux plutot qu'un seul
moteur generaliste force sur les deux usages :

- **PyQGIS** (`QgsLayoutItemLegend`, `QgsLayoutItemMap`...) pour les plans de localisation - le
  moteur de mise en page cartographique de QGIS gere nativement l'echelle, les projections, les
  legendes dynamiques et l'agencement de cartons, exactement ce qu'un plan papier exige.
- **HTML -> PDF via Puppeteer/Chromium** (`ReportRendererService`) pour les rapports d'analyse -
  du texte, des tableaux et une mise en page a base de CSS (flexbox/SVG) suffisent largement, et
  editer un gabarit HTML/CSS est bien plus accessible a un contributeur que manipuler l'API
  Python de QGIS pour un document qui n'a pas besoin de sa precision cartographique. La section
  "Zone analysee" de ces rapports (voir `ZoneBasemapService`) reste volontairement un simple
  carton de localisation en tuiles/WMS - pas une vraie carte imprimable comme un plan de
  localisation - justement parce que ce n'est pas l'objet du document.

## Consequences

- Deux stacks techniques differentes a maintenir pour "generer un PDF" (l'image Docker de
  production installe a la fois `python3-qgis` ET `chromium`, voir le `Dockerfile` racine) -
  plus de surface a maintenir qu'un seul moteur, mais chaque partie reste plus simple prise
  individuellement.
- Un contributeur qui veut ajouter un nouveau type de rapport texte (voir l'idee de "templates
  de rapport pluggables") n'a besoin de toucher qu'a du HTML/CSS/TypeScript - aucune competence
  PyQGIS requise pour cette famille de documents.
- A l'inverse, ameliorer la mise en page cartographique des plans de localisation demande de
  connaitre l'API PyQGIS, distincte du reste de la base de code TypeScript.
- Le rendu HTML->PDF (Puppeteer) reste volontairement autonome - aucune requete reseau externe
  au moment du rendu, tout est deja recupere/encode en base64 avant d'appeler
  `page.setContent()` (voir `ZoneBasemapService`, qui recupere le fond de carte AVANT de
  construire le HTML) - un choix qui evite qu'un rendu de rapport echoue ou soit lent a cause
  d'une ressource externe indisponible au mauvais moment.

## Alternatives envisagees

- **Un seul moteur PyQGIS pour tout** : ecarte - forcer un document essentiellement textuel
  (rapport d'analyse) dans le moteur de mise en page cartographique de QGIS aurait ete plus
  complexe pour un gain visuel marginal, et aurait rendu la contribution aux rapports
  inaccessible a un contributeur qui ne connait que le web.
- **Un seul moteur HTML/CSS pour tout** (y compris les plans de localisation) : ecarte - un vrai
  plan de localisation a besoin d'une echelle cartographique exacte, d'une projection maitrisee
  et d'une legende qui reflete precisement les couches actives, ce qu'un rendu HTML/CSS ne fait
  pas nativement aussi bien qu'un moteur de mise en page cartographique dedie.
