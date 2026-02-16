import { parseGpx, convertGpxToGarminCourse } from '../src/lib/gpx-parser';
import type { GpxRoute } from '../src/lib/gpx-parser';
import type { GarminCourse } from '../src/shared/messages';

describe('GPX Parser', () => {
  describe('parseGpx', () => {
    it('should parse a simple GPX file with track points', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <name>Test Route</name>
            <trkseg>
              <trkpt lat="49.936598" lon="16.974098">
                <ele>304.0</ele>
              </trkpt>
              <trkpt lat="49.936604" lon="16.973928">
                <ele>303.0</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>`;

      const route = parseGpx(gpx);

      expect(route.name).toBe('Test Route');
      expect(route.points).toHaveLength(2);
      expect(route.points[0].lat).toBe(49.936598);
      expect(route.points[0].lon).toBe(16.974098);
      expect(route.points[0].ele).toBe(304.0);
    });

    it('should parse GPX with waypoints', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <wpt lat="49.9366" lon="16.9741">
            <name>Start Point</name>
            <desc>Starting location</desc>
          </wpt>
          <trk>
            <name>Test Route</name>
            <trkseg>
              <trkpt lat="49.936598" lon="16.974098">
                <ele>304.0</ele>
              </trkpt>
            </trkseg>
          </trk>
        </gpx>`;

      const route = parseGpx(gpx);

      expect(route.waypoints).toHaveLength(1);
      expect(route.waypoints[0].name).toBe('Start Point');
      expect(route.waypoints[0].description).toBe('Starting location');
    });

    it('should calculate total distance', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <name>Test Route</name>
            <trkseg>
              <trkpt lat="49.936598" lon="16.974098"><ele>304.0</ele></trkpt>
              <trkpt lat="49.936604" lon="16.973928"><ele>303.0</ele></trkpt>
              <trkpt lat="49.936627" lon="16.973766"><ele>303.0</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>`;

      const route = parseGpx(gpx);

      expect(route.totalDistance).toBeGreaterThan(0);
      expect(route.totalDistance).toBeLessThan(50); // Should be ~25 meters
    });

    it('should calculate elevation gain', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <name>Test Route</name>
            <trkseg>
              <trkpt lat="49.936598" lon="16.974098"><ele>300.0</ele></trkpt>
              <trkpt lat="49.936604" lon="16.973928"><ele>310.0</ele></trkpt>
              <trkpt lat="49.936627" lon="16.973766"><ele>305.0</ele></trkpt>
            </trkseg>
          </trk>
        </gpx>`;

      const route = parseGpx(gpx);

      expect(route.totalElevationGain).toBe(10); // 300 -> 310 = +10
    });

    it('should handle missing elevation data', () => {
      const gpx = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
          <trk>
            <name>Test Route</name>
            <trkseg>
              <trkpt lat="49.936598" lon="16.974098"></trkpt>
              <trkpt lat="49.936604" lon="16.973928"></trkpt>
            </trkseg>
          </trk>
        </gpx>`;

      const route = parseGpx(gpx);

      expect(route.points).toHaveLength(2);
      expect(route.points[0].ele).toBeUndefined();
      expect(route.totalElevationGain).toBe(0);
    });

    it('should throw error for invalid XML', () => {
      const invalidGpx = 'not xml';

      expect(() => parseGpx(invalidGpx)).toThrow('Invalid GPX XML');
    });
  });
});

describe('GPX to Garmin Course Conversion', () => {
  // Helper to create a simple test route
  const createTestRoute = (pointCount: number = 3): GpxRoute => {
    const points = [];
    for (let i = 0; i < pointCount; i++) {
      points.push({
        lat: 49.936598 + i * 0.0001,
        lon: 16.974098 + i * 0.0001,
        ele: 300 + i * 5,
      });
    }

    return {
      name: 'Test Route',
      points,
      waypoints: [],
      totalDistance: 100,
      totalElevationGain: 10,
    };
  };

  describe('convertGpxToGarminCourse', () => {
    it('should convert a simple route to Garmin Course format', () => {
      const route = createTestRoute(3);
      const course = convertGpxToGarminCourse(route, 'cycling');

      expect(course).toBeDefined();
      expect(course.courseName).toBe('Test Route');
      expect(course.activityTypePk).toBe(10); // cycling
      expect(course.coordinateSystem).toBe('WGS84');
    });

    it('should create geo points with cumulative distances', () => {
      const route = createTestRoute(3);
      const course = convertGpxToGarminCourse(route);

      expect(course.geoPoints).toHaveLength(3);
      expect(course.geoPoints[0].distance).toBe(0); // First point at 0
      expect(course.geoPoints[1].distance).toBeGreaterThan(0);
      expect(course.geoPoints[2].distance).toBeGreaterThan(course.geoPoints[1].distance);
    });

    it('should set correct activity type for cycling', () => {
      const route = createTestRoute();
      const course = convertGpxToGarminCourse(route, 'cycling');

      expect(course.activityTypePk).toBe(10);
    });

    it('should set correct activity type for hiking', () => {
      const route = createTestRoute();
      const course = convertGpxToGarminCourse(route, 'hiking');

      expect(course.activityTypePk).toBe(17);
    });

    it('should calculate elevation gain correctly', () => {
      const route: GpxRoute = {
        name: 'Climbing Route',
        points: [
          { lat: 49.936, lon: 16.974, ele: 100 },
          { lat: 49.937, lon: 16.975, ele: 150 }, // +50
          { lat: 49.938, lon: 16.976, ele: 140 }, // -10
          { lat: 49.939, lon: 16.977, ele: 160 }, // +20
        ],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.elevationGainMeter).toBe(70); // 50 + 20
      expect(course.elevationLossMeter).toBe(10);
    });

    it('should handle missing elevation data with defaults', () => {
      const route: GpxRoute = {
        name: 'Flat Route',
        points: [
          { lat: 49.936, lon: 16.974 }, // no elevation
          { lat: 49.937, lon: 16.975 }, // no elevation
        ],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.elevationGainMeter).toBe(0);
      expect(course.elevationLossMeter).toBe(0);
      expect(course.geoPoints[0].elevation).toBe(0);
      expect(course.geoPoints[1].elevation).toBe(0);
    });

    it('should generate correct bounding box', () => {
      const route: GpxRoute = {
        name: 'Test Route',
        points: [
          { lat: 49.936, lon: 16.974, ele: 300 },
          { lat: 49.940, lon: 16.978, ele: 310 }, // max
          { lat: 49.935, lon: 16.972, ele: 305 }, // min
        ],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.boundingBox.lowerLeft.latitude).toBe(49.935);
      expect(course.boundingBox.lowerLeft.longitude).toBe(16.972);
      expect(course.boundingBox.upperRight.latitude).toBe(49.940);
      expect(course.boundingBox.upperRight.longitude).toBe(16.978);
      expect(course.boundingBox.lowerLeftLatIsSet).toBe(true);
      expect(course.boundingBox.upperRightLongIsSet).toBe(true);
    });

    it('should create course lines with correct metadata', () => {
      const route = createTestRoute(100); // 100 points
      const course = convertGpxToGarminCourse(route);

      expect(course.courseLines).toHaveLength(1);
      expect(course.courseLines[0].numberOfPoints).toBe(100);
      expect(course.courseLines[0].distanceInMeters).toBe(course.distanceMeter);
      expect(course.courseLines[0].coordinateSystem).toBe('WGS84');
      expect(course.courseLines[0].sortOrder).toBe(1);
    });

    it('should set start point correctly', () => {
      const route: GpxRoute = {
        name: 'Test Route',
        points: [
          { lat: 49.936598, lon: 16.974098, ele: 304.5 },
          { lat: 49.937, lon: 16.975, ele: 310 },
        ],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.startPoint.latitude).toBe(49.936598);
      expect(course.startPoint.longitude).toBe(16.974098);
      expect(course.startPoint.elevation).toBe(304.5);
      expect(course.startPoint.distance).toBe(0);
    });

    it('should convert waypoints to course points', () => {
      const route: GpxRoute = {
        name: 'Test Route',
        points: [
          { lat: 49.936, lon: 16.974, ele: 300 },
          { lat: 49.937, lon: 16.975, ele: 310 },
        ],
        waypoints: [
          { lat: 49.9365, lon: 16.9745, name: 'Turn Left', description: 'Sharp turn' },
          { lat: 49.9375, lon: 16.9755, name: 'Water Station', description: 'Refill here' },
        ],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.coursePoints).toHaveLength(2);
      expect(course.coursePoints[0].name).toBe('Turn Left');
      expect(course.coursePoints[0].latitude).toBe(49.9365);
      expect(course.coursePoints[0].type).toBe(5); // Generic waypoint
      expect(course.coursePoints[1].name).toBe('Water Station');
    });

    it('should set all required Garmin Course fields', () => {
      const route = createTestRoute();
      const course = convertGpxToGarminCourse(route);

      // Verify all required fields are present
      expect(course.activityTypePk).toBeDefined();
      expect(course.hasTurnDetectionDisabled).toBe(false);
      expect(course.geoPoints).toBeDefined();
      expect(course.courseLines).toBeDefined();
      expect(course.boundingBox).toBeDefined();
      expect(course.coursePoints).toBeDefined();
      expect(course.distanceMeter).toBeGreaterThan(0);
      expect(course.elevationGainMeter).toBeGreaterThanOrEqual(0);
      expect(course.elevationLossMeter).toBeGreaterThanOrEqual(0);
      expect(course.startPoint).toBeDefined();
      expect(course.coordinateSystem).toBe('WGS84');
      expect(course.rulePK).toBe(2);
      expect(course.courseName).toBeDefined();
      expect(course.sourceTypeId).toBe(3);
    });

    it('should throw error for empty route', () => {
      const emptyRoute: GpxRoute = {
        name: 'Empty',
        points: [],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      expect(() => convertGpxToGarminCourse(emptyRoute)).toThrow('No points in GPX route');
    });

    it('should handle single point route', () => {
      const route: GpxRoute = {
        name: 'Single Point',
        points: [{ lat: 49.936, lon: 16.974, ele: 300 }],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.geoPoints).toHaveLength(1);
      expect(course.distanceMeter).toBe(0);
      expect(course.elevationGainMeter).toBe(0);
    });

    it('should round elevation values to 2 decimal places', () => {
      const route: GpxRoute = {
        name: 'Test',
        points: [
          { lat: 49.936, lon: 16.974, ele: 100 },
          { lat: 49.937, lon: 16.975, ele: 123.456 },
        ],
        waypoints: [],
        totalDistance: 0,
        totalElevationGain: 0,
      };

      const course = convertGpxToGarminCourse(route);

      expect(course.elevationGainMeter).toBe(23.46); // Rounded to 2 decimals
    });

    it('should match the structure from test-course-api.js', () => {
      const route = createTestRoute();
      const course = convertGpxToGarminCourse(route);

      // Verify structure matches reference implementation
      expect(course).toMatchObject({
        activityTypePk: expect.any(Number),
        hasTurnDetectionDisabled: false,
        geoPoints: expect.any(Array),
        courseLines: expect.any(Array),
        boundingBox: expect.objectContaining({
          lowerLeft: expect.objectContaining({
            latitude: expect.any(Number),
            longitude: expect.any(Number),
          }),
          upperRight: expect.objectContaining({
            latitude: expect.any(Number),
            longitude: expect.any(Number),
          }),
        }),
        coursePoints: expect.any(Array),
        distanceMeter: expect.any(Number),
        elevationGainMeter: expect.any(Number),
        elevationLossMeter: expect.any(Number),
        startPoint: expect.objectContaining({
          latitude: expect.any(Number),
          longitude: expect.any(Number),
          elevation: expect.any(Number),
          distance: 0,
        }),
        elapsedSeconds: null,
        openStreetMap: false,
        coordinateSystem: 'WGS84',
        rulePK: 2,
        courseName: expect.any(String),
        matchedToSegments: false,
        includeLaps: false,
        hasPaceBand: false,
        hasPowerGuide: false,
        favorite: false,
        speedMeterPerSecond: null,
        sourceTypeId: 3,
      });
    });
  });
});
