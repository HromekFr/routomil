// Message types for communication between extension components

import { GpxRoute } from '../lib/gpx-parser';

export type ActivityType = 'cycling' | 'hiking';

export interface RouteData {
  name: string;
  gpxContent?: string;
  parsedRoute?: GpxRoute;
  activityType: ActivityType;
  distance?: number;
  elevation?: number;
}

export interface SyncHistoryEntry {
  id: string;
  routeName: string;
  activityType: ActivityType;
  syncedAt: number;
  garminCourseId?: string;
  success: boolean;
  errorMessage?: string;
}

// Background service worker messages
export type BackgroundMessage =
  | { type: 'LOGIN' }
  | { type: 'LOGOUT' }
  | { type: 'CHECK_AUTH' }
  | { type: 'SYNC_ROUTE'; route: RouteData }
  | { type: 'GET_SYNC_HISTORY' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<ExtensionSettings> };

export interface BackgroundResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  username?: string;
  expiresAt?: number;
}

export interface ExtensionSettings {
  defaultActivityType: ActivityType;
  autoDetectActivityType: boolean;
  showSyncNotifications: boolean;
}

// Content script messages
export type ContentMessage =
  | { type: 'ROUTE_DETECTED'; routeName: string; hasGpx: boolean }
  | { type: 'SYNC_STATUS'; status: 'syncing' | 'success' | 'error'; message?: string };

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultActivityType: 'cycling',
  autoDetectActivityType: true,
  showSyncNotifications: true,
};

// Garmin Course API types
export interface GarminGeoPoint {
  latitude: number;
  longitude: number;
  elevation: number;
  distance: number;
  timestamp: number | null;
}

export interface GarminCourseLine {
  points: null;
  distanceInMeters: number;
  courseId: null;
  sortOrder: number;
  numberOfPoints: number;
  bearing: number;
  coordinateSystem: 'WGS84';
}

export interface GarminCoursePoint {
  name: string;
  type: number;
  latitude: number;
  longitude: number;
}

export interface GarminBoundingBox {
  lowerLeft: {
    latitude: number;
    longitude: number;
  };
  upperRight: {
    latitude: number;
    longitude: number;
  };
  lowerLeftLatIsSet: boolean;
  lowerLeftLongIsSet: boolean;
  upperRightLatIsSet: boolean;
  upperRightLongIsSet: boolean;
}

export interface GarminCourse {
  activityTypePk: number;
  hasTurnDetectionDisabled: boolean;
  geoPoints: GarminGeoPoint[];
  courseLines: GarminCourseLine[];
  boundingBox: GarminBoundingBox;
  coursePoints: GarminCoursePoint[];
  distanceMeter: number;
  elevationGainMeter: number;
  elevationLossMeter: number;
  startPoint: GarminGeoPoint;
  elapsedSeconds: null;
  openStreetMap: boolean;
  coordinateSystem: 'WGS84';
  rulePK: number;
  courseName: string;
  matchedToSegments: boolean;
  includeLaps: boolean;
  hasPaceBand: boolean;
  hasPowerGuide: boolean;
  favorite: boolean;
  speedMeterPerSecond: null;
  sourceTypeId: number;
  userProfilePk?: number;
}
