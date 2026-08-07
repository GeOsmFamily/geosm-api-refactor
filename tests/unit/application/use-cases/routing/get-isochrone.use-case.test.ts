import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetIsochroneUseCase } from '../../../../../src/application/use-cases/routing/get-isochrone.use-case.js';

describe('GetIsochroneUseCase', () => {
  let osrmService: { table: ReturnType<typeof vi.fn> };
  let useCase: GetIsochroneUseCase;

  beforeEach(() => {
    osrmService = { table: vi.fn() };
    useCase = new GetIsochroneUseCase(osrmService as any);
  });

  it('returns only the origin point when OSRM table fails', async () => {
    osrmService.table.mockRejectedValueOnce(new Error('OSRM down'));
    const points = await useCase.execute(9.7, 4.05, 'driving', 15);
    expect(points).toEqual([]);
  });

  it('filters candidates within the time budget and always includes the origin', async () => {
    osrmService.table.mockImplementationOnce(async (candidates: [number, number][]) => {
      const n = candidates.length - 1;
      // Alternate reachable (100s) / unreachable (null) durations for the candidates.
      const durations = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? 100 : null));
      return { durations: [durations] };
    });
    const points = await useCase.execute(9.7, 4.05, 'walking', 15);
    expect(points.length).toBeGreaterThan(1);
    expect(points.at(-1)).toEqual({ lon: 9.7, lat: 4.05, durationSeconds: 0 });
    expect(points.every((p) => p.durationSeconds <= 15 * 60)).toBe(true);
  });

  it('falls back to the driving speed budget for an unknown profile', async () => {
    osrmService.table.mockResolvedValueOnce({ durations: [Array(120).fill(null)] });
    const points = await useCase.execute(9.7, 4.05, 'unknown-profile', 10);
    expect(points).toEqual([{ lon: 9.7, lat: 4.05, durationSeconds: 0 }]);
  });
});
