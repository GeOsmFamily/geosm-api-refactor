export interface GeolocateResult {
  lat: number;
  lon: number;
  city?: string;
  country?: string;
}

export class GeolocateIpUseCase {
  private readonly defaultCenter: GeolocateResult = { lat: 3.848, lon: 11.502, city: 'Yaounde', country: 'Cameroon' };

  async execute(ip: string): Promise<GeolocateResult> {
    try {
      // Skip private/local IPs
      if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
        return this.defaultCenter;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,lat,lon,city,country`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return this.defaultCenter;

      const data = await response.json() as { status: string; lat?: number; lon?: number; city?: string; country?: string };
      if (data.status !== 'success' || data.lat === undefined || data.lon === undefined) {
        return this.defaultCenter;
      }

      return {
        lat: data.lat,
        lon: data.lon,
        city: data.city,
        country: data.country,
      };
    } catch {
      return this.defaultCenter;
    }
  }
}
