import { describe, it, expect } from 'vitest';
import { Coordinates } from '../../../../src/domain/value-objects/coordinates.vo.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';

describe('Coordinates Value Object', () => {
  it('should create valid coordinates', () => {
    const coords = Coordinates.create(10.5, 45.3);
    expect(coords.longitude).toBe(10.5);
    expect(coords.latitude).toBe(45.3);
  });

  it('should accept boundary values', () => {
    const coords = Coordinates.create(-180, -90);
    expect(coords.longitude).toBe(-180);
    expect(coords.latitude).toBe(-90);
    const coords2 = Coordinates.create(180, 90);
    expect(coords2.longitude).toBe(180);
    expect(coords2.latitude).toBe(90);
  });

  it('should throw on invalid longitude', () => {
    expect(() => Coordinates.create(-181, 0)).toThrow(ValidationError);
    expect(() => Coordinates.create(181, 0)).toThrow(ValidationError);
  });

  it('should throw on invalid latitude', () => {
    expect(() => Coordinates.create(0, -91)).toThrow(ValidationError);
    expect(() => Coordinates.create(0, 91)).toThrow(ValidationError);
  });

  it('should convert to array', () => {
    const coords = Coordinates.create(1, 2);
    expect(coords.toArray()).toEqual([1, 2]);
  });

  it('should compare equality', () => {
    const a = Coordinates.create(10, 20);
    const b = Coordinates.create(10, 20);
    const c = Coordinates.create(10, 21);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });
});
