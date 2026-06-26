import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

function fixExclusiveMinMax(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(fixExclusiveMinMax);
  const rec = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = fixExclusiveMinMax(v);
  }
  if (out['exclusiveMinimum'] === true && typeof out['minimum'] === 'number') {
    out['exclusiveMinimum'] = out['minimum'];
    delete out['minimum'];
  }
  if (out['exclusiveMaximum'] === true && typeof out['maximum'] === 'number') {
    out['exclusiveMaximum'] = out['maximum'];
    delete out['maximum'];
  }
  return out;
}

export function zodToSwagger(schema: ZodTypeAny): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' }) as Record<string, unknown>;
  const rest = { ...jsonSchema };
  delete rest.$schema;
  return fixExclusiveMinMax(rest) as Record<string, unknown>;
}
