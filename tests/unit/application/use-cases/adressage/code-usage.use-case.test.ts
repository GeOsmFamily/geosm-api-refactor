import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeUsageUseCase } from '../../../../../src/application/use-cases/adressage/code-usage.use-case.js';

describe('CodeUsageUseCase', () => {
  let useCase: CodeUsageUseCase;
  let adressageService: { getCodeUsage: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    adressageService = { getCodeUsage: vi.fn() };
    useCase = new CodeUsageUseCase(adressageService as any);
  });

  it('should return code usage data', async () => {
    const data = [{ code: 'R', count: 10 }];
    adressageService.getCodeUsage.mockResolvedValue(data);

    const result = await useCase.execute();
    expect(result).toEqual(data);
  });

  it('should propagate service errors', async () => {
    adressageService.getCodeUsage.mockRejectedValue(new Error('DB error'));
    await expect(useCase.execute()).rejects.toThrow('DB error');
  });
});
