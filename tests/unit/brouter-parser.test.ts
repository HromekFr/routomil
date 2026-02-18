import { parseBrouterGeoJson, stitchBrouterSegments } from '../../src/lib/brouter-parser';

const makeSegmentJson = (coords: number[][], props: Record<string, string | number | null> = {}) =>
  JSON.stringify({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: props,
      },
    ],
  });

describe('parseBrouterGeoJson', () => {
  it('parses a basic LineString with lon/lat/ele', () => {
    const json = makeSegmentJson([
      [16.98, 49.96, 250],
      [17.01, 49.97, 260],
      [17.04, 49.93, 245],
    ]);
    const route = parseBrouterGeoJson(json, 'Test Route');
    expect(route.name).toBe('Test Route');
    expect(route.points).toHaveLength(3);
    expect(route.points[0]).toEqual({ lon: 16.98, lat: 49.96, ele: 250 });
    expect(route.points[1]).toEqual({ lon: 17.01, lat: 49.97, ele: 260 });
    expect(route.totalDistance).toBeGreaterThan(0);
    expect(route.totalElevationGain).toBeGreaterThan(0);
    expect(route.waypoints).toHaveLength(0);
  });

  it('parses coordinates without elevation', () => {
    const json = makeSegmentJson([
      [16.98, 49.96],
      [17.04, 49.93],
    ]);
    const route = parseBrouterGeoJson(json);
    expect(route.points[0].ele).toBeUndefined();
    expect(route.totalElevationGain).toBe(0);
  });

  it('uses default route name when not provided', () => {
    const json = makeSegmentJson([[16.98, 49.96], [17.04, 49.93]]);
    const route = parseBrouterGeoJson(json);
    expect(route.name).toBe('BRouter Route');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseBrouterGeoJson('not json')).toThrow('Invalid GeoJSON: failed to parse JSON');
  });

  it('throws on non-FeatureCollection', () => {
    const json = JSON.stringify({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
    expect(() => parseBrouterGeoJson(json)).toThrow('expected FeatureCollection');
  });

  it('throws on empty features array', () => {
    const json = JSON.stringify({ type: 'FeatureCollection', features: [] });
    expect(() => parseBrouterGeoJson(json)).toThrow('no features found');
  });

  it('throws on non-LineString geometry', () => {
    const json = JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [16.98, 49.96] }, properties: {} }],
    });
    expect(() => parseBrouterGeoJson(json)).toThrow('expected LineString geometry');
  });

  it('throws on empty coordinates', () => {
    const json = makeSegmentJson([]);
    expect(() => parseBrouterGeoJson(json)).toThrow('LineString has no coordinates');
  });

  it('calculates distance correctly for known coordinates', () => {
    // ~4.7km between these two points
    const json = makeSegmentJson([
      [16.98, 49.96],
      [17.04, 49.93],
    ]);
    const route = parseBrouterGeoJson(json);
    expect(route.totalDistance).toBeGreaterThan(4000);
    expect(route.totalDistance).toBeLessThan(6000);
  });
});

describe('stitchBrouterSegments', () => {
  it('stitches two segments removing duplicate join point', () => {
    const seg1 = makeSegmentJson([
      [16.98, 49.96, 250],
      [17.01, 49.97, 260],
    ]);
    const seg2 = makeSegmentJson([
      [17.01, 49.97, 260], // duplicate - should be removed
      [17.04, 49.93, 245],
    ]);
    const route = stitchBrouterSegments([seg1, seg2], 'Combined Route');
    expect(route.name).toBe('Combined Route');
    expect(route.points).toHaveLength(3);
    expect(route.points[0]).toEqual({ lon: 16.98, lat: 49.96, ele: 250 });
    expect(route.points[1]).toEqual({ lon: 17.01, lat: 49.97, ele: 260 });
    expect(route.points[2]).toEqual({ lon: 17.04, lat: 49.93, ele: 245 });
  });

  it('stitches single segment without modification', () => {
    const seg = makeSegmentJson([
      [16.98, 49.96, 250],
      [17.01, 49.97, 260],
      [17.04, 49.93, 245],
    ]);
    const route = stitchBrouterSegments([seg], 'Single');
    expect(route.points).toHaveLength(3);
  });

  it('stitches three segments correctly', () => {
    const seg1 = makeSegmentJson([[16.0, 49.0], [16.1, 49.1]]);
    const seg2 = makeSegmentJson([[16.1, 49.1], [16.2, 49.2]]);
    const seg3 = makeSegmentJson([[16.2, 49.2], [16.3, 49.3]]);
    const route = stitchBrouterSegments([seg1, seg2, seg3]);
    expect(route.points).toHaveLength(4);
    expect(route.points[0]).toMatchObject({ lon: 16.0, lat: 49.0 });
    expect(route.points[3]).toMatchObject({ lon: 16.3, lat: 49.3 });
  });

  it('throws on empty segments array', () => {
    expect(() => stitchBrouterSegments([])).toThrow('No segments to stitch');
  });

  it('uses default route name', () => {
    const seg = makeSegmentJson([[16.0, 49.0], [16.1, 49.1]]);
    const route = stitchBrouterSegments([seg]);
    expect(route.name).toBe('BRouter Route');
  });
});
