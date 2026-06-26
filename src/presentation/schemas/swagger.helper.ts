import type { ZodTypeAny } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToSwagger(schema: ZodTypeAny): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' });
  // Remove $schema property that openapi doesn't need
  const { $schema, ...rest } = jsonSchema as Record<string, unknown>;
  return rest;
}
