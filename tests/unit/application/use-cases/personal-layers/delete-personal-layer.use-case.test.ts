import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecAsync } = vi.hoisted(() => ({ mockExecAsync: vi.fn() }));
vi.mock('child_process', () => ({ exec: vi.fn() }));
vi.mock('util', () => ({ promisify: vi.fn(() => mockExecAsync) }));
vi.mock('../../../../../src/config/env.config.js', () => ({
  config: { DATA_DIR: '/tmp/geosm-data' },
}));

import { DeletePersonalLayerUseCase } from '../../../../../src/application/use-cases/personal-layers/delete-personal-layer.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';

describe('DeletePersonalLayerUseCase', () => {
  let useCase: DeletePersonalLayerUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let prisma: { $executeRawUnsafe: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
    repository = { findById: vi.fn(), delete: vi.fn().mockResolvedValue(undefined) };
    prisma = { $executeRawUnsafe: vi.fn().mockResolvedValue(undefined) };
    useCase = new DeletePersonalLayerUseCase(repository as any, prisma as any);
  });

  it('should throw NotFoundError when the personal layer does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'missing')).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when the layer belongs to another user', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'someone-else', sourceType: 'FILE' });

    await expect(useCase.execute('user-1', 'pl-1')).rejects.toThrow(ForbiddenError);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('should drop the backing table and delete the record for a FILE-sourced layer', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'FILE',
      schemaName: 'personal_data',
      tableName: 'pl_1',
      qgisProjectPath: null,
    });

    await useCase.execute('user-1', 'pl-1');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'DROP TABLE IF EXISTS "personal_data"."pl_1"',
    );
    expect(repository.delete).toHaveBeenCalledWith('pl-1');
  });

  it('should remove the project directory and delete the record for a QGIS_PROJECT-sourced layer', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-2',
      userId: 'user-1',
      sourceType: 'QGIS_PROJECT',
      schemaName: null,
      tableName: null,
      qgisProjectPath: '/var/www/qgis/projects/pl-2/project.qgs',
    });

    await useCase.execute('user-1', 'pl-2');

    expect(mockExecAsync).toHaveBeenCalledWith(
      expect.stringContaining('rm -rf "/var/www/qgis/projects/pl-2"'),
    );
    expect(repository.delete).toHaveBeenCalledWith('pl-2');
  });

  it('should skip the table drop for a FILE layer without schema/table metadata', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-4',
      userId: 'user-1',
      sourceType: 'FILE',
      schemaName: null,
      tableName: null,
      qgisProjectPath: null,
    });

    await useCase.execute('user-1', 'pl-4');

    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(repository.delete).toHaveBeenCalledWith('pl-4');
  });

  it('should skip the project directory cleanup for a QGIS_PROJECT layer without a path', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-5',
      userId: 'user-1',
      sourceType: 'QGIS_PROJECT',
      schemaName: null,
      tableName: null,
      qgisProjectPath: null,
    });

    await useCase.execute('user-1', 'pl-5');

    expect(mockExecAsync).not.toHaveBeenCalledWith(expect.stringContaining('/var/www'));
    expect(repository.delete).toHaveBeenCalledWith('pl-5');
  });

  it('should not fail the deletion when cleanup commands reject', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-3',
      userId: 'user-1',
      sourceType: 'FILE',
      schemaName: 'personal_data',
      tableName: 'pl_3',
      qgisProjectPath: null,
    });
    prisma.$executeRawUnsafe.mockRejectedValue(new Error('db unavailable'));
    mockExecAsync.mockRejectedValue(new Error('command failed'));

    await useCase.execute('user-1', 'pl-3');

    expect(repository.delete).toHaveBeenCalledWith('pl-3');
  });
});
