import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../src/config/env.config.js', () => ({
  config: { DATABASE_URL: 'postgresql://geosm:secret@localhost:5432/geosm' },
}));

import { buildQgisPgUri } from '../../../../src/infrastructure/qgis/pg-uri.util.js';

describe('buildQgisPgUri', () => {
  it('should build a PostgreSQL provider URI from the configured DATABASE_URL', () => {
    const uri = buildQgisPgUri('public', 'my_table', { keyColumn: 'id', geometryType: 'Point' });

    expect(uri).toContain("dbname='geosm'");
    expect(uri).toContain("host='localhost'");
    expect(uri).toContain("port='5432'");
    expect(uri).toContain("user='geosm'");
    expect(uri).toContain("password='secret'");
    expect(uri).toContain("key='id'");
    expect(uri).toContain('srid=4326');
    expect(uri).toContain('type=Point');
    expect(uri).toContain('table="public"."my_table"');
  });

  it('should use the provided srid instead of the default', () => {
    const uri = buildQgisPgUri('public', 'my_table', {
      keyColumn: 'id',
      geometryType: 'Polygon',
      srid: 2154,
    });

    expect(uri).toContain('srid=2154');
  });
});

describe('buildQgisPgUri without an explicit port', () => {
  it('should default the port to 5432 when the DATABASE_URL omits it', async () => {
    vi.resetModules();
    vi.doMock('../../../../src/config/env.config.js', () => ({
      config: { DATABASE_URL: 'postgresql://geosm:secret@localhost/geosm' },
    }));
    const { buildQgisPgUri: buildWithoutPort } = await import(
      '../../../../src/infrastructure/qgis/pg-uri.util.js'
    );

    const uri = buildWithoutPort('public', 'my_table', { keyColumn: 'id', geometryType: 'Point' });

    expect(uri).toContain("port='5432'");
  });
});
