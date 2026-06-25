import { describe, it, expect } from 'vitest';
import { Slug } from '../../../../src/domain/value-objects/slug.vo.js';
import { ValidationError } from '../../../../src/domain/errors/validation.error.js';

describe('Slug Value Object', () => {
  it('should create a slug from text', () => {
    const slug = Slug.create('Hello World');
    expect(slug.value).toBe('hello-world');
  });

  it('should handle special characters', () => {
    const slug = Slug.create('Eau & Assainissement!');
    expect(slug.value).toBe('eau-assainissement');
  });

  it('should handle accented characters', () => {
    const slug = Slug.create('Resume des activites');
    expect(slug.value).toBe('resume-des-activites');
  });

  it('should throw on empty string', () => {
    expect(() => Slug.create('')).toThrow(ValidationError);
  });

  it('should create from existing valid slug', () => {
    const slug = Slug.fromExisting('my-slug');
    expect(slug.value).toBe('my-slug');
  });

  it('should throw on invalid existing slug', () => {
    expect(() => Slug.fromExisting('INVALID SLUG')).toThrow(ValidationError);
  });

  it('should compare slugs', () => {
    const a = Slug.create('hello world');
    const b = Slug.create('Hello World');
    expect(a.equals(b)).toBe(true);
  });
});
