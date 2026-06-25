import { config } from '../../config/env.config.js';

export class QgisServerService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = config.QGIS_SERVER_URL;
  }

  async proxyWmsRequest(params: Record<string, string>): Promise<{ data: Buffer; contentType: string }> {
    const searchParams = new URLSearchParams(params);
    searchParams.set('SERVICE', 'WMS');
    const response = await fetch(`${this.baseUrl}?${searchParams}`);
    if (!response.ok) throw new Error(`QGIS WMS request failed: ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer());
    return { data, contentType };
  }

  async proxyWfsRequest(params: Record<string, string>): Promise<{ data: Buffer; contentType: string }> {
    const searchParams = new URLSearchParams(params);
    searchParams.set('SERVICE', 'WFS');
    const response = await fetch(`${this.baseUrl}?${searchParams}`);
    if (!response.ok) throw new Error(`QGIS WFS request failed: ${response.statusText}`);
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = Buffer.from(await response.arrayBuffer());
    return { data, contentType };
  }
}
