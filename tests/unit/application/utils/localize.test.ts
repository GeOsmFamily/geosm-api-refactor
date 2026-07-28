import { describe, it, expect } from 'vitest';
import { localize, localizeEntity, localizeEntities } from '../../../../src/application/utils/localize.js';

describe('localize', () => {
  it('should return an empty string for null or undefined input', () => {
    expect(localize(null)).toBe('');
    expect(localize(undefined)).toBe('');
  });

  it('should return a plain string as-is', () => {
    expect(localize('Hello')).toBe('Hello');
  });

  it('should return the value for the requested language from a JSON object', () => {
    expect(localize('{"fr":"Bonjour","en":"Hello"}', 'en')).toBe('Hello');
  });

  it('should fall back to fr then en when the requested language is missing', () => {
    expect(localize('{"fr":"Bonjour","en":"Hello"}', 'de')).toBe('Bonjour');
    expect(localize('{"en":"Hello"}', 'de')).toBe('Hello');
  });

  it('should fall back to the raw value when no language key matches', () => {
    expect(localize('{"es":"Hola"}', 'de')).toBe('{"es":"Hola"}');
  });

  it('should return the raw value when JSON parsing fails', () => {
    expect(localize('{not valid json')).toBe('{not valid json');
  });

  it('should default the language to fr when not provided', () => {
    expect(localize('{"fr":"Bonjour","en":"Hello"}')).toBe('Bonjour');
  });
});

describe('localizeEntity', () => {
  it('should localize the default name/description fields', () => {
    const entity = { name: '{"fr":"Nom","en":"Name"}', description: '{"fr":"Desc"}', id: '1' };

    const result = localizeEntity(entity, 'en');

    expect(result.name).toBe('Name');
    expect(result.description).toBe('Desc');
    expect(result.id).toBe('1');
  });

  it('should preserve null/undefined fields instead of coercing them to an empty string', () => {
    const entity = { name: '{"fr":"Nom"}', description: null as string | null };

    const result = localizeEntity(entity, 'fr');

    expect(result.description).toBeNull();
  });

  it('should leave non-string fields untouched', () => {
    const entity = { name: '{"fr":"Nom"}', count: 42 };

    const result = localizeEntity(entity, 'fr');

    expect(result.count).toBe(42);
  });

  it('should support a custom list of fields', () => {
    const entity = { title: '{"fr":"Titre","en":"Title"}', name: '{"fr":"Nom"}' };

    const result = localizeEntity(entity, 'en', ['title']);

    expect(result.title).toBe('Title');
    expect(result.name).toBe('{"fr":"Nom"}');
  });
});

describe('localizeEntities', () => {
  it('should localize every entity in the list', () => {
    const entities = [
      { name: '{"fr":"Un","en":"One"}' },
      { name: '{"fr":"Deux","en":"Two"}' },
    ];

    const result = localizeEntities(entities, 'en');

    expect(result.map((e) => e.name)).toEqual(['One', 'Two']);
  });

  it('should return an empty array for an empty input', () => {
    expect(localizeEntities([], 'fr')).toEqual([]);
  });
});
