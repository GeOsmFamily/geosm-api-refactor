import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { successResponse } from '../schemas/common.schema.js';
import { ValidationError } from '../../domain/errors/validation.error.js';
import { searchGeocodingQuerySchema, reverseGeocodingQuerySchema, lookupGeocodingQuerySchema } from '../schemas/geocoding.schema.js';
import { zodToSwagger } from '../schemas/swagger.helper.js';
import type { SearchGeocodingUseCase } from '../../application/use-cases/geocoding/search-geocoding.use-case.js';
import type { ReverseGeocodingUseCase } from '../../application/use-cases/geocoding/reverse-geocoding.use-case.js';
import type { LookupGeocodingUseCase } from '../../application/use-cases/geocoding/lookup-geocoding.use-case.js';
import { z } from 'zod';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { format: () => unknown } } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError('Validation failed', result.error?.format() as Record<string, unknown>);
  return result.data as T;
}

export async function geocodingRoutes(app: FastifyInstance): Promise<void> {
  const searchGeocodingUseCase = app.diContainer.resolve<SearchGeocodingUseCase>('searchGeocodingUseCase');
  const reverseGeocodingUseCase = app.diContainer.resolve<ReverseGeocodingUseCase>('reverseGeocodingUseCase');
  const lookupGeocodingUseCase = app.diContainer.resolve<LookupGeocodingUseCase>('lookupGeocodingUseCase');

  app.get('/search', {
    schema: { description: 'Rechercher une adresse par texte', tags: ['Geocodage'], querystring: zodToSwagger(searchGeocodingQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(searchGeocodingQuerySchema, request.query);
    const result = await searchGeocodingUseCase.execute(query.q, {
      viewbox: query.viewbox,
      bounded: query.bounded,
      limit: query.limit,
      countrycodes: query.countrycodes,
    });
    return reply.send(successResponse(result));
  });

  app.get('/reverse', {
    schema: { description: 'Geocodage inverse (coordonnees vers adresse)', tags: ['Geocodage'], querystring: zodToSwagger(reverseGeocodingQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(reverseGeocodingQuerySchema, request.query);
    const result = await reverseGeocodingUseCase.execute(query.lat, query.lon);
    return reply.send(successResponse(result));
  });

  app.get('/lookup', {
    schema: { description: 'Rechercher par identifiants OSM', tags: ['Geocodage'], querystring: zodToSwagger(lookupGeocodingQuerySchema) },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = parseBody(lookupGeocodingQuerySchema, request.query);
    const osmIds = query.osm_ids.split(',');
    const result = await lookupGeocodingUseCase.execute(osmIds);
    return reply.send(successResponse(result));
  });

  app.post('/export', {
    schema: {
      description: 'Exporter un GeoJSON en GeoJSON ou Shapefile (Zip)',
      tags: ['Geocodage'],
      body: zodToSwagger(z.object({
        geojson: z.record(z.unknown()),
        fileName: z.string(),
        format: z.enum(['geojson', 'shapefile'])
      }))
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = parseBody(z.object({
      geojson: z.record(z.unknown()),
      fileName: z.string(),
      format: z.enum(['geojson', 'shapefile'])
    }), request.body);

    const safeFileName = body.fileName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'export';
    const timestamp = Date.now();
    const tempDir = '/tmp';

    if (body.format === 'geojson') {
      const exportFileName = `${safeFileName}.geojson`;
      reply.header('Content-Disposition', `attachment; filename="${exportFileName}"`);
      reply.header('Content-Type', 'application/json');
      return reply.send(JSON.stringify(body.geojson));
    } else {
      // Shapefile
      const geojsonPath = path.join(tempDir, `boundary_${timestamp}.geojson`);
      const zipPath = path.join(tempDir, `boundary_${timestamp}.zip`);

      try {
        // Write the GeoJSON to a temp file
        await writeFile(geojsonPath, JSON.stringify(body.geojson), 'utf-8');

        // Run ogr2ogr to convert the GeoJSON to a zipped shapefile
        const cmd = `ogr2ogr -f "ESRI Shapefile" "${zipPath}" "${geojsonPath}" -lco ENCODING=UTF-8`;
        await execAsync(cmd, { timeout: 30000 });

        if (!existsSync(zipPath)) {
          throw new Error('Failed to generate shapefile archive');
        }

        const exportFileName = `${safeFileName}.zip`;
        reply.header('Content-Disposition', `attachment; filename="${exportFileName}"`);
        reply.header('Content-Type', 'application/zip');
        
        const stream = createReadStream(zipPath);
        
        reply.raw.on('finish', async () => {
          try {
            if (existsSync(geojsonPath)) await unlink(geojsonPath);
            if (existsSync(zipPath)) await unlink(zipPath);
          } catch { /* ignore */ }
        });

        return reply.send(stream);
      } catch (err) {
        try {
          if (existsSync(geojsonPath)) await unlink(geojsonPath);
          if (existsSync(zipPath)) await unlink(zipPath);
        } catch { /* ignore */ }
        throw err;
      }
    }
  });
}
