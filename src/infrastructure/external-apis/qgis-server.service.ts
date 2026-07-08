import { config } from '../../config/env.config.js';

export class QgisServerService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.QGIS_SERVER_URL;
  }

  async proxyWmsRequest(
    params: Record<string, string>,
    mapPath?: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const searchParams = new URLSearchParams(params);
    searchParams.set('SERVICE', 'WMS');

    let url = this.baseUrl;
    if (mapPath) {
      url += (url.includes('?') ? '&' : '?') + `map=${encodeURIComponent(mapPath)}`;
      url += '&' + searchParams.toString();
    } else {
      url += '?' + searchParams.toString();
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`QGIS WMS request failed: ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer());
    return { data, contentType };
  }

  async proxyWfsRequest(
    params: Record<string, string>,
    mapPath?: string,
  ): Promise<{ data: Buffer; contentType: string }> {
    const searchParams = new URLSearchParams(params);
    searchParams.set('SERVICE', 'WFS');

    let url = this.baseUrl;
    if (mapPath) {
      url += (url.includes('?') ? '&' : '?') + `map=${encodeURIComponent(mapPath)}`;
      url += '&' + searchParams.toString();
    } else {
      url += '?' + searchParams.toString();
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`QGIS WFS request failed: ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer());
    return { data, contentType };
  }

  async getCapabilities(mapPath: string, service: 'WMS' | 'WFS' = 'WMS'): Promise<string> {
    const url = `${this.baseUrl}?map=${encodeURIComponent(mapPath)}&SERVICE=${service}&REQUEST=GetCapabilities`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`GetCapabilities failed: ${response.statusText}`);
    return response.text();
  }
}
