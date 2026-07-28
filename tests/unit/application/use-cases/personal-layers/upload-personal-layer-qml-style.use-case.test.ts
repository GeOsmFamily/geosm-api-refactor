import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', () => ({ mkdir: vi.fn().mockResolvedValue(undefined), copyFile: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../../../src/config/env.config.js', () => ({
  config: { DATA_DIR: '/tmp/geosm-data' },
}));

import { mkdir, copyFile } from 'fs/promises';
import { UploadPersonalLayerQmlStyleUseCase } from '../../../../../src/application/use-cases/personal-layers/upload-personal-layer-qml-style.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('UploadPersonalLayerQmlStyleUseCase', () => {
  let useCase: UploadPersonalLayerQmlStyleUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; updateStyle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = { findById: vi.fn(), updateStyle: vi.fn() };
    useCase = new UploadPersonalLayerQmlStyleUseCase(repository as any);
  });

  it('should throw NotFoundError when the personal layer does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('user-1', 'missing', '/tmp/upload.qml')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('should throw ForbiddenError when the layer belongs to another user', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'someone-else', sourceType: 'FILE' });

    await expect(useCase.execute('user-1', 'pl-1', '/tmp/upload.qml')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('should throw ValidationError for a QGIS_PROJECT-sourced layer', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'user-1', sourceType: 'QGIS_PROJECT' });

    await expect(useCase.execute('user-1', 'pl-1', '/tmp/upload.qml')).rejects.toThrow(
      ValidationError,
    );
  });

  it('should store the QML file and persist its path in the style', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'FILE',
      style: { color: '#000' },
    });
    const destDir = path.join('/tmp/geosm-data', 'personal-styles', 'pl-1');
    const destPath = path.join(destDir, 'style.qml');
    const updated = { id: 'pl-1', style: { color: '#000', qmlPath: destPath } };
    repository.updateStyle.mockResolvedValue(updated);

    const result = await useCase.execute('user-1', 'pl-1', '/tmp/upload.qml');

    expect(mkdir).toHaveBeenCalledWith(destDir, { recursive: true });
    expect(copyFile).toHaveBeenCalledWith('/tmp/upload.qml', destPath);
    expect(repository.updateStyle).toHaveBeenCalledWith('pl-1', {
      color: '#000',
      qmlPath: destPath,
    });
    expect(result).toBe(updated);
  });

  it('should default to an empty style object when the layer has no prior style', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-2', userId: 'user-1', sourceType: 'FILE', style: null });
    repository.updateStyle.mockResolvedValue({ id: 'pl-2' });

    await useCase.execute('user-1', 'pl-2', '/tmp/upload.qml');

    const destPath = path.join('/tmp/geosm-data', 'personal-styles', 'pl-2', 'style.qml');
    expect(repository.updateStyle).toHaveBeenCalledWith('pl-2', {
      qmlPath: destPath,
    });
  });
});
