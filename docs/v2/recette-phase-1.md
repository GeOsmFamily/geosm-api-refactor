# Recette de la phase 1 (Lot 1 : pays, coque, auth, notifications, parametres)

Date : 15 octobre 2026. Environnement : API reelle (`tsx`), PostGIS 16 jetable, MinIO jetable, Redis partage (DB 9), front `ng serve`, Chromium pilote par Playwright. Aucune donnee de production.

## Resultats

| Verification | Resultat |
|---|---|
| Tests unitaires API (`tests/unit`, env valide) | 605 passes, 80 ignores |
| Tests unitaires front (Karma) | 169 passes |
| `tsc`, `eslint`, `nx build` | 0 erreur (avertissements deja presents) |
| Verification API de bout en bout (`scripts/smoke-v2.mjs`) | 21/21 |
| Parcours navigateur reel (`geosm-frontend` : `scripts/e2e-live/journey.mjs`) | 29/29 |
| Ouverture des 16 entrees du menu outils (`scripts/e2e-live/tools.mjs`) | 16/16, 0 erreur JavaScript |
| E2E existant (`e2e/auth.spec.ts`, API simulee) | 5/5 |
| Charge `/ws/notifications` | 2 000 connexions simultanees, voir [ws-load-test.md](ws-load-test.md) |

## Defauts trouves PAR le test reel (et corriges)

1. `PUT /notifications/preferences` renvoyait 400 pour tout corps partiel : le schema JSON genere depuis un `z.record(z.enum(...))` exigeait les six categories. Invisible aux tests unitaires.
2. La langue choisie n'etait pas memorisee (jamais le cas dans la v1) : elle revenait au francais a chaque rechargement. Ajout de `LanguageService`.
3. Le tiroir de taches affichait une cloche, identique a l'onglet Notification : remplacee par `task_alt`.
4. Les dates de notification s'affichaient au format americain : formatees dans la langue de l'interface.
5. La limitation de debit par IP compte les poignees de main WebSocket (848 connexions sur 2 000 acceptees avec la limite par defaut) : documente, a traiter avant la phase 3.

## Ce qui n'est PAS verifie

- **Fonctionnement des 14 outils** : seule l'ouverture de chaque panneau est controlee (rendu + absence d'erreur JS). Dessin, mesure, itineraire, export, impression, analyses, etc. restent a essayer a la main, avec de vraies couches (la base de test n'a aucune couche ni service QGIS).
- Envoi reel des emails (SMTP absent : jetons lus en base).
- Connexion OpenStreetMap et ecran de complement du profil (necessitent le service OSM) ; la logique est couverte par tests unitaires seulement.
- Rendu pixel-parfait face aux maquettes (ecran 02 selecteur, ecrans 03 auth, 69/70 notifications, 31 parametres) : j'ai controle le rendu des captures, pas ecart par ecart.
- Navigateurs autres que Chromium, tablettes (seul un viewport mobile de 390 px a ete essaye).
- Les deux nouvelles notifications du catalogue ne sont emises par aucun code (prevu : phases 2 et 3) ; l'affichage a ete verifie avec des lignes inserees en base.

## Reste a faire avant la mise en production

- Executer le SQL de verification des `parent_instance_id` orphelins (voir ADR 0007).
- Retirer les redirections 308 `/groups` avant l'etape 3.1.
- Exempter `/ws/*` de la limitation de debit par IP avant la messagerie.
- Les champs `failed_login_attempts`, `locked_until`, `profile_completion_pending` et la table `notification_preferences` sont ajoutes par `prisma db push` (additif, sans perte).
