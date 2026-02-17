// Message types for communication between extension components

import type { MapyRouteParams } from '../lib/mapy-url-parser';

export type ActivityType = 'cycling' | 'hiking';

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
  | { type: 'SYNC_ROUTE_FROM_URL'; routeParams: MapyRouteParams; routeName: string; activityType: ActivityType }
  | { type: 'SYNC_FOLDER_GPX'; gpxContent: string; folderName: string; activityType: ActivityType }
  | { type: 'GET_SYNC_HISTORY' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; settings: Partial<ExtensionSettings> }
  | { type: 'REFRESH_PROFILE' };

export interface BackgroundResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  errorCode?: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  username?: string;
  expiresAt?: number;
  displayName?: string;
  profileImageUrl?: string;
}

export interface ExtensionSettings {
  defaultActivityType: ActivityType;
  autoDetectActivityType: boolean;
}

// Content script messages
export type ContentMessage =
  | { type: 'ROUTE_DETECTED'; routeName: string; hasGpx: boolean }
  | { type: 'SYNC_STATUS'; status: 'syncing' | 'success' | 'error'; message?: string };

// Tab messages (popup → content script)
export type TabMessage =
  | { type: 'CHECK_ROUTE' }
  | { type: 'CHECK_FOLDER' }
  | { type: 'EXTRACT_AND_SYNC'; activityType: ActivityType }
  | { type: 'EXTRACT_AND_SYNC_FOLDER'; activityType: ActivityType };

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultActivityType: 'cycling',
  autoDetectActivityType: true,
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
  coursePointType: string;   // "GENERIC", "LEFT", "RIGHT", etc.
  lat: number;               // was "latitude"
  lon: number;               // was "longitude"
  distance: number;          // metres from route start
  elevation: number;
  timestamp: null;
  coursePointId: null;
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
