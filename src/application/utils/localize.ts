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

/**
 * Localise les champs `name`/`description` (convention {fr,en} JSON, voir CreateInstanceUseCase)
 * d'une entité (ou liste d'entités) avant de la renvoyer au client. Centralise ce qui était
 * jusqu'ici répété (et oublié) route par route - voir l'audit qui a trouvé ~10 endpoints
 * renvoyant encore du JSON brut faute d'appeler localize() manuellement à chaque fois.
 */
export function localizeEntity<T extends object>(entity: T, lang: string, fields: (keyof T)[] = ['name', 'description'] as (keyof T)[]): T {
  const result: Record<string, unknown> = { ...(entity as unknown as Record<string, unknown>) };
  for (const field of fields) {
    const value = (entity as Record<string, unknown>)[field as string];
    if (value === null || value === undefined) continue; // préserve null (ex: description absente) plutôt que de le transformer en ''
    if (typeof value === 'string') {
      result[field as string] = localize(value, lang);
    }
  }
  return result as T;
}

export function localizeEntities<T extends object>(entities: T[], lang: string, fields: (keyof T)[] = ['name', 'description'] as (keyof T)[]): T[] {
  return entities.map((entity) => localizeEntity(entity, lang, fields));
}
