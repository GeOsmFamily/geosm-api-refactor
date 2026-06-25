import { z } from 'zod';

export const layerIdParamSchema = z.object({
  layerId: z.string().uuid(),
});

export const styleIdParamSchema = z.object({
  layerId: z.string().uuid(),
  id: z.string().uuid(),
});

export const updateSldSchema = z.object({
  sldBody: z.string().min(1),
});

export const updateMapboxSchema = z.object({
  mapboxStyle: z.record(z.unknown()),
});
