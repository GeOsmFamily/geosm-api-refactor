import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeolocateIpUseCase } from '../../../../../src/application/use-cases/geoportail/geolocate-ip.use-case.js';

describe('GeolocateIpUseCase', () => {
  let useCase: GeolocateIpUseCase;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useCase = new GeolocateIpUseCase();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return default location for private IP 127.0.0.1', async () => {
    const result = await useCase.execute('127.0.0.1');
    expect(result.city).toBe('Yaounde');
    expect(result.country).toBe('Cameroon');
  });

  it('should return default location for private IP 192.168.x.x', async () => {
    const result = await useCase.execute('192.168.1.1');
    expect(result.city).toBe('Yaounde');
  });

  it('should return default location for ::1', async () => {
    const result = await useCase.execute('::1');
    expect(result.city).toBe('Yaounde');
  });

  it('should return location from successful API call', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'success',
        lat: 48.8566,
        lon: 2.3522,
        city: 'Paris',
        country: 'France',
      }),
    } as any);

    const result = await useCase.execute('8.8.8.8');
    expect(result.lat).toBe(48.8566);
    expect(result.lon).toBe(2.3522);
    expect(result.city).toBe('Paris');
  });

  it('should return default on API failure', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
    } as any);

    const result = await useCase.execute('8.8.8.8');
    expect(result.city).toBe('Yaounde');
  });

  it('should return default on fetch error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network error'));

    const result = await useCase.execute('8.8.8.8');
    expect(result.city).toBe('Yaounde');
  });
});
