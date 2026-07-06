import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { jwtConfig } from '../../config/jwt.config.js';

const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Protection CSRF du flux OAuth OSM (voir osm.routes.ts) sans session serveur ni cookie :
 * le "state" est un jeton auto-vérifiable (nonce + expiration + signature HMAC), réutilise
 * JWT_ACCESS_SECRET plutôt que d'introduire un nouveau secret dédié.
 */
export function signOAuthState(payload: Record<string, string> = {}): string {
  const nonce = randomBytes(16).toString('hex');
  const exp = Date.now() + STATE_TTL_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, nonce, exp })).toString('base64url');
  const signature = createHmac('sha256', jwtConfig.accessSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyOAuthState(state: string): Record<string, string> | null {
  const [body, signature] = state.split('.');
  if (!body || !signature) return null;
  const expectedSignature = createHmac('sha256', jwtConfig.accessSecret).update(body).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
