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

### Écarts volontaires (validés le 16 oct, à condition que tout reste traduisible en fr/en/es)

1. **Textes en français** : la maquette de connexion affiche « Welcome », « Password » et « At least 8 characters ». J'ai mis « Bienvenue », « Mot de passe » et « Au moins 8 caractères », traduits en/es.
2. **Bouton OpenStreetMap** sur la connexion et l'inscription : oublié dans les maquettes, ajouté à la demande (RG-A-09). Toujours visible, au style des boutons secondaires, sous le séparateur « ou ». Si OSM n'est pas configuré sur le serveur, un clic affiche un message.
3. **« Se souvenir de moi »** retiré, comme sur la maquette : la session est conservée par défaut.
4. **Indicateur des critères du mot de passe** (RG-A-02), sous le champ, à l'inscription et au changement de mot de passe.
5. **« Continuer sans vérifier pour le moment »** sous l'écran de vérification d'email : RG-A-05 autorise la consultation sans vérification.
6. **« Personnaliser par catégorie »** dans les paramètres : la maquette n'a qu'un interrupteur global, le planning prévoit des préférences par catégorie.
7. **Icône du tiroir de tâches** (exports, imports) dans l'en-tête, à côté de l'avatar : absente des maquettes, fonction existante conservée.
8. **Changement de mot de passe** (écran 03-new-password, avec ancien mot de passe) : accessible depuis le menu du compte, entrée « Mot de passe ».

## Conformes (étape 2.1b, 16 oct)

| Écran | Remarques |
|---|---|
| 04 Carte | Carte plein écran, recherche en pastille blanche, barre de droite (catalogue, couches avec compteur, outils, outils épinglés), commandes rondes en bas à droite (légende, plein écran, zoom). |
| 05 Catalogue, fonds de carte | Onglets, recherche, groupes en accordéon, cases à cocher ; fonds en liste avec vignette, choix mémorisé. |
| 06 Couches actives, opacité | Vignette (poignée de tri), corbeille, œil, détail avec curseur d'opacité et liens Infos, Style, Noir et blanc. |
| 07 Légende | Pastilles plates par géométrie, image de légende WMS. |
| 08 Fiche descriptive | Panneau à droite, repère rouge sur le point cliqué, étiquettes, attributs, liens Wikipedia, Wikidata, OpenStreetMap. |
| 09 Outils | Interrupteurs qui épinglent l'outil dans la barre ; un seul panneau d'outil ouvert à la fois. |
| 10 Annoter la carte | Création et Édition en boutons carrés. |
| 11 Itinéraire (formulaire, résultat) | Départ, Arrivée, Passage avec bouton cible, Réinitialiser, mode de transport, Calculer ; trajet vert et étiquette de distance sur la carte. |
| 12 Mesures | Pas de panneau, résultat en étiquette blanche sur la carte. |
| 13 Menu contextuel | Quatre actions, « Ajouter un commentaire » mis en avant. |
| 14 Ajouter un commentaire | Liste des commentaires prédéfinis de l'instance (étape 2.1a), bouton Commenter. |
| 15 Partager | Lien à copier, Facebook, WhatsApp, e-mail. |
| 16 Imprimer, 17 Exporter | Choix PDF ou PNG. |
| 18 Rechercher le plus proche | Liste Catégorie avec coche, carte de résultat avec épingle, pointillés vers le résultat. |
| 19 Analyse spatiale | Opérations en grille 2 x 2, Distance (m), Calculer. |

