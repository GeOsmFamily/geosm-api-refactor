import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportOsmDataUseCase } from '../../../../../src/application/use-cases/admin/import-osm-data.use-case.js';

describe('ImportOsmDataUseCase', () => {
  let useCase: ImportOsmDataUseCase;
  let osm2pgsqlService: { importFile: ReturnType<typeof vi.fn>; updateData: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    osm2pgsqlService = {
      importFile: vi.fn().mockResolvedValue({ success: true, message: 'Import complete' }),
      updateData: vi.fn().mockResolvedValue({ success: true, message: 'Update complete' }),
    };
    useCase = new ImportOsmDataUseCase(osm2pgsqlService as any);
  });

  it('should import a PBF file', async () => {
    const result = await useCase.execute({ pbfPath: '/data/file.pbf' });
    expect(result.success).toBe(true);
    expect(osm2pgsqlService.importFile).toHaveBeenCalledWith('/data/file.pbf', {
      slim: true, append: false, styleFile: undefined, cache: 800,
    });
  });

  it('should update data when append is true', async () => {
    const result = await useCase.execute({ pbfPath: '/data/file.pbf', append: true });
    expect(result.success).toBe(true);
    expect(osm2pgsqlService.updateData).toHaveBeenCalled();
  });

  it('should throw if pbfPath is empty', async () => {
    await expect(useCase.execute({ pbfPath: '' })).rejects.toThrow('PBF file path is required');
  });
});
