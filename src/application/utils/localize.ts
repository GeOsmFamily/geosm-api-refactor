export function localize(value: string | null | undefined, lang: string = 'fr'): string {
  if (!value) return '';
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      return parsed[lang] || parsed['fr'] || parsed['en'] || value;
    } catch {
      return value;
    }
  }
  return value;
}
