import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Redirections 308 des anciennes routes du catalogue cartographique vers leur nouveau nom.
 *
 * Le modele `Group` (catalogue de couches) est devenu `LayerGroup` pour liberer le nom `Group`
 * au concept social (voir docs/adr/0007). Les routes passent de :
 *   /instances/:instanceId/groups[/...]      -> /instances/:instanceId/layer-groups[/...]
 *   /groups/:groupId/sub-groups[/...]        -> /layer-groups/:groupId/layer-sub-groups[/...]
 *
 * 308 (et non 301) : la methode et le corps de la requete sont conserves, indispensable pour
 * les POST/PATCH/DELETE. Ces redirections sont TEMPORAIRES : elles doivent etre retirees avant
 * la creation des routes sociales `/instances/:instanceId/groups` et `/groups/:id` (etape 3.1),
 * sans quoi elles les masqueraient.
 */
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const;

const LEGACY_RULES: Array<{ pattern: RegExp; replacement: string }> = [
  // /instances/:instanceId/groups -> /instances/:instanceId/layer-groups
  { pattern: /^(\/instances\/[^/]+)\/groups(?=\/|\?|$)/, replacement: '$1/layer-groups' },
  // /groups/:groupId/sub-groups -> /layer-groups/:groupId/layer-sub-groups
  { pattern: /^\/groups\/([^/]+)\/sub-groups(?=\/|\?|$)/, replacement: '/layer-groups/$1/layer-sub-groups' },
];

export function rewriteLegacyLayerGroupPath(pathWithQuery: string, apiPrefix: string): string | null {
  if (!pathWithQuery.startsWith(apiPrefix)) return null;
  const rest = pathWithQuery.slice(apiPrefix.length);
  for (const rule of LEGACY_RULES) {
    if (rule.pattern.test(rest)) {
      return apiPrefix + rest.replace(rule.pattern, rule.replacement);
    }
  }
  return null;
}

export async function legacyLayerGroupRedirects(
  app: FastifyInstance,
  opts: { apiPrefix: string },
): Promise<void> {
  const { apiPrefix } = opts;

  const handler = async (request: FastifyRequest, reply: FastifyReply) => {
    const target = rewriteLegacyLayerGroupPath(request.url, apiPrefix);
    if (!target) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Route not found' },
      });
    }
    return reply
      .header('Deprecation', 'true')
      .header('Link', `<${target}>; rel="successor-version"`)
      .redirect(target, 308);
  };

  for (const url of [
    `${apiPrefix}/instances/:instanceId/groups`,
    `${apiPrefix}/instances/:instanceId/groups/*`,
    `${apiPrefix}/groups/:groupId/sub-groups`,
    `${apiPrefix}/groups/:groupId/sub-groups/*`,
  ]) {
    app.route({ method: [...METHODS], url, schema: { hide: true } as never, handler });
  }
}
