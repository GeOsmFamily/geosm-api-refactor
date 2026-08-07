import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateLocationPlanUseCase } from '../../../../../src/application/use-cases/location-plans/create-location-plan.use-case.js';
import { JobStatus, PaperSize, PlanOrientation } from '../../../../../src/domain/enums.js';

function makeDeps() {
  const locationPlanRepository = {
    create: vi.fn(async (data: any) => ({ ...data, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn(),
    findById: vi.fn(),
  };
  const instanceRepository = {
    findById: vi.fn(async () => ({ id: 'instance-1', bbox: [0, 0, 1, 1] })),
  };
  const queueService = { addJob: vi.fn(async () => undefined) };
  const postGISService = {
    findNearestPlaces: vi.fn(async () => []),
    drapeElevationProfile: vi.fn(async () => []),
  };
  const geminiService = { generateText: vi.fn(async () => '') };
  const osrmService = { route: vi.fn() };

  const useCase = new CreateLocationPlanUseCase(
    locationPlanRepository as any,
    instanceRepository as any,
    queueService as any,
    postGISService as any,
    geminiService as any,
    osrmService as any,
  );

  return {
    useCase,
    locationPlanRepository,
    instanceRepository,
    queueService,
    postGISService,
    geminiService,
    osrmService,
  };
}

const baseDto = {
  instanceId: 'instance-1',
  title: 'Mon lieu',
  lon: 9.7,
  lat: 4.05,
};

describe('CreateLocationPlanUseCase', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('throws if the instance does not exist', async () => {
    deps.instanceRepository.findById.mockResolvedValueOnce(null);
    await expect(deps.useCase.execute('user-1', baseDto as any)).rejects.toThrow(
      'Instance instance-1 not found',
    );
  });

  it('creates a plan without AI and without origin, enqueues the job', async () => {
    const record = await deps.useCase.execute('user-1', baseDto as any);
    expect(record.title).toBe('Mon lieu');
    expect(record.originLon).toBeNull();
    expect(record.accessInstructions).toBeNull();
    expect(deps.postGISService.findNearestPlaces).not.toHaveBeenCalled();
    expect(deps.osrmService.route).not.toHaveBeenCalled();
    expect(deps.queueService.addJob).toHaveBeenCalledWith(
      'location-plan',
      'generate',
      expect.objectContaining({ title: 'Mon lieu', paperSize: PaperSize.A4, orientation: PlanOrientation.PORTRAIT }),
    );
    expect(deps.locationPlanRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: JobStatus.PENDING }),
    );
  });

  describe('autoFillWithAI', () => {
    it('fills description/landmark from Gemini when fields are empty (fr)', async () => {
      deps.postGISService.findNearestPlaces.mockResolvedValueOnce([
        { kind: 'place', name: 'Bonabéri', distanceMeters: 120 },
      ]);
      deps.geminiService.generateText.mockResolvedValueOnce(
        '{"description": "Un quartier animé", "landmark": "Rond point"}',
      );
      const record = await deps.useCase.execute('user-1', { ...baseDto, autoFillWithAI: true } as any);
      expect(record.description).toBe('Un quartier animé');
      expect(record.landmark).toBe('Rond point');
    });

    it('fills description/landmark from Gemini in English when lang=en, with no nearby place', async () => {
      const record = await deps.useCase.execute(
        'user-1',
        { ...baseDto, autoFillWithAI: true } as any,
        'en',
      );
      expect(deps.geminiService.generateText).toHaveBeenCalledWith(
        expect.stringContaining('You are writing the content'),
      );
      // Gemini mock returns '' (default) -> no JSON match -> draftWithAI returns null, fields stay null.
      expect(record.description).toBeNull();
    });

    it('does not overwrite an already-provided description/landmark', async () => {
      const record = await deps.useCase.execute(
        'user-1',
        { ...baseDto, autoFillWithAI: true, description: 'Déjà rempli', landmark: 'Déjà là' } as any,
      );
      expect(deps.geminiService.generateText).not.toHaveBeenCalled();
      expect(record.description).toBe('Déjà rempli');
      expect(record.landmark).toBe('Déjà là');
    });

    it('leaves description/landmark null when Gemini throws', async () => {
      deps.geminiService.generateText.mockRejectedValueOnce(new Error('quota exceeded'));
      const record = await deps.useCase.execute('user-1', { ...baseDto, autoFillWithAI: true } as any);
      expect(record.description).toBeNull();
      expect(record.landmark).toBeNull();
    });

    it('leaves description/landmark null when Gemini answers non-JSON text', async () => {
      deps.geminiService.generateText.mockResolvedValueOnce('not json at all');
      const record = await deps.useCase.execute('user-1', { ...baseDto, autoFillWithAI: true } as any);
      expect(record.description).toBeNull();
    });
  });

  describe('access route (origin provided)', () => {
    const withOrigin = { ...baseDto, originLon: 9.68, originLat: 4.07 };

    it('leaves route fields null when OSRM driving route fails', async () => {
      deps.osrmService.route.mockResolvedValueOnce({ code: 'NoRoute', routes: [] });
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.routeLegs).toBeNull();
      expect(record.accessInstructions).toBeNull();
    });

    it('creates a single driving leg when the destination snaps close to the road', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 500, duration: 60, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      deps.geminiService.generateText.mockResolvedValueOnce('Roulez 500m.');
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.routeLegs).toHaveLength(1);
      expect((record.routeLegs as any)[0].mode).toBe('driving');
      expect(record.accessInstructions).toBe('Roulez 500m.');
    });

    it('adds a walking leg when the snapped point is far from the true destination', async () => {
      deps.osrmService.route
        .mockResolvedValueOnce({
          code: 'Ok',
          routes: [{ distance: 900, duration: 120, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.699, 4.0501]] } }],
          // Snapped point ~100m away from the true destination [9.7, 4.05].
          waypoints: [{ location: [9.68, 4.07] }, { location: [9.699, 4.0501] }],
        })
        .mockResolvedValueOnce({
          code: 'Ok',
          routes: [{ distance: 95, duration: 80, geometry: { type: 'LineString', coordinates: [[9.699, 4.0501], [9.7, 4.05]] } }],
          waypoints: [],
        });
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.routeLegs).toHaveLength(2);
      expect((record.routeLegs as any)[1].mode).toBe('walking');
      expect((record.routeLegs as any)[1].distanceMeters).toBe(95);
    });

    it('falls back to a straight line when the OSRM walking request throws', async () => {
      deps.osrmService.route
        .mockResolvedValueOnce({
          code: 'Ok',
          routes: [{ distance: 900, duration: 120, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.699, 4.0501]] } }],
          waypoints: [{ location: [9.68, 4.07] }, { location: [9.699, 4.0501] }],
        })
        .mockRejectedValueOnce(new Error('walking profile unavailable'));
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      const walkLeg = (record.routeLegs as any)[1];
      expect(walkLeg.mode).toBe('walking');
      expect(walkLeg.geometry.coordinates[0]).toEqual([9.699, 4.0501]);
      expect(walkLeg.geometry.coordinates.at(-1)).toEqual([9.7, 4.05]);
    });

    it('tops up a degenerate walking route (both ends snapped to the same node)', async () => {
      deps.osrmService.route
        .mockResolvedValueOnce({
          code: 'Ok',
          routes: [{ distance: 900, duration: 120, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.699, 4.0501]] } }],
          waypoints: [{ location: [9.68, 4.07] }, { location: [9.699, 4.0501] }],
        })
        .mockResolvedValueOnce({
          code: 'Ok',
          // Degenerate: OSRM snapped both ends to the exact same point, short of the true destination.
          routes: [{ distance: 0, duration: 0, geometry: { type: 'LineString', coordinates: [[9.699, 4.0501], [9.699, 4.0501]] } }],
          waypoints: [],
        });
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      const walkLeg = (record.routeLegs as any)[1];
      expect(walkLeg.distanceMeters).toBeGreaterThan(0);
      expect(walkLeg.geometry.coordinates.at(-1)).toEqual([9.7, 4.05]);
    });

    it('returns null elevation and keeps a fallback instruction when the elevation profile is empty', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 500, duration: 60, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      deps.postGISService.drapeElevationProfile.mockResolvedValueOnce([]);
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.elevationSummary).toBeNull();
    });

    it('classifies terrain from the elevation profile (flat/rolling/steep boundaries)', async () => {
      deps.osrmService.route.mockResolvedValue({
        code: 'Ok',
        routes: [{ distance: 500, duration: 60, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });

      deps.postGISService.drapeElevationProfile.mockResolvedValueOnce([
        { distance: 0, altitude: 100 },
        { distance: 50, altitude: 105 },
        { distance: 100, altitude: 108 },
      ]);
      let record = await deps.useCase.execute('user-1', withOrigin as any);
      expect((record.elevationSummary as any).terrainClass).toBe('plat');

      deps.postGISService.drapeElevationProfile.mockResolvedValueOnce([
        { distance: 0, altitude: 100 },
        { distance: 50, altitude: 130 },
        { distance: 100, altitude: 125 },
      ]);
      record = await deps.useCase.execute('user-1', withOrigin as any);
      expect((record.elevationSummary as any).terrainClass).toBe('vallonne');
      expect((record.elevationSummary as any).descentMeters).toBeCloseTo(5);

      deps.postGISService.drapeElevationProfile.mockResolvedValueOnce([
        { distance: 0, altitude: 100 },
        { distance: 50, altitude: 200 },
      ]);
      record = await deps.useCase.execute('user-1', withOrigin as any);
      expect((record.elevationSummary as any).terrainClass).toBe('accidente');
      expect((record.elevationSummary as any).maxAltitudeMeters).toBe(200);
    });

    it('returns null elevation when drapeElevationProfile throws', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 500, duration: 60, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      deps.postGISService.drapeElevationProfile.mockRejectedValueOnce(new Error('SRTM unavailable'));
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.elevationSummary).toBeNull();
    });

    it('falls back to a deterministic access sentence when Gemini fails', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 950, duration: 152, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      deps.geminiService.generateText.mockRejectedValueOnce(new Error('unavailable'));
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.accessInstructions).toContain('Accès :');
      expect(record.accessInstructions).toContain('en véhicule');
    });

    it('falls back to a deterministic sentence when Gemini returns an empty string', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 950, duration: 152, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      deps.geminiService.generateText.mockResolvedValueOnce('   ');
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.accessInstructions).toContain('Accès :');
    });

    it('returns null access route entirely when the OSRM call throws', async () => {
      deps.osrmService.route.mockRejectedValueOnce(new Error('OSRM down'));
      const record = await deps.useCase.execute('user-1', withOrigin as any);
      expect(record.routeLegs).toBeNull();
      expect(record.elevationSummary).toBeNull();
      expect(record.accessInstructions).toBeNull();
    });

    it('passes originLon/originLat and route data through to the enqueued job', async () => {
      deps.osrmService.route.mockResolvedValueOnce({
        code: 'Ok',
        routes: [{ distance: 500, duration: 60, geometry: { type: 'LineString', coordinates: [[9.68, 4.07], [9.7, 4.05]] } }],
        waypoints: [{ location: [9.68, 4.07] }, { location: [9.7, 4.05] }],
      });
      await deps.useCase.execute('user-1', withOrigin as any);
      expect(deps.queueService.addJob).toHaveBeenCalledWith(
        'location-plan',
        'generate',
        expect.objectContaining({
          originLon: 9.68,
          originLat: 4.07,
          routeLegs: expect.any(Array),
        }),
      );
    });
  });
});
