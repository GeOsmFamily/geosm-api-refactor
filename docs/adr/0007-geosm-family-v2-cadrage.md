# 0007. GeOsm Family v2 : decisions de cadrage (reseau social geolocalise)

Statut : Accepte
Date : 2026-10-15

## Contexte

GeOsm Family ajoute a l'outil SIG existant un reseau social geolocalise (fil, groupes, evenements,
messagerie, connexions, gamification) precede d'un selecteur Monde > Continent > Pays. Trois
documents de reference (cahier fonctionnel, cahier technique, plan de developpement) et 93
ecrans de maquettes ont ete produits. Ils se contredisent sur quelques points et la maquette
montre des elements qu'aucun cahier ne decrit. Le projet est realise par une seule personne avec
assistance IA, avec une date de livraison au 31 decembre 2026 : tout arbitrage non ecrit coute
cher plus tard.

## Decision

Les arbitrages suivants s'appliquent a tout le projet v2 :

1. **Navigation.** Onglet Accueil = la carte ; onglet Reseaux = le fil social (comme les maquettes).
   Le cahier technique placait le fil sur `/accueil` : c'est corrige.
2. **Renommage `Group` -> `LayerGroup`.** On renomme les modeles Prisma, le code et les routes,
   mais on conserve les tables `groups` / `sub_groups` et leurs colonnes via `@map` : aucun
   `ALTER TABLE`, donc aucun risque avec `prisma db push` (execute au demarrage du conteneur).
   Les routes catalogue passent de `/groups` a `/layer-groups`, avec redirection 308 pendant
   un mois, car `/instances/:id/groups` est reserve aux groupes sociaux.
3. **Groupes sociaux.** Plusieurs categories par groupe (table de jointure). Adhesion immediate,
   roles Proprietaire / Moderateur / Membre. Adhesion controlee et abonnes : v2.1.
4. **Evenements.** Plusieurs organisateurs (`EventOrganizer`). Verrou `FOR UPDATE` sur
   l'inscription, liste d'attente FIFO, rappels a 24 h et 1 h.
5. **Posts.** Rayon de 100 m a 25 km (cahier fonctionnel). Masquage automatique au 3e
   signalement de 3 utilisateurs distincts (table generique `ContentReport`). GIF = envoi d'un
   fichier, pas de service tiers. Likes sur commentaires inclus.
6. **Messagerie.** 1-a-1 uniquement, canal dedie `/ws/messages`, epinglage inclus,
   blocage et signalement inclus, pieces jointes : v2.1.
7. **Zone d'interet.** Le pays actif. `NEW_PROJECT_IN_ZONE` est emis a la creation d'un
   evenement dans le pays de l'utilisateur.
8. **Branche.** Le travail se fait sur `geosm-v2`, avec un tag `v1-stable` pose sur `dev` dans
   les deux depots pour pouvoir revenir en arriere.

## Consequences

- Le renommage est reversible par simple retour du code : les tables n'ont pas bouge.
- L'URL `/api/v1/groups` change de sens (catalogue -> social) : les clients externes eventuels
  doivent suivre la redirection 308 pendant la periode de transition.
- Le fil social et les groupes sociaux ne peuvent pas partager de route avec le catalogue.
- Le perimetre fonctionnel est plus petit que le cahier fonctionnel sur 5 points (adhesion
  controlee, abonnes, pieces jointes, notification de pays, canal e-mail), listes ici pour
  qu'ils ne soient pas redecouverts comme des oublis.
- Le planning n'a pas de marge hors samedis de reserve : toute dette decouverte en cours de
  route doit etre arbitree (coupe) plutot qu'ajoutee.

## Alternatives envisagees

- **Renommer les tables en SQL** (`ALTER TABLE ... RENAME`) comme le propose le cahier
  technique : ecarte, car `prisma db push` est execute au demarrage et un diff mal interprete
  peut emettre un `DROP`/`CREATE`. Le gain (noms SQL plus propres) ne justifie pas le risque.
- **Garder `/groups` pour le catalogue et prefixer le social (`/social/groups`)** : ecarte,
  car le cahier technique et la maquette convergent sur `/instances/:id/groups` pour le social
  et le terme `LayerGroup` est de toute facon necessaire pour lever l'ambiguite dans le code.
- **Un seul niveau de categorie par groupe** (enum `GroupCategory`) : ecarte, la maquette montre
  explicitement « Infrastructure · Energie ».
