import { describe, it, expect } from 'vitest';
import { resolveLang } from '../../../../src/presentation/utils/lang.util.js';

function makeRequest(acceptLanguage?: string) {
  return { headers: { 'accept-language': acceptLanguage } } as any;
}

describe('resolveLang', () => {
  it('should return the default language when no Accept-Language header is present', () => {
    expect(resolveLang(makeRequest(undefined))).toBe('fr');
  });

  it('should support a custom default language', () => {
    expect(resolveLang(makeRequest(undefined), 'en')).toBe('en');
  });

  it('should extract the primary language from a multi-value header', () => {
    expect(resolveLang(makeRequest('fr-FR,fr;q=0.9,en;q=0.8'))).toBe('fr');
  });

  it('should strip the region subtag and lowercase the result', () => {
    expect(resolveLang(makeRequest('EN-US'))).toBe('en');
  });

  it('should trim surrounding whitespace', () => {
    expect(resolveLang(makeRequest(' de-DE '))).toBe('de');
  });
});
