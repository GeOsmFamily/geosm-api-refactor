import { createHmac, timingSafeEqual } from 'crypto';
import { jwtConfig } from '../../config/jwt.config.js';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface PersonalWmsTokenPayload {
  userId: string;
  personalLayerId: string;
  qgisProjectPath: string;
}

/**
 * Jeton signé (HMAC, même idiome que oauth-state.util.ts, réutilise JWT_ACCESS_SECRET plutôt
 * qu'un nouveau secret dédié) protégeant l'URL WMS d'une donnée personnelle QGIS_PROJECT (voir
 * plan "Interopérabilité & sécurité des données" du 2026-08-06).
 *
 * AVANT ce correctif, `sourceUrl` pointait directement sur QGIS_PUBLIC_URL avec `qgisProjectPath`
 * en clair - protégé uniquement par le fait que ce chemin est difficile à deviner, aucune
 * vérification réelle d'authentification/propriété. N'importe qui en possession de l'URL (fuite
 * navigateur, lien partagé, capture d'écran d'un devtools...) pouvait y accéder indéfiniment.
 *
 * Le chemin du projet QGIS (`qgisProjectPath`) est embarqué DANS le jeton signé plutôt que
 * repris depuis un paramètre `map=` fourni par le client à la vérification - un jeton valide
 * pour la couche A ne peut donc pas être trivialement réutilisé pour accéder à la couche B en
 * changeant juste ce paramètre.
 */
export function signPersonalWmsToken(payload: PersonalWmsTokenPayload): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = createHmac('sha256', jwtConfig.accessSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyPersonalWmsToken(token: string): PersonalWmsTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expectedSignature = createHmac('sha256', jwtConfig.accessSecret)
    .update(body)
    .digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now() ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.personalLayerId !== 'string' ||
      typeof parsed.qgisProjectPath !== 'string'
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      personalLayerId: parsed.personalLayerId,
      qgisProjectPath: parsed.qgisProjectPath,
    };
  } catch {
    return null;
  }
}
