import { describe, it, expect } from 'vitest';
import { BoundingBox } from '../../../../src/domain/value-objects/bbox.vo.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';

describe('BoundingBox Value Object', () => {
  it('should create a valid bounding box', () => {
    const bbox = BoundingBox.create(-10, -20, 10, 20);
    expect(bbox.minLon).toBe(-10);
    expect(bbox.minLat).toBe(-20);
    expect(bbox.maxLon).toBe(10);
    expect(bbox.maxLat).toBe(20);
  });

  it('should throw when minLon > maxLon', () => {
    expect(() => BoundingBox.create(10, -20, -10, 20)).toThrow(ValidationError);
  });

  it('should throw when minLat > maxLat', () => {
    expect(() => BoundingBox.create(-10, 20, 10, -20)).toThrow(ValidationError);
  });

  it('should convert to array', () => {
    const bbox = BoundingBox.create(1, 2, 3, 4);
    expect(bbox.toArray()).toEqual([1, 2, 3, 4]);
  });

  it('should compare equality', () => {
    const a = BoundingBox.create(1, 2, 3, 4);
    const b = BoundingBox.create(1, 2, 3, 4);
    const c = BoundingBox.create(1, 2, 3, 5);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
