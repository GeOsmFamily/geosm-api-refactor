import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ZoneBasemapService,
  lonLatToPixel,
  fitBoxDimensions,
} from '../../../../src/infrastructure/pdf/zone-basemap.service.js';

vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function fakeImageResponse(ok = true, contentType = 'image/png'): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    headers: { get: () => contentType },
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3, 4]).buffer),
  } as unknown as Response;
}

describe('lonLatToPixel', () => {
  it('should place (0,0) at the center of the world at zoom 0', () => {
    const p = lonLatToPixel(0, 0, 0);
    expect(p.x).toBeCloseTo(128, 5);
    expect(p.y).toBeCloseTo(128, 5);
  });

  it('should place the west/east edges of the world at x=0/x=tileSize*2^zoom', () => {
    const west = lonLatToPixel(-180, 0, 0);
    const east = lonLatToPixel(180, 0, 0);
    expect(west.x).toBeCloseTo(0, 5);
    expect(east.x).toBeCloseTo(256, 5);
  });

  it('should scale by 2^zoom between zoom levels for the same coordinate', () => {
    const z0 = lonLatToPixel(10, 5, 0);
    const z3 = lonLatToPixel(10, 5, 3);
    expect(z3.x).toBeCloseTo(z0.x * 8, 3);
    expect(z3.y).toBeCloseTo(z0.y * 8, 3);
  });

  it('should decrease y as latitude increases (north is up)', () => {
    const north = lonLatToPixel(0, 40, 5);
    const south = lonLatToPixel(0, -40, 5);
    expect(north.y).toBeLessThan(south.y);
  });
});

describe('fitBoxDimensions', () => {
  it('should fit within the target box without exceeding it', () => {
    const { width, height } = fitBoxDimensions(9.6, 4.0, 9.8, 4.1, 480, 300);
    expect(width).toBeLessThanOrEqual(480 + 1e-6);
    expect(height).toBeLessThanOrEqual(300 + 1e-6);
  });

  it('should shrink the effective longitude span by cos(latitude) so east-west distance is not exaggerated', () => {
    const equator = fitBoxDimensions(0, 0, 1, 1, 480, 300);
    const highLat = fitBoxDimensions(0, 60, 1, 61, 480, 300);
    // Même étendue en degrés (1°x1°) mais à une latitude où 1° de longitude vaut moins au sol :
    // le rectangle ajusté doit donc être relativement plus "carré" (largeur/hauteur plus faible).
    expect(highLat.width / highLat.height).toBeLessThan(equator.width / equator.height);
  });

  it('should never let the longitude scale collapse to zero near the poles', () => {
    const { lonScale } = fitBoxDimensions(0, 89, 1, 89.5, 480, 300);
    expect(lonScale).toBeGreaterThan(0);
  });
});

describe('ZoneBasemapService.fetchForZone', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(fakeImageResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should fetch an XYZ tile mosaic and return a base64-encoded tile grid', async () => {
    const service = new ZoneBasemapService();
    const result = await service.fetchForZone(
      [9.6, 4.0, 9.8, 4.1],
      { type: 'XYZ', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
      480,
      300,
    );

    expect(result).not.toBeNull();
    expect(result!.kind).toBe('xyz');
    if (result!.kind === 'xyz') {
      expect(result!.tiles.length).toBeGreaterThan(0);
      expect(result!.tiles[0].dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result!.originOffsetX).toBeGreaterThanOrEqual(0);
      expect(result!.originOffsetX).toBeLessThan(256);
      expect(result!.originOffsetY).toBeGreaterThanOrEqual(0);
      expect(result!.originOffsetY).toBeLessThan(256);
    }
    expect(fetchMock).toHaveBeenCalled();
    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toMatch(/^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it('should replace the {s} subdomain placeholder with "a"', async () => {
    const service = new ZoneBasemapService();
    await service.fetchForZone(
      [9.6, 4.0, 9.8, 4.1],
      { type: 'XYZ', url: 'https://{s}.tile.example.com/{z}/{x}/{y}.png' },
      256,
      256,
    );

    const requestedUrl = fetchMock.mock.calls[0][0] as string;
    expect(requestedUrl).toMatch(/^https:\/\/a\.tile\.example\.com\//);
  });

  it('should fetch a single WMS GetMap image sized to preserve the bbox aspect ratio', async () => {
    const service = new ZoneBasemapService();
    const result = await service.fetchForZone(
      [9.6, 4.0, 9.8, 4.1],
      { type: 'WMS', url: 'https://wms.example.com/geoserver/wms', config: { layers: 'cameroon:roads' } },
      480,
      300,
    );

    expect(result).not.toBeNull();
    expect(result!.kind).toBe('wms');
    if (result!.kind === 'wms') {
      expect(result!.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result!.widthPx).toBeLessThanOrEqual(480);
      expect(result!.heightPx).toBeLessThanOrEqual(300);
    }
    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe('https://wms.example.com/geoserver/wms');
    expect(requestedUrl.searchParams.get('REQUEST')).toBe('GetMap');
    expect(requestedUrl.searchParams.get('LAYERS')).toBe('cameroon:roads');
    expect(requestedUrl.searchParams.get('BBOX')).toBe('9.6,4,9.8,4.1');
  });

  it('should return null for an unsupported basemap type without making any request', async () => {
    const service = new ZoneBasemapService();
    const result = await service.fetchForZone([9.6, 4.0, 9.8, 4.1], {
      type: 'MAPBOX',
      url: 'https://api.mapbox.com/whatever',
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should return null (not throw) when a tile request fails', async () => {
    fetchMock.mockResolvedValue(fakeImageResponse(false));
    const service = new ZoneBasemapService();

    const result = await service.fetchForZone(
      [9.6, 4.0, 9.8, 4.1],
      { type: 'XYZ', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' },
      480,
      300,
    );

    expect(result).toBeNull();
  });

  it('should return null (not throw) when the WMS GetMap request fails', async () => {
    fetchMock.mockResolvedValue(fakeImageResponse(false));
    const service = new ZoneBasemapService();

    const result = await service.fetchForZone([9.6, 4.0, 9.8, 4.1], {
      type: 'WMS',
      url: 'https://wms.example.com/geoserver/wms',
      config: { layers: 'x' },
    });

    expect(result).toBeNull();
  });

  it('should return null (not throw) when fetch itself rejects (network error)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const service = new ZoneBasemapService();

    const result = await service.fetchForZone([9.6, 4.0, 9.8, 4.1], {
      type: 'XYZ',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    });

    expect(result).toBeNull();
  });
});
