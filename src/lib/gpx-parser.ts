// GPX XML parser

import type {
  GarminCourse,
  GarminGeoPoint,
  GarminCourseLine,
  GarminCoursePoint,
  GarminBoundingBox,
  ActivityType,
} from '../shared/messages';

export interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: Date;
  name?: string;
}

export interface GpxWaypoint extends GpxPoint {
  name: string;
  description?: string;
  type?: string;
}

export interface GpxRoute {
  name: string;
  description?: string;
  points: GpxPoint[];
  waypoints: GpxWaypoint[];
  totalDistance: number;
  totalElevationGain: number;
}

export function parseGpx(gpxContent: string): GpxRoute {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'application/xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid GPX XML: ' + parserError.textContent);
  }

  // Get route name from metadata or first track/route
  const name =
    doc.querySelector('metadata > name')?.textContent ||
    doc.querySelector('trk > name')?.textContent ||
    doc.querySelector('rte > name')?.textContent ||
    'Unnamed Route';

  const description =
    doc.querySelector('metadata > desc')?.textContent ||
    doc.querySelector('trk > desc')?.textContent ||
    doc.querySelector('rte > desc')?.textContent;

  // Extract track points (trkpt) or route points (rtept)
  const points: GpxPoint[] = [];

  // Try track segments first
  const trkpts = doc.querySelectorAll('trkpt');
  if (trkpts.length > 0) {
    trkpts.forEach(pt => {
      const point = parsePointElement(pt);
      if (point) points.push(point);
    });
  } else {
    // Fall back to route points
    const rtepts = doc.querySelectorAll('rtept');
    rtepts.forEach(pt => {
      const point = parsePointElement(pt);
      if (point) points.push(point);
    });
  }

  // Extract waypoints
  const waypoints: GpxWaypoint[] = [];
  const wpts = doc.querySelectorAll('wpt');
  wpts.forEach(wpt => {
    const point = parsePointElement(wpt);
    if (point) {
      const wpName = wpt.querySelector('name')?.textContent || 'Waypoint';
      waypoints.push({
        ...point,
        name: wpName,
        description: wpt.querySelector('desc')?.textContent ?? undefined,
        type: wpt.querySelector('type')?.textContent ?? undefined,
      });
    }
  });

  // Calculate total distance and elevation gain
  const { totalDistance, totalElevationGain } = calculateRouteStats(points);

  return {
    name,
    description: description ?? undefined,
    points,
    waypoints,
    totalDistance,
    totalElevationGain,
  };
}

function parsePointElement(element: Element): GpxPoint | null {
  const lat = parseFloat(element.getAttribute('lat') || '');
  const lon = parseFloat(element.getAttribute('lon') || '');

  if (isNaN(lat) || isNaN(lon)) return null;

  const eleText = element.querySelector('ele')?.textContent;
  const timeText = element.querySelector('time')?.textContent;

  return {
    lat,
    lon,
    ele: eleText ? parseFloat(eleText) : undefined,
    time: timeText ? new Date(timeText) : undefined,
    name: element.querySelector('name')?.textContent ?? undefined,
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

    // Calculate distance using Haversine formula
    totalDistance += haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon);

    // Calculate elevation gain
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
  const R = 6371000; // Earth's radius in meters
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

/**
 * Map activity type to Garmin activity type ID
 */
function getActivityTypePk(activityType: ActivityType): number {
  return activityType === 'hiking' ? 17 : 10; // 10 = cycling, 17 = hiking
}

/**
 * Convert GPX route to Garmin Course JSON format
 * Reference: test-course-api.js lines 85-193
 */
export function convertGpxToGarminCourse(
  route: GpxRoute,
  activityType: ActivityType = 'cycling'
): GarminCourse {
  if (route.points.length === 0) {
    throw new Error('No points in GPX route');
  }

  // Calculate cumulative distances and create geoPoints
  let cumulativeDistance = 0;
  const geoPoints: GarminGeoPoint[] = [];

  for (let i = 0; i < route.points.length; i++) {
    const point = route.points[i];

    // Calculate distance from previous point
    if (i > 0) {
      const prev = route.points[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, point.lat, point.lon);
      cumulativeDistance += dist;
    }

    geoPoints.push({
      latitude: point.lat,
      longitude: point.lon,
      elevation: point.ele ?? 0,
      distance: cumulativeDistance,
      timestamp: i === 0 ? 0 : null,
    });
  }

  // Calculate elevation gain and loss
  let elevationGain = 0;
  let elevationLoss = 0;

  for (let i = 1; i < route.points.length; i++) {
    const prevEle = route.points[i - 1].ele ?? 0;
    const currEle = route.points[i].ele ?? 0;
    const diff = currEle - prevEle;

    if (diff > 0) {
      elevationGain += diff;
    } else {
      elevationLoss += Math.abs(diff);
    }
  }

  // Calculate bounding box
  const lats = route.points.map((p) => p.lat);
  const lons = route.points.map((p) => p.lon);

  const boundingBox: GarminBoundingBox = {
    lowerLeft: {
      latitude: Math.min(...lats),
      longitude: Math.min(...lons),
    },
    upperRight: {
      latitude: Math.max(...lats),
      longitude: Math.max(...lons),
    },
    lowerLeftLatIsSet: true,
    lowerLeftLongIsSet: true,
    upperRightLatIsSet: true,
    upperRightLongIsSet: true,
  };

  // Create course lines (single segment for now)
  const courseLines: GarminCourseLine[] = [
    {
      points: null,
      distanceInMeters: cumulativeDistance,
      courseId: null,
      sortOrder: 1,
      numberOfPoints: route.points.length,
      bearing: 0,
      coordinateSystem: 'WGS84',
    },
  ];

  // Convert waypoints to course points
  const coursePoints: GarminCoursePoint[] = route.waypoints.map((wp) => ({
    name: wp.name,
    type: 5, // Generic waypoint type
    latitude: wp.lat,
    longitude: wp.lon,
  }));

  // Get start point
  const firstPoint = route.points[0];
  const startPoint: GarminGeoPoint = {
    longitude: firstPoint.lon,
    latitude: firstPoint.lat,
    timestamp: null,
    elevation: firstPoint.ele ?? 0,
    distance: 0,
  };

  // Build the Garmin Course object
  const course: GarminCourse = {
    activityTypePk: getActivityTypePk(activityType),
    hasTurnDetectionDisabled: false,
    geoPoints,
    courseLines,
    boundingBox,
    coursePoints,
    distanceMeter: cumulativeDistance,
    elevationGainMeter: parseFloat(elevationGain.toFixed(2)),
    elevationLossMeter: parseFloat(elevationLoss.toFixed(2)),
    startPoint,
    elapsedSeconds: null,
    openStreetMap: false,
    coordinateSystem: 'WGS84',
    rulePK: 2,
    courseName: route.name,
    matchedToSegments: false,
    includeLaps: false,
    hasPaceBand: false,
    hasPowerGuide: false,
    favorite: false,
    speedMeterPerSecond: null,
    sourceTypeId: 3,
  };

  return course;
}
