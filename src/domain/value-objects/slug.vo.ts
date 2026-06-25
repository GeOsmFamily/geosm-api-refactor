import { ValidationError } from '../errors/validation.error.js';

export class Slug {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Slug {
    if (!value || value.trim().length === 0) {
      throw new ValidationError('Slug cannot be empty');
    }
    return new Slug(Slug.slugify(value));
  }

  static fromExisting(value: string): Slug {
    if (!value || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      throw new ValidationError(`Invalid slug format: ${value}`);
    }
    return new Slug(value);
  }

  private static slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  get value(): string {
    return this._value;
  }

  equals(other: Slug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
