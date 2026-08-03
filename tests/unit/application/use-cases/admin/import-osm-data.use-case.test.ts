import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportOsmDataUseCase } from '../../../../../src/application/use-cases/admin/import-osm-data.use-case.js';

describe('ImportOsmDataUseCase', () => {
  let useCase: ImportOsmDataUseCase;
  let osm2pgsqlService: { importFile: ReturnType<typeof vi.fn>; updateData: ReturnType<typeof vi.fn> };
  let prisma: { $executeRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    osm2pgsqlService = {
      importFile: vi.fn().mockResolvedValue({ success: true, message: 'Import complete' }),
      updateData: vi.fn().mockResolvedValue({ success: true, message: 'Update complete' }),
    };
    prisma = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    };
    useCase = new ImportOsmDataUseCase(osm2pgsqlService as any, prisma as any);
  });

  it('should import a local PBF file and move tables to osm schema and extract boundaries', async () => {
    const result = await useCase.execute({ pbfPath: '/data/file.pbf' });
    expect(result.success).toBe(true);
    expect(osm2pgsqlService.importFile).toHaveBeenCalledWith('/data/file.pbf', {
      slim: true,
      append: false,
      styleFile: undefined,
      cache: 800,
    });
    // Verifies schema migration and boundary extraction calls to Prisma
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS osm');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.admin_boundaries'),
    );
  });

  it('should update data when append is true', async () => {
    const result = await useCase.execute({ pbfPath: '/data/file.pbf', append: true });
    expect(result.success).toBe(true);
    expect(osm2pgsqlService.updateData).toHaveBeenCalled();
  });

  it('should throw if pbfPath is empty', async () => {
    await expect(useCase.execute({ pbfPath: '' })).rejects.toThrow('PBF file path or URL is required');
  });

  it('should download PBF when pbfPath is a URL', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    vi.stubGlobal('fetch', fakeFetch);

    const result = await useCase.execute({
      pbfPath: 'https://download.geofabrik.de/africa/mali-latest.osm.pbf',
    });

    expect(result.success).toBe(true);
    expect(fakeFetch).toHaveBeenCalledWith(
      'https://download.geofabrik.de/africa/mali-latest.osm.pbf',
    );
    expect(osm2pgsqlService.importFile).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
