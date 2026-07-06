import { config } from '../../config/env.config.js';

export interface OsmUserDetails {
  osmUserId: number;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  accountCreatedAt: Date | null;
  changesetCount: number;
  homeLat: number | null;
  homeLon: number | null;
}

interface OsmUserDetailsResponse {
  user: {
    id: number;
    display_name: string;
    account_created: string;
    // Présent seulement si le token appartient à l'utilisateur lui-même (toujours notre cas ici)
    // - non garanti selon la config de confidentialité du compte OSM, donc traité comme optionnel.
    email?: string;
    img?: { href: string };
    changesets?: { count: number };
    home?: { lat: number; lon: number };
  };
}

/**
 * Client OAuth 2.0 + API OpenStreetMap (pas de SDK - même pattern que GeminiService/OsrmService :
 * fetch direct). OSM_OAUTH_CLIENT_ID/SECRET sont optionnels (voir env.config.ts) : le bouton
 * "Se connecter avec OpenStreetMap" est masqué côté frontend si absent, ensureConfigured()
 * échoue proprement à l'appel plutôt que de faire planter le démarrage du serveur.
 *
 * Scope demandé : uniquement `read_prefs` (lecture du profil) - les contributions OSM
 * (write_api) sont hors scope pour l'instant, même si l'app OAuth enregistrée sur osm.org
 * dispose d'autorisations plus larges.
 */
export class OsmOAuthService {
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;
  private readonly redirectUri: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.clientId = config.OSM_OAUTH_CLIENT_ID;
    this.clientSecret = config.OSM_OAUTH_CLIENT_SECRET;
    this.redirectUri = config.OSM_OAUTH_REDIRECT_URI;
    this.baseUrl = config.OSM_OAUTH_BASE_URL;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('OSM_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI non configurés : connexion OpenStreetMap indisponible.');
    }
  }

  getAuthorizationUrl(state: string): string {
    this.ensureConfigured();
    const params = new URLSearchParams({
      client_id: this.clientId as string,
      redirect_uri: this.redirectUri as string,
      response_type: 'code',
      scope: 'read_prefs',
      state,
    });
    return `${this.baseUrl}/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<string> {
    this.ensureConfigured();
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri as string,
      client_id: this.clientId as string,
      client_secret: this.clientSecret as string,
    });
    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new Error(`Échange du code OAuth OSM échoué (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  async getUserDetails(accessToken: string): Promise<OsmUserDetails> {
    const response = await fetch(`${this.baseUrl}/api/0.6/user/details.json`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(`Récupération du profil OSM échouée (${response.status}): ${await response.text()}`);
    }
    const { user } = (await response.json()) as OsmUserDetailsResponse;
    return {
      osmUserId: user.id,
      displayName: user.display_name,
      email: user.email ?? null,
      avatarUrl: user.img?.href ?? null,
      accountCreatedAt: user.account_created ? new Date(user.account_created) : null,
      changesetCount: user.changesets?.count ?? 0,
      homeLat: user.home?.lat ?? null,
      homeLon: user.home?.lon ?? null,
    };
  }
}
