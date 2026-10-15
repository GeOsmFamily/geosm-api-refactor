# Conformité aux maquettes (558 images, 75 écrans)

Chaque écran existe en 6 variantes : desktop, tablette et mobile, chacune en clair et en sombre. La référence est le dossier « Maquettes GeOsm V2 ». Les captures de contrôle se refont avec `scripts/e2e-live/snap.mjs`, dans le dépôt frontend.

Légende :
- **Conforme** : comparé en desktop clair, mobile clair et desktop sombre.
- **Planifié** : étape du planning qui le couvre.
- **Non planifié** : écart sans étape prévue, à arbitrer.

## Conformes (phase 1, 16 oct)

| Écran | Remarques |
|---|---|
| 00 Design system | Couleurs, rayons, champs et boutons repris. Police Avenir Next Rounded conservée : Nunito n'est qu'une substitution dans les maquettes (voir docs/v2/theme.md). |
| 01 Shell desktop et mobile | Icônes au trait, pastille « CAMEROUN, Afrique », avatar. Sur mobile, la pastille est réduite à la flèche et l'avatar ouvre le tiroir. |
| 02 Onboarding monde | Vrais contours du monde (Natural Earth) au lieu des formes stylisées de la maquette. Mêmes couleurs, étiquettes et repères. Un clic sur un continent zoome et affiche ses pays. |
| 02 Onboarding recherche | Pays qui commencent par la saisie, avec drapeau et continent, et les continents éclaircis pendant la recherche. Ajout : « Bientôt disponible » pour un pays non ouvert (RG-B-03). |
| 02 Accueil pays | Silhouette réelle du pays (1:50m) et sous-région (« Afrique centrale »). |
| 03 Connexion, inscription, mot de passe oublié, nouveau mot de passe, vérification d'email | Illustration redessinée en SVG (thèmes clair et sombre). |
| 31 Paramètres | Fenêtre par-dessus la page, avec langue, unités, thème et notifications. |
| 69 Notifications | Non lues en carte bleu marine, pastilles d'initiales colorées selon le type. |
| 70 Notifications vide | |

### Écarts volontaires (à valider)

1. **Textes en français** : la maquette de connexion affiche « Welcome », « Password » et « At least 8 characters ». J'ai mis « Bienvenue », « Mot de passe » et « Au moins 8 caractères », traduits en/es.
2. **Bouton OpenStreetMap** sur la connexion : absent des maquettes, mais exigé par RG-A-09. Il n'apparaît que si OSM est configuré.
3. **« Se souvenir de moi »** retiré, comme sur la maquette : la session est conservée par défaut.
4. **Indicateur des critères du mot de passe** (RG-A-02), sous le champ, à l'inscription et au changement de mot de passe.
5. **« Continuer sans vérifier pour le moment »** sous l'écran de vérification d'email : RG-A-05 autorise la consultation sans vérification.
6. **« Personnaliser par catégorie »** dans les paramètres : la maquette n'a qu'un interrupteur global, le planning prévoit des préférences par catégorie.
7. **Icône du tiroir de tâches** (exports, imports) dans l'en-tête, à côté de l'avatar : absente des maquettes, fonction existante conservée.
8. **Changement de mot de passe** (écran 03-new-password, avec ancien mot de passe) : accessible depuis le menu du compte, entrée « Mot de passe ».

## Planifiés

| Écrans | Étape | Date |
|---|---|---|
| 04 Carte (OSM, satellite, IGN, N&B), 05 à 19 (catalogue, couches, légende, fiche, outils, annotation, itinéraire, mesures, menu contextuel, commentaire, partage, impression, export, plus proche, analyse) | 2.1b Panneaux carte | 10-11 nov |
| 20 à 30, 32, 33 (altimétrie, statistiques, comparaison, Mapillary, import, géosignets, mes cartes, fiche, zoom, assistant, tâches, recherche d'adresse, plan de localisation) | 2.1c Outils secondaires | 12 nov |
| 51 à 57 Fil social | 2.4 Frontend fil | 20-25 nov |
| 39, 40 Modération | 2.5 | 27 nov |
| 58 à 61 Groupes | 3.1 | 30 nov - 2 déc |
| 62 à 65 Événements | 3.2 | 3-7 déc |
| 66 à 68 Messagerie | 3.3 | 8-10 déc |
| 71, 74 Connexions | 3.4 | |
| 72, 73, 75 Profil et badges | 3.5 | |
| 44 à 46 Instances (formulaire avec parent, type et drapeau) | 3.6 | 18 déc |
| Tablette et mobile de tous les écrans | 4.3 Qualité | 24-28 déc |

## Non planifiés : à arbitrer

Les écrans d'administration suivants ont une maquette mais aucune étape de refonte :

| Écran | État actuel |
|---|---|
| 34 Accueil admin | Barre latérale claire, autres indicateurs. La maquette a une barre bleu nuit, 4 indicateurs dont « Posts aujourd'hui » et un graphique sur 7 jours. |
| 35 Analytics, 36 Arbre du catalogue, 37 Fonds de carte, 38 Thèmes par défaut | Pages existantes au style v1 |
| 41 FAQ, 42 Retours, 43 Infrastructure, 47 Tâches, 48 Observabilité, 49 Données personnelles, 50 Utilisateurs | Pages existantes au style v1 |

Remarque relevée au passage : l'indicateur « Instances actives » de l'accueil admin affiche 83. Il compte toutes les instances (continents et pays non ouverts compris), pas seulement les pays actifs.

**Estimation** : une coque admin commune (barre latérale, en-tête, cartes d'indicateurs) puis 15 pages à rhabiller, environ 3 jours.

**Options** :
- l'intégrer à la réserve et à l'étape 4.3 ;
- la placer en phase 3 à la place d'une étape de l'ordre de coupe ;
- la traiter en v2.1.
