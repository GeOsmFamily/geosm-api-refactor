import { describe, it, expect } from 'vitest';
import { Export } from '../../../../src/domain/entities/export.entity.js';
import { ExportFormat, JobStatus } from '../../../../src/domain/enums.js';

describe('Export Entity', () => {
  const now = new Date();
  const props = {
    id: 'e1', format: ExportFormat.GEOJSON, status: JobStatus.PENDING,
    layerId: 'l1', userId: 'u1', filePath: null, fileSize: null,
    bbox: null, errorMessage: null, startedAt: null, completedAt: null,
    createdAt: now, updatedAt: now,
  };

  it('should construct with all properties', () => {
    const exp = new Export(props);
    expect(exp.id).toBe('e1');
    expect(exp.format).toBe(ExportFormat.GEOJSON);
    expect(exp.status).toBe(JobStatus.PENDING);
  });

  it('should handle completed export', () => {
    const exp = new Export({ ...props, status: JobStatus.COMPLETED, filePath: '/tmp/f.geojson', fileSize: 1024, completedAt: now });
    expect(exp.filePath).toBe('/tmp/f.geojson');
    expect(exp.fileSize).toBe(1024);
    expect(exp.completedAt).toBe(now);
  });
});
