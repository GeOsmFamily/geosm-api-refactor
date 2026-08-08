import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnalysisReportProcessor } from '../../../../../src/infrastructure/queue/workers/analysis-report.worker.js';

vi.mock('../../../../../src/infrastructure/observability/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

describe('createAnalysisReportProcessor', () => {
  let deps: {
    prisma: {
      analysisReport: { update: ReturnType<typeof vi.fn> };
    };
    instanceRepository: { findById: ReturnType<typeof vi.fn> };
    baseMapRepository: {
      findByInstance: ReturnType<typeof vi.fn>;
      findDefaults: ReturnType<typeof vi.fn>;
    };
    summarizeViewportUseCase: { execute: ReturnType<typeof vi.fn> };
    reverseGeocodingUseCase: { execute: ReturnType<typeof vi.fn> };
    zoneBasemapService: { fetchForZone: ReturnType<typeof vi.fn> };
    geminiService: { generateText: ReturnType<typeof vi.fn> };
    reportRendererService: { renderHtmlToPdf: ReturnType<typeof vi.fn> };
    storageService: { uploadFile: ReturnType<typeof vi.fn> };
    notificationService: { notifyUser: ReturnType<typeof vi.fn> };
  };

  const baseJobData = {
    reportId: 'report-1',
    userId: 'user-1',
    instanceId: 'inst-1',
    topic: 'Écoles et hôpitaux',
    layerIds: ['layer-1'],
  };

  const summary = {
    layerCount: 1,
    totalFeatureCount: 5,
    perLayer: [
      { layerId: 'layer-1', name: 'Écoles', kind: 'vector' as const, featureCount: 5, totalAreaKm2: null, totalLengthKm: null },
    ],
    narrative: 'Synthèse courte.',
  };

  beforeEach(() => {
    deps = {
      prisma: { analysisReport: { update: vi.fn().mockResolvedValue(undefined) } },
      instanceRepository: {
        findById: vi.fn().mockResolvedValue({ id: 'inst-1', name: JSON.stringify({ fr: 'Cameroun' }) }),
      },
      baseMapRepository: {
        findByInstance: vi.fn().mockResolvedValue([
          { type: 'XYZ', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
        ]),
        findDefaults: vi.fn().mockResolvedValue([]),
      },
      summarizeViewportUseCase: { execute: vi.fn().mockResolvedValue(summary) },
      reverseGeocodingUseCase: {
        execute: vi.fn().mockResolvedValue({ display_name: 'Douala 3, Littoral, Cameroun' }),
      },
      zoneBasemapService: {
        fetchForZone: vi.fn().mockResolvedValue({
          kind: 'xyz',
          widthPx: 480,
          heightPx: 300,
          zoom: 12,
          topLeftPx: { x: 100, y: 100 },
          originOffsetX: 10,
          originOffsetY: 10,
          tiles: [],
        }),
      },
      geminiService: { generateText: vi.fn().mockResolvedValue('Texte rédigé par Gemini.') },
      reportRendererService: { renderHtmlToPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4')) },
      storageService: { uploadFile: vi.fn().mockResolvedValue('analysis-reports/report-1/report.pdf') },
      notificationService: { notifyUser: vi.fn() },
    };
  });

  it('should generate a report and resolve place name + basemap when a zone (extent) is given', async () => {
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    expect(deps.reverseGeocodingUseCase.execute).toHaveBeenCalledWith(4.05, 9.7);
    expect(deps.baseMapRepository.findByInstance).toHaveBeenCalledWith('inst-1');
    expect(deps.zoneBasemapService.fetchForZone).toHaveBeenCalledWith(
      [9.6, 4.0, 9.8, 4.1],
      expect.objectContaining({ type: 'XYZ' }),
    );
    expect(deps.reportRendererService.renderHtmlToPdf).toHaveBeenCalled();
    const html = deps.reportRendererService.renderHtmlToPdf.mock.calls[0][0] as string;
    expect(html).toContain('Douala 3, Littoral, Cameroun');
    expect(deps.storageService.uploadFile).toHaveBeenCalledWith(
      'analysis-reports/report-1/report.pdf',
      expect.any(Buffer),
      'application/pdf',
    );
    expect(deps.prisma.analysisReport.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'report-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
    expect(deps.notificationService.notifyUser).toHaveBeenCalledWith(
      'user-1',
      'analysis-report:completed',
      expect.objectContaining({ reportId: 'report-1' }),
    );
  });

  it('should skip geocoding and basemap lookup entirely when no extent/geometry is given', async () => {
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData } } as any;

    await processor(job);

    expect(deps.reverseGeocodingUseCase.execute).not.toHaveBeenCalled();
    expect(deps.baseMapRepository.findByInstance).not.toHaveBeenCalled();
    expect(deps.zoneBasemapService.fetchForZone).not.toHaveBeenCalled();
  });

  it('should still generate the report when reverse geocoding fails (place name omitted, never blocking)', async () => {
    deps.reverseGeocodingUseCase.execute.mockRejectedValue(new Error('Nominatim indisponible'));
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    expect(deps.reportRendererService.renderHtmlToPdf).toHaveBeenCalled();
    const html = deps.reportRendererService.renderHtmlToPdf.mock.calls[0][0] as string;
    expect(html).not.toContain('<div class="zone-place">');
    expect(deps.notificationService.notifyUser).toHaveBeenCalledWith(
      'user-1',
      'analysis-report:completed',
      expect.anything(),
    );
  });

  it('should still generate the report when the basemap fetch fails (schematic fallback, never blocking)', async () => {
    deps.zoneBasemapService.fetchForZone.mockResolvedValue(null);
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    expect(deps.reportRendererService.renderHtmlToPdf).toHaveBeenCalled();
    const html = deps.reportRendererService.renderHtmlToPdf.mock.calls[0][0] as string;
    expect(html).toContain('fill="#f6f8f9" stroke="#e0e0e0"');
    expect(deps.notificationService.notifyUser).toHaveBeenCalledWith(
      'user-1',
      'analysis-report:completed',
      expect.anything(),
    );
  });

  it('should not query a basemap when the instance/default basemaps are all unsupported types', async () => {
    deps.baseMapRepository.findByInstance.mockResolvedValue([
      { type: 'MAPBOX', url: 'https://api.mapbox.com/x', attribution: null },
    ]);
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    expect(deps.zoneBasemapService.fetchForZone).not.toHaveBeenCalled();
  });

  it('should fall back to instance defaults when the instance has no basemaps of its own', async () => {
    deps.baseMapRepository.findByInstance.mockResolvedValue([]);
    deps.baseMapRepository.findDefaults.mockResolvedValue([
      { type: 'XYZ', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' },
    ]);
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    expect(deps.baseMapRepository.findDefaults).toHaveBeenCalled();
    expect(deps.zoneBasemapService.fetchForZone).toHaveBeenCalled();
  });

  it('should fall back to the short summary narrative when Gemini fails', async () => {
    deps.geminiService.generateText.mockRejectedValue(new Error('Gemini down'));
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await processor(job);

    const html = deps.reportRendererService.renderHtmlToPdf.mock.calls[0][0] as string;
    expect(html).toContain('Synthèse courte.');
  });

  it('should mark the report FAILED and rethrow when no layer data is available', async () => {
    deps.summarizeViewportUseCase.execute.mockResolvedValue({
      layerCount: 0,
      totalFeatureCount: 0,
      perLayer: [],
    });
    const processor = createAnalysisReportProcessor(deps as any);
    const job = { id: 'job-1', data: { ...baseJobData, extent: [9.6, 4.0, 9.8, 4.1] } } as any;

    await expect(processor(job)).rejects.toThrow('Aucune donnée disponible');
    expect(deps.prisma.analysisReport.update).toHaveBeenCalledWith({
      where: { id: 'report-1' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });
    expect(deps.notificationService.notifyUser).toHaveBeenCalledWith(
      'user-1',
      'analysis-report:failed',
      expect.anything(),
    );
  });
});
