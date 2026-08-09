# RFC (Request for Comments)

Un dossier `docs/rfc/` complementaire a [`docs/adr/`](../adr/README.md), mais pour l'inverse :
une ADR documente une decision deja prise ; une RFC propose un changement structurant **pas
encore construit**, pour en discuter avant d'ecrire du code. Utile pour des propositions assez
grosses pour meriter un vrai design ecrit plutot qu'une simple issue GitHub - typiquement
plusieurs semaines de travail, ou qui touchent a la securite/l'architecture de facon durable.

Cycle de vie d'une RFC : `Brouillon` -> discutee en issue/PR -> soit `Acceptee` (elle devient la
base d'un travail d'implementation, et peut donner naissance a une ou plusieurs ADR une fois les
decisions concretement prises) soit `Rejetee`/`Differee` (gardee pour la tracabilite - une bonne
raison de dire non aujourd'hui vaut la peine d'etre relue dans un an).

## Index

| # | Titre | Statut |
|---|---|---|
| [0001](0001-plugin-marketplace.md) | Marketplace de plugins PyQGIS/QGIS Server | Brouillon |
