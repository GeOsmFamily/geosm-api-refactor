import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecAsync } = vi.hoisted(() => ({ mockExecAsync: vi.fn() }));
vi.mock('child_process', () => ({ exec: vi.fn() }));
vi.mock('util', () => ({ promisify: vi.fn(() => mockExecAsync) }));
vi.mock('fs', () => ({ existsSync: vi.fn(() => true) }));
vi.mock('fs/promises', () => ({ mkdir: vi.fn() }));
vi.mock('../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../../src/config/env.config.js', () => ({
  config: {
    QGIS_PROJECTS_DIR: '/projects',
    QGIS_STYLES_DIR: '/styles',
    QGIS_SERVER_URL: 'http://qgis:8080/ows',
  },
}));

import { QGISProjectService } from '../../../../src/infrastructure/qgis/qgis-project.service.js';

describe('QGISProjectService', () => {
  let service: QGISProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new QGISProjectService();
  });

  describe('getProjectPath', () => {
    it('should return project path without thematicId', () => {
      const result = service.getProjectPath('my-instance');
      expect(result).toContain('/projects/my-instance/my-instance.qgs');
    });

    it('should return project path with thematicId', () => {
      const result = service.getProjectPath('my-instance', 'theme-1');
      expect(result).toContain('/projects/my-instance/my-instance_theme-1.qgs');
    });
  });

  describe('getWMSUrl', () => {
    it('should return WMS URL without thematicId', () => {
      const result = service.getWMSUrl('my-instance');
      expect(result).toContain('http://qgis:8080/ows?map=');
      expect(result).toContain('my-instance.qgs');
    });

    it('should return WMS URL with thematicId', () => {
      const result = service.getWMSUrl('my-instance', 'theme-1');
      expect(result).toContain('my-instance_theme-1.qgs');
    });
  });

  describe('addVectorLayer', () => {
    it('should return parsed JSON result on success', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"success":true,"layerName":"test"}',
        stderr: '',
      });

      const result = await service.addVectorLayer('/project.qgs', '/data/layer.gpkg', 'test');
      expect(result).toEqual({ success: true, layerName: 'test' });
    });

    it('should return error result on exec failure', async () => {
      mockExecAsync.mockRejectedValue(new Error('python not found'));

      const result = await service.addVectorLayer('/project.qgs', '/data/layer.gpkg', 'test');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('removeLayer', () => {
    it('should return parsed JSON result', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: '{"success":true}',
        stderr: '',
      });

      const result = await service.removeLayer('/project.qgs', 'test-layer');
      expect(result).toEqual({ success: true });
    });
  });

  describe('reloadProject', () => {
    it('should return parsed JSON result', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: 'some debug output\n{"success":true,"layers":3}',
        stderr: '',
      });

      const result = await service.reloadProject('/project.qgs');
      expect(result).toEqual({ success: true, layers: 3 });
    });
  });
});
