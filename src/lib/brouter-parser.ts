// BRouter GeoJSON parser
// Converts BRouter API GeoJSON responses to GpxRoute for Garmin Course upload

import type { GpxRoute, GpxPoint } from './gpx-parser';

interface BRouterFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: number[][]; // [lon, lat] or [lon, lat, ele]
  };
  properties: Record<string, string | number | null>;
}

interface BRouterGeoJson {
  type: 'FeatureCollection';
  features: BRouterFeature[];
}

/**
 * Parse a BRouter API GeoJSON string into a GpxRoute.
 * Expects a FeatureCollection with a single LineString Feature.
 */
export function parseBrouterGeoJson(geojsonString: string, routeName = 'BRouter Route'): GpxRoute {
  let geojson: BRouterGeoJson;
  try {
    geojson = JSON.parse(geojsonString) as BRouterGeoJson;
  } catch {
    throw new Error('Invalid GeoJSON: failed to parse JSON');
  }

  if (!geojson || geojson.type !== 'FeatureCollection') {
    throw new Error('Invalid GeoJSON: expected FeatureCollection');
  }

  if (!Array.isArray(geojson.features) || geojson.features.length === 0) {
    throw new Error('Invalid GeoJSON: no features found');
  }

  const feature = geojson.features[0];
  if (!feature.geometry || feature.geometry.type !== 'LineString') {
    throw new Error('Invalid GeoJSON: expected LineString geometry');
  }

  const coordinates = feature.geometry.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    throw new Error('Invalid GeoJSON: LineString has no coordinates');
  }

  const points: GpxPoint[] = coordinates.map(coord => ({
    lon: coord[0],
    lat: coord[1],
    ele: coord.length > 2 ? coord[2] : undefined,
  }));

  const { totalDistance, totalElevationGain } = calculateRouteStats(points);

  return {
    name: routeName,
    points,
    waypoints: [],
    totalDistance,
    totalElevationGain,
  };
}

/**
 * Stitch multiple BRouter GeoJSON segment strings into a single GpxRoute.
 * Removes duplicate join points between consecutive segments.
 */
export function stitchBrouterSegments(
  segmentJsonStrings: string[],
  routeName = 'BRouter Route'
): GpxRoute {
  if (segmentJsonStrings.length === 0) {
    throw new Error('No segments to stitch');
  }

  const allPoints: GpxPoint[] = [];

  for (let i = 0; i < segmentJsonStrings.length; i++) {
    const segment = parseBrouterGeoJson(segmentJsonStrings[i], routeName);
    if (segment.points.length === 0) continue;

    if (i === 0) {
      allPoints.push(...segment.points);
    } else {
      // Skip first point to avoid duplicate at segment join
      allPoints.push(...segment.points.slice(1));
    }
  }

  if (allPoints.length === 0) {
    throw new Error('Stitched route has no points');
  }

  const { totalDistance, totalElevationGain } = calculateRouteStats(allPoints);

  return {
    name: routeName,
    points: allPoints,
    waypoints: [],
    totalDistance,
    totalElevationGain,
  };
}

function calculateRouteStats(points: GpxPoint[]): {
  totalDistance: number;
  totalElevationGain: number;
} {
  let totalDistance = 0;
  let totalElevationGain = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    totalDistance += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

    if (prev.ele !== undefined && curr.ele !== undefined) {
      const elevDiff = curr.ele - prev.ele;
      if (elevDiff > 0) {
        totalElevationGain += elevDiff;
      }
    }
  }

  return { totalDistance, totalElevationGain };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
