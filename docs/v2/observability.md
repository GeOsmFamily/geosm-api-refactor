# Conventions d'observabilite des domaines sociaux

Applicables a tous les nouveaux domaines de GeOsm Family (territoire, posts, groupes,
evenements, messagerie, connexions, gamification). Implementation :
`src/infrastructure/observability/social-telemetry.ts`.

## 1. Logs structures

Tout evenement metier est journalise avec `logSocialEvent(logger, niveau, event, ctx, extra)`.
Les quatre champs sont **toujours** presents, `null` si inconnus :

| Champ | Valeur |
|---|---|
| `event` | `<domaine>.<action>` en minuscules : `post.created`, `group.member_joined`, `event.registration_waitlisted` |
| `requestId` | identifiant de requete (correlation) |
| `userId` | utilisateur courant, `null` pour un visiteur |
| `instanceId` | pays concerne |

```ts
logSocialEvent(this.log, 'info', 'post.created', { requestId, userId, instanceId }, { postId });
```

Les champs de `extra` ne peuvent pas ecraser les quatre champs obligatoires. **Ne jamais mettre
le contenu d'un message prive dans `extra`.**

## 2. Metriques Prometheus

- Prefixe `geosm_social_`, enregistrees dans `metricsRegister` (endpoint `/metrics` existant).
- Premier label **toujours** `instance_id`.
- Compteurs : suffixe `_total`. Durees : suffixe `_seconds` (histogramme).
- Creer via `createSocialCounter` / `createSocialHistogram` (idempotent, valide le nommage).
- Chaque domaine expose au minimum : un compteur de creations, un histogramme de latence de sa
  lecture principale, un compteur d'erreurs.

| Metrique | Type | Labels (apres `instance_id`) | Etape |
|---|---|---|---|
| `geosm_social_instance_selections_total` | counter | | 1.4 |
| `geosm_social_ws_connections_active` | gauge | `channel` | 1.6 |
| `geosm_social_posts_created_total` | counter | `visibility` | 2.3 |
| `geosm_social_feed_query_duration_seconds` | histogram | `has_geo_filter` | 2.3 |
| `geosm_social_moderation_actions_total` | counter | `content_type`, `decision` | 2.3 |
| `geosm_social_event_registrations_total` | counter | `status` | 3.2 |
| `geosm_social_messages_sent_total` | counter | `conversation_type` | 3.3 |
| `geosm_social_badge_unlocks_total` | counter | `badge_code` | 3.5 |

La metrique existante `active_websocket_connections` (sans label) est conservee.

## 3. Traces

Un span par use case via `withUseCaseSpan('CreatePostUseCase', { userId, instanceId }, fn)` :
nom `usecase.CreatePostUseCase`, attributs `instance.id` et `user.id`.

## 4. Alertes

Definies dans `monitoring/prometheus/rules/social.rules.yml`, **non chargees** par defaut :
ajouter le fichier a `rule_files` de `prometheus.yml` quand la metrique correspondante existe
(latence du fil des l'etape 2.3, file des badges des l'etape 3.5).

## 5. Tableau de bord

`monitoring/grafana/dashboards/geosm-social.json` (uid `geosm-social`), panneaux reserves pour
les huit metriques ci-dessus ; ils restent vides jusqu'a l'etape correspondante.
