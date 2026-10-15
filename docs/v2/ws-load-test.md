# Test de charge du canal `/ws/notifications` (etape 1.6)

Script : [`scripts/ws-load-test.mjs`](../../scripts/ws-load-test.mjs) (`node scripts/ws-load-test.mjs <api> <connexions> <utilisateurs>`).
Il cree des comptes jetables : a lancer sur une base de test uniquement.

## Conditions

- Poste de developpement Windows 11, API en `tsx` (un seul processus Node 24), PostGIS 16 et MinIO en conteneurs.
- Client et serveur sur la meme machine : la latence reseau est quasi nulle, les chiffres mesurent surtout le traitement du serveur.
- Chaque connexion envoie 5 pings applicatifs, **toutes en parallele** : c'est une rafale, plus severe qu'un usage reel.

## Resultats

| Connexions | Ouvertes | Etablissement p95 | Ping/pong p50 | Ping/pong p95 | Jauge `geosm_ws_connections_active` |
|---|---|---|---|---|---|
| 100 (20 comptes) | 100 | 206 ms | 18.8 ms | 27.3 ms | 100, puis 0 apres fermeture |
| 500 (100 comptes) | 500 | 1 070 ms | 70.9 ms | 97.4 ms | 500, puis 0 |
| 2 000 (200 comptes) | 2 000 | 4 783 ms | 284 ms | 411 ms | 2 000, puis 0 |

La jauge est exacte a l'ouverture comme a la fermeture. L'etablissement croit lineairement avec le nombre de connexions simultanees (ouverture en rafale, un seul processus).

## Constat important : la limitation de debit s'applique aux poignees de main WebSocket

Avec la limite par defaut (`RATE_LIMIT_PUBLIC`), la rafale de 2 000 connexions s'est arretee a **848** : chaque poignee de main `GET /ws/notifications` compte comme une requete HTTP pour l'IP, puis les requetes suivantes (y compris `/metrics`) recoivent `429`. Les 2 000 ont abouti une fois la limite relevee.

Consequences :
- derriere une meme IP (bureau, ecole, operateur mobile avec NAT), plusieurs utilisateurs qui se reconnectent en meme temps peuvent s'empecher mutuellement de se connecter ;
- **avant la phase 3 (messagerie)** : exempter `/ws/*` de la limitation, ou la plafonner par utilisateur et non par IP. Non traite ici (hors perimetre de l'etape 1.6).

## Ce qui n'a PAS ete mesure

- **La diffusion** (un evenement serveur vers N clients) : aucun declencheur HTTP n'existe aujourd'hui (les evenements sont emis par des use cases internes). A mesurer en phase 2, quand `POST_LIKED` / `POST_COMMENTED` existeront.
- Plusieurs instances d'API : le registre des clients est en memoire (une seule instance) ; le multi-instance est reporte en v2.1.

## Recommandation

Un processus tient 2 000 connexions simultanees sans erreur, avec une latence de l'ordre de 0,4 s en rafale. C'est largement suffisant pour l'ouverture du Lot 2 ; aucun redimensionnement n'est necessaire avant la phase 3. Pour la messagerie, traiter l'exemption de la limitation de debit et mesurer la diffusion reelle.