Vérifié en desktop clair, desktop sombre et mobile (clair ou sombre selon l'écran). Les 20 outils s'ouvrent sans erreur JS (`scripts/e2e-live/tools.mjs`) et le parcours navigateur passe à 35/35. Dans l'environnement de test, OSRM et Nominatim sont absents : l'écran de résultat d'itinéraire a été contrôlé avec une réponse simulée, et le plus proche donne la distance à vol d'oiseau.

### Écarts de l'étape 2.1b (tous traduits en fr/en/es)

Décision du 16 oct : tous les outils, y compris ceux sans maquette, suivent le nouveau design (étape 2.1c).


1. **Panneau blanc à gauche** des maquettes 09 à 19 ignoré : ces maquettes sont d'une génération antérieure, la carte reste plein écran comme sur 04 à 08.
2. **Position des panneaux** : en haut, à gauche de la barre de droite, sans la recouvrir. Les maquettes les placent plus bas, à hauteur variable.
3. **« Autres outils »** dans le panneau Outils, pour les outils sans maquette (téléchargement de données, altimétrie, statistiques, comparaison, Mapillary, plan de localisation, mes données, géosignets, mes cartes, assistant, à propos, commentaires de la carte, mise en page d'impression).
4. **Boutons retirés de la carte** : annuler/rétablir la vue, emprise de l'instance et fenêtre de zoom. **Géolocalisation conservée** (décision du 16 oct) : bouton rond au-dessus du zoom, un second clic efface la position.
5. **Couches actives** : carte de chaleur, partage, resynchronisation (admins), suggestions et « Tout retirer » conservés. « Style » ouvre la légende.
6. **Fiche descriptive** : actions Zoomer, Itinéraire et Télécharger conservées sous les liens.
7. **Menu contextuel** : sous un filet, les actions existantes (informations sur le lieu, itinéraire depuis ou vers ici, copier les coordonnées, centrer, zoomer).
8. **Commentaire** : champ de texte modifiable sous la liste (le choix prédéfini le pré-remplit). Un visiteur voit une invitation à se connecter. Le serveur exige une adresse email vérifiée.
9. **Partager** : la maquette contient un texte de remplissage (« This blog post has been published… »), remplacé par une phrase sur le lien.
10. **Imprimer / Exporter** : Imprimer ouvre la boîte d'impression du navigateur, Exporter télécharge le fichier. La mise en page détaillée (titre, format, orientation, légende) reste dans « Autres outils ».
11. **Annoter** : bouton Cercle en plus. En Édition, le 3e bouton (sans icône sur la maquette) sert à modifier les sommets. « Mes annotations » garde Sauvegarder, Charger et Tout effacer.
12. **Itinéraire** : mode Vélo en plus, lien « + Ajouter une étape », adresse saisie géocodée, multimodal et isochrone sous « Options avancées », distance, durée et profil altimétrique dans le panneau.
13. **Mesures** : petite barre en bas de carte (geste à faire, Tout effacer, Terminer), sinon rien n'indique comment finir ou effacer.
14. **Plus proche** : les catégories sont les couches actives, pas une liste fixe. Trois résultats au lieu d'un, avec Zoomer et Itinéraire.
15. **Analyse spatiale** : choix de la géométrie à tracer et boutons « Tracer la géométrie A / B », nécessaires au calcul.

## Conformes (étape 2.1c, 16 oct)

| Écran | Remarques |
|---|---|
| 20 Profil altimétrique | Altitudes min et max en cartes, courbe verte, phrase de synthèse (distance totale, dénivelé). |
| 21 Statistiques & analyse | Synthèse en encadré, chiffres en barres, « Générer un rapport PDF », « Mes rapports ». |
| 22 Comparaison | Balayage sur la carte : ligne, poignée « ‹ › », une pastille au nom de chaque fond. |
| 23 Mapillary « Vue de rue » | Visionneuse centrée, Précédent / Suivant dans la séquence, Télécharger, date et séquence. |
| 24 Importer mes données | Formats en sous-titre, zone de dépôt, « Imports précédents » avec pastille d'état. |
| 25 Mes géosignets | Nombre de positions, épingle verte, coordonnées, « Aller à ». |
| 26 Mes cartes | Grille de cartes avec vignette, « Modifiée le … », « Ouvrir ». |
| 29 Assistant GeOsm | Volet pleine hauteur, « En ligne », bulles, champ et bouton d'envoi ronds. |
| 30 Tâches en cours | Carte en bas à droite, pastille et barre de progression par tâche. |
| 32 Recherche d'adresse | Pastille de recherche, liste avec glyphe gris au trait. |
| 33 Plan de localisation | Aperçu qui suit les éléments cochés, cases Légende / Échelle / Grille / Flèche du nord, « Générer le PDF ». |

**Outils sans maquette, au même design** (décision du 16 oct) : téléchargement de données, à propos de la carte, commentaires de la carte, mise en page d'impression, informations sur un lieu, mon compte, métadonnées d'une couche, options avancées de l'itinéraire, carte de limite administrative de la recherche. Briques communes : `src/styles/_v2-tools.scss` (dépôt frontend).

Vérifié en desktop clair, desktop sombre, mobile clair et mobile sombre. Parcours navigateur : 20 outils sur 20, listes à cocher 20 sur 20 (`scripts/e2e-live/checks.mjs`), parcours complet 35 sur 35. Services absents du serveur de test, simulés pour juger les écrans : GDAL (import), modèle numérique de terrain (altitudes à 0), Mapillary, IA, OSRM, Nominatim, Meilisearch.

### Écarts de l'étape 2.1c (validés le 16 oct, tous traduits en fr/en/es)

1. **Placement** : les maquettes 20 à 33 viennent d'une autre génération (panneaux à gauche, à droite ou centrés, croix grise). Le panneau reste à droite avec l'en-tête des écrans 10 à 19 ; seules la comparaison (balayage), Mapillary (visionneuse centrée), l'assistant (volet pleine hauteur) et les tâches (carte bas-droite) suivent leur maquette.
2. **Maquettes 27 et 28 non reproduites** : la bulle d'information (27) doublonne la fiche descriptive 08, la carte agrandie (28) doublonne le plein écran.
3. **« Aller aux coordonnées »** (ancienne fenêtre de l'écran 28) : la recherche accepte maintenant des coordonnées (« 3.87, 11.51 », « 3.8667° N 11.5167° E ») et propose « Aller à … ».
4. **Altimétrie** : bouton « Tracer une ligne » au-dessus des cartes d'altitude ; dénivelé ajouté à la phrase de synthèse.
5. **Statistiques** : choix « Une couche / Les N couches actives », analyse raster, par zone, choroplèthe et carroyage conservés dans le même style ; le sujet du rapport est saisi avant « Générer un rapport PDF ».
6. **Comparaison** : réglage dans le panneau avant le balayage, et pastille « Terminer la comparaison » en bas de carte pour en sortir.
7. **Mapillary** : pas de mini-carte en incrustation (le repère rouge sur la carte montre la position) ; lecture automatique, vitesse et vue interactive sous la photo.
8. **Import** : confirmation (nom, rangement, couleur, forme), style, QML, publication et suppression conservés ; « Mode d'emploi » replié.
9. **Géosignets et Mes cartes** : champ pour enregistrer la vue ou la carte courante en haut ; partage et suppression conservés.
10. **Assistant** : onglets des conversations sous l'en-tête, croix de fermeture (le volet couvre la barre de droite comme sur la maquette).
11. **Tâches en cours** : ouvertes par l'icône de l'en-tête (écart 7 de la phase 1) et automatiquement quand une tâche démarre ; barre animée faute de pourcentage connu.
12. **Plan de localisation** : choix du lieu au-dessus de l'aperçu ; titre, repère, IA, échelle, format, orientation et itinéraire d'accès dans « Contenu et format ».

### Corrections faites pendant la 2.1c

- Cases cochées invisibles (règle globale v1 sur les `input`) : catalogue de données et toutes les cases stylées.
- Panneau Outils et Paramètres : le nom bascule aussi l'interrupteur.
- Dates au format de la langue (« 10 oct. 2026 »), locales fr/en/es enregistrées.
- Retour de liaison OpenStreetMap : le panneau Mon compte s'ouvre enfin.
- Barre de droite défilante quand beaucoup d'outils sont épinglés (boutons inaccessibles sur mobile).
- Composants v1 inutilisés supprimés (ancienne fiche descriptive, fenêtre de coordonnées, ancien panneau d'outils, ancien panneau de couches).

## Planifiés

| Écrans | Étape | Date |
|---|---|---|
| 51 à 57 Fil social | 2.4 Frontend fil | 20-25 nov |
| 39, 40 Modération | 2.5 | 27 nov |
| 58 à 61 Groupes | 3.1 | 30 nov - 2 déc |
| 62 à 65 Événements | 3.2 | 3-7 déc |
| 66 à 68 Messagerie | 3.3 | 8-10 déc |
| 71, 74 Connexions | 3.4 | |
| 72, 73, 75 Profil et badges | 3.5 | |
| 44 à 46 Instances (formulaire avec parent, type et drapeau) | 3.6 | 18 déc |
| Tablette et mobile de tous les écrans | 4.3 Qualité | 24-28 déc |

## Écrans d'administration : décision du 16 oct

Quinze écrans d'administration avaient une maquette mais aucune étape de refonte. Décision : on les traite sur les samedis de réserve, puis on les finit à l'étape 4.3.

| Créneau | Écrans |
|---|---|
| Sam 7 nov (réserve phase 1) | Coque admin commune (barre latérale bleu nuit, en-tête, cartes d'indicateurs), 34 Accueil (avec correction de l'indicateur « Instances actives », qui compte aujourd'hui les 83 instances au lieu des pays ouverts), 35 Analytics |
| Sam 28 nov (réserve phase 2) | 36 Arbre du catalogue, 37 Fonds de carte, 38 Thèmes par défaut |
| Sam 19 déc (réserve phase 3) | 41 FAQ, 42 Retours, 43 Infrastructure, 47 Tâches |
| Sam 26 déc (réserve phase 4) | 48 Observabilité, 49 Données personnelles, 50 Utilisateurs |
| 4.3 Qualité (24-28 déc) | Tablette, mobile et thème sombre de ces écrans, comparaison finale |

Si une réserve est consommée par un retard, l'écran passe au créneau suivant. Il passe en v2.1 seulement si l'ordre de coupe est atteint.
