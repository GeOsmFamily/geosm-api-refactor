import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FindNearestUseCase } from '../../../../../src/application/use-cases/routing/find-nearest.use-case.js';

describe('FindNearestUseCase', () => {
  let useCase: FindNearestUseCase;
  let osrmService: { route: ReturnType<typeof vi.fn>; nearest: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    osrmService = { route: vi.fn(), nearest: vi.fn() };
    useCase = new FindNearestUseCase(osrmService as any);
  });

  it('should find nearest point', async () => {
    const mockResult = { waypoints: [{ location: [10, 20] }] };
    osrmService.nearest.mockResolvedValue(mockResult);
    const result = await useCase.execute(10, 20);
    expect(result).toEqual(mockResult);
    expect(osrmService.nearest).toHaveBeenCalledWith(10, 20, undefined);
  });

  it('should pass number parameter', async () => {
    osrmService.nearest.mockResolvedValue({ waypoints: [] });
    await useCase.execute(10, 20, 5);
    expect(osrmService.nearest).toHaveBeenCalledWith(10, 20, 5);
  });
});
