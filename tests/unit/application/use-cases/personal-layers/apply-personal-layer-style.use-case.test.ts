import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApplyPersonalLayerStyleUseCase } from '../../../../../src/application/use-cases/personal-layers/apply-personal-layer-style.use-case.js';
import { NotFoundError } from '../../../../../src/domain/errors/not-found.error.js';
import { ForbiddenError } from '../../../../../src/domain/errors/forbidden.error.js';
import { ValidationError } from '../../../../../src/domain/errors/validation.error.js';

describe('ApplyPersonalLayerStyleUseCase', () => {
  let useCase: ApplyPersonalLayerStyleUseCase;
  let repository: { findById: ReturnType<typeof vi.fn>; updateStyle: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    repository = { findById: vi.fn(), updateStyle: vi.fn() };
    useCase = new ApplyPersonalLayerStyleUseCase(repository as any);
  });

  it('should throw NotFoundError when the personal layer does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ userId: 'user-1', personalLayerId: 'missing', color: '#fff' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('should throw ForbiddenError when the layer belongs to another user', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'someone-else', sourceType: 'FILE' });

    await expect(
      useCase.execute({ userId: 'user-1', personalLayerId: 'pl-1', color: '#fff' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ValidationError for a QGIS_PROJECT-sourced layer', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-1', userId: 'user-1', sourceType: 'QGIS_PROJECT' });

    await expect(
      useCase.execute({ userId: 'user-1', personalLayerId: 'pl-1', color: '#fff' }),
    ).rejects.toThrow(ValidationError);
  });

  it('should merge new style fields with the existing style', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-1',
      userId: 'user-1',
      sourceType: 'FILE',
      style: { color: '#000', iconKey: 'marker' },
    });
    const updated = { id: 'pl-1', style: { color: '#f00', iconKey: 'marker', shape: 'circle' } };
    repository.updateStyle.mockResolvedValue(updated);

    const result = await useCase.execute({
      userId: 'user-1',
      personalLayerId: 'pl-1',
      color: '#f00',
      shape: 'circle',
    });

    expect(repository.updateStyle).toHaveBeenCalledWith('pl-1', {
      color: '#f00',
      iconKey: 'marker',
      shape: 'circle',
    });
    expect(result).toBe(updated);
  });

  it('should default to an empty style object when the layer has no prior style', async () => {
    repository.findById.mockResolvedValue({ id: 'pl-2', userId: 'user-1', sourceType: 'FILE', style: null });
    repository.updateStyle.mockResolvedValue({ id: 'pl-2', style: { color: '#111' } });

    await useCase.execute({ userId: 'user-1', personalLayerId: 'pl-2', color: '#111' });

    expect(repository.updateStyle).toHaveBeenCalledWith('pl-2', {
      color: '#111',
      iconKey: undefined,
      shape: undefined,
    });
  });

  it('should fall back to the existing style values when no input override is given', async () => {
    repository.findById.mockResolvedValue({
      id: 'pl-3',
      userId: 'user-1',
      sourceType: 'FILE',
      style: { color: '#abc', iconKey: 'marker', shape: 'square' },
    });
    repository.updateStyle.mockResolvedValue({ id: 'pl-3' });

    await useCase.execute({ userId: 'user-1', personalLayerId: 'pl-3' });

    expect(repository.updateStyle).toHaveBeenCalledWith('pl-3', {
      color: '#abc',
      iconKey: 'marker',
      shape: 'square',
    });
  });
});
