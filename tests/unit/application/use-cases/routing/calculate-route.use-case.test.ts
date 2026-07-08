import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CalculateRouteUseCase } from '../../../../../src/application/use-cases/routing/calculate-route.use-case.js';

describe('CalculateRouteUseCase', () => {
  let useCase: CalculateRouteUseCase;
  let osrmService: { route: ReturnType<typeof vi.fn>; nearest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    osrmService = { route: vi.fn(), nearest: vi.fn() };
    useCase = new CalculateRouteUseCase(osrmService as any);
  });

  it('should calculate route successfully, flattening the first OSRM route', async () => {
    const mockResult = {
      routes: [{ distance: 1000, duration: 60, geometry: 'encoded-geometry', legs: [{ steps: [] }] }],
      waypoints: [{ location: [0, 0] }, { location: [1, 1] }],
    };
    osrmService.route.mockResolvedValue(mockResult);
    const result = await useCase.execute([[0, 0], [1, 1]]);
    expect(result).toEqual({
      distance: 1000,
      duration: 60,
      geometry: 'encoded-geometry',
      legs: [{ steps: [] }],
      waypoints: mockResult.waypoints,
    });
    expect(osrmService.route).toHaveBeenCalledWith([[0, 0], [1, 1]], undefined, undefined);
  });

  it('should pass profile and options through to OSRMService', async () => {
    osrmService.route.mockResolvedValue({ routes: [{ distance: 500, duration: 30 }], waypoints: [] });
    await useCase.execute([[0, 0], [1, 1]], 'car', { steps: true });
    expect(osrmService.route).toHaveBeenCalledWith([[0, 0], [1, 1]], 'car', { steps: true });
  });

  it('should throw if OSRM returns no routes', async () => {
    osrmService.route.mockResolvedValue({ routes: [] });

    await expect(useCase.execute([[0, 0], [1, 1]])).rejects.toThrow('No route found');
  });
});
