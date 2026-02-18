// Background service worker - main orchestrator

import { login, logout, checkAuth, getCsrfToken } from './garmin-auth';
import { uploadCourse, getCourseUrl } from './garmin-api';
import { parseGpx, convertGpxToGarminCourse } from '../lib/gpx-parser';
import { stitchBrouterSegments } from '../lib/brouter-parser';
import { fetchGpxFromMapy } from '../lib/mapy-api';
import type { MapyRouteParams } from '../lib/mapy-url-parser';
import {
  getSyncHistory,
  addSyncHistoryEntry,
  getSettings,
  saveSettings,
} from '../lib/storage';
import {
  BackgroundMessage,
  BackgroundResponse,
  SyncHistoryEntry,
  type ActivityType,
} from '../shared/messages';
import { MapyGarminError, ErrorCode } from '../shared/errors';

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener(
  (
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(error => {
        console.error('Message handler error:', error);
        sendResponse({
          success: false,
          error: error instanceof MapyGarminError ? error.message : 'Unknown error',
          errorCode: error instanceof MapyGarminError ? error.code : undefined,
        });
      });

    // Return true to indicate async response
    return true;
  }
);

async function handleMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  switch (message.type) {
    case 'LOGIN':
      return handleLogin();

    case 'LOGOUT':
      return handleLogout();

    case 'CHECK_AUTH':
      return handleCheckAuth();

    case 'SYNC_ROUTE_FROM_URL':
      return handleSyncRouteFromUrl(message.routeParams, message.routeName, message.activityType);

    case 'SYNC_FOLDER_GPX':
      return handleSyncFolderGpx(message.gpxContent, message.folderName, message.activityType);

    case 'SYNC_ROUTE_GPX':
      return handleSyncRouteGpx(message.gpxContent, message.routeName, message.activityType);

    case 'SYNC_ROUTE_GEOJSON':
      return handleSyncRouteGeoJson(message.geojsonContent, message.routeName, message.activityType);

    case 'GET_SYNC_HISTORY':
      return handleGetSyncHistory();

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'SET_SETTINGS':
      return handleSetSettings(message.settings);

    case 'REFRESH_PROFILE':
      return handleRefreshProfile();

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

async function handleLogin(): Promise<BackgroundResponse> {
  try {
    await login();
    return { success: true };
  } catch (error) {
    if (error instanceof MapyGarminError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Login failed' };
  }
}

async function handleLogout(): Promise<BackgroundResponse> {
  await logout();
  return { success: true };
}

async function handleCheckAuth(): Promise<BackgroundResponse> {
  const auth = await checkAuth();
  return { success: true, data: auth };
}

async function handleSyncRouteFromUrl(
  routeParams: MapyRouteParams,
  routeName: string,
  activityType: ActivityType
): Promise<BackgroundResponse> {
  const entryId = crypto.randomUUID();
  const entry: SyncHistoryEntry = {
    id: entryId,
    routeName,
    activityType,
    syncedAt: Date.now(),
    success: false,
  };

  try {
    console.log('Starting route sync from URL parameters');

    // Step 1: Fetch GPX from Mapy.cz API
    const gpxContent = await fetchGpxFromMapy(routeParams);

    // Step 2: Parse GPX (now using xmldom, works in service worker)
    const gpxRoute = parseGpx(gpxContent);

    if (gpxRoute.points.length === 0) {
      throw new MapyGarminError('Route has no points', ErrorCode.GPX_PARSE_ERROR);
    }

    console.log(`Parsed route: ${gpxRoute.points.length} points, ${gpxRoute.totalDistance.toFixed(0)}m`);

    // Step 3: Get CSRF token
    const csrfToken = await getCsrfToken();

    // Step 4: Convert GPX to Garmin Course JSON
    const courseData = convertGpxToGarminCourse(gpxRoute, activityType);

    // Step 5: Upload to Garmin
    const { courseId } = await uploadCourse(courseData, csrfToken);

    // Success
    entry.success = true;
    entry.garminCourseId = courseId;
    await addSyncHistoryEntry(entry);

    // Notify any open tabs about success
    notifyTabs({ type: 'SYNC_STATUS', status: 'success', message: getCourseUrl(courseId) });

    console.log('Route sync completed successfully:', courseId);

    return {
      success: true,
      data: {
        courseId,
        courseUrl: getCourseUrl(courseId),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof MapyGarminError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('Route sync failed:', errorMessage);

    entry.errorMessage = errorMessage;
    await addSyncHistoryEntry(entry);

    // Notify any open tabs about failure
    notifyTabs({ type: 'SYNC_STATUS', status: 'error', message: errorMessage });

    return {
      success: false,
      error: errorMessage,
      errorCode: error instanceof MapyGarminError ? error.code : undefined,
    };
  }
}

async function handleSyncFolderGpx(
  gpxContent: string,
  folderName: string,
  activityType: ActivityType
): Promise<BackgroundResponse> {
  const entryId = crypto.randomUUID();
  const entry: SyncHistoryEntry = {
    id: entryId,
    routeName: folderName,
    activityType,
    syncedAt: Date.now(),
    success: false,
  };

  try {
    console.log('Starting folder sync from GPX content');

    // Parse GPX (handles both track points and waypoints)
    const gpxRoute = parseGpx(gpxContent);

    if (gpxRoute.points.length === 0) {
      throw new MapyGarminError('Folder route has no points', ErrorCode.GPX_PARSE_ERROR);
    }

    console.log(
      `Parsed folder route: ${gpxRoute.points.length} points, ${gpxRoute.waypoints.length} waypoints, ${gpxRoute.totalDistance.toFixed(0)}m`
    );

    // Use folder name if GPX name is generic
    if (gpxRoute.name === 'Unnamed Route') {
      gpxRoute.name = folderName;
    }

    // Get CSRF token
    const csrfToken = await getCsrfToken();

    // Convert to Garmin Course (includes course points from waypoints)
    const courseData = convertGpxToGarminCourse(gpxRoute, activityType);

    // Upload to Garmin
    const { courseId } = await uploadCourse(courseData, csrfToken);

    // Success
    entry.success = true;
    entry.garminCourseId = courseId;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'success', message: getCourseUrl(courseId) });

    console.log('Folder sync completed successfully:', courseId);

    return {
      success: true,
      data: {
        courseId,
        courseUrl: getCourseUrl(courseId),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof MapyGarminError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('Folder sync failed:', errorMessage);

    entry.errorMessage = errorMessage;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'error', message: errorMessage });

    return {
      success: false,
      error: errorMessage,
      errorCode: error instanceof MapyGarminError ? error.code : undefined,
    };
  }
}

async function handleSyncRouteGpx(
  gpxContent: string,
  routeName: string,
  activityType: ActivityType
): Promise<BackgroundResponse> {
  const entryId = crypto.randomUUID();
  const entry: SyncHistoryEntry = {
    id: entryId,
    routeName,
    activityType,
    syncedAt: Date.now(),
    success: false,
  };

  try {
    console.log('Starting route sync from intercepted GPX content');

    // Parse GPX
    const gpxRoute = parseGpx(gpxContent);

    if (gpxRoute.points.length === 0) {
      throw new MapyGarminError('Route has no points', ErrorCode.GPX_PARSE_ERROR);
    }

    console.log(`Parsed route: ${gpxRoute.points.length} points, ${gpxRoute.totalDistance.toFixed(0)}m`);

    // Override generic GPX name with the route name extracted from the page
    if (gpxRoute.name === 'Unnamed Route') {
      gpxRoute.name = routeName;
    }

    // Get CSRF token
    const csrfToken = await getCsrfToken();

    // Convert to Garmin Course
    const courseData = convertGpxToGarminCourse(gpxRoute, activityType);

    // Upload to Garmin
    const { courseId } = await uploadCourse(courseData, csrfToken);

    // Success
    entry.success = true;
    entry.garminCourseId = courseId;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'success', message: getCourseUrl(courseId) });

    console.log('Route sync from GPX completed successfully:', courseId);

    return {
      success: true,
      data: {
        courseId,
        courseUrl: getCourseUrl(courseId),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof MapyGarminError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('Route sync from GPX failed:', errorMessage);

    entry.errorMessage = errorMessage;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'error', message: errorMessage });

    return {
      success: false,
      error: errorMessage,
      errorCode: error instanceof MapyGarminError ? error.code : undefined,
    };
  }
}

async function handleSyncRouteGeoJson(
  geojsonContent: string,
  routeName: string,
  activityType: ActivityType
): Promise<BackgroundResponse> {
  const entryId = crypto.randomUUID();
  const entry: SyncHistoryEntry = {
    id: entryId,
    routeName,
    activityType,
    syncedAt: Date.now(),
    success: false,
  };

  try {
    console.log('Starting route sync from BRouter GeoJSON');

    // Parse GeoJSON segments (content is a JSON array of segment GeoJSON strings)
    let segmentStrings: string[];
    try {
      segmentStrings = JSON.parse(geojsonContent) as string[];
    } catch {
      throw new MapyGarminError('Invalid GeoJSON segments data', ErrorCode.GEOJSON_PARSE_ERROR);
    }

    const gpxRoute = stitchBrouterSegments(segmentStrings, routeName);

    if (gpxRoute.points.length === 0) {
      throw new MapyGarminError('Route has no points', ErrorCode.GEOJSON_PARSE_ERROR);
    }

    console.log(`Parsed BRouter route: ${gpxRoute.points.length} points, ${gpxRoute.totalDistance.toFixed(0)}m`);

    // Get CSRF token
    const csrfToken = await getCsrfToken();

    // Convert to Garmin Course
    const courseData = convertGpxToGarminCourse(gpxRoute, activityType);

    // Upload to Garmin
    const { courseId } = await uploadCourse(courseData, csrfToken);

    entry.success = true;
    entry.garminCourseId = courseId;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'success', message: getCourseUrl(courseId) });

    console.log('BRouter route sync completed successfully:', courseId);

    return {
      success: true,
      data: {
        courseId,
        courseUrl: getCourseUrl(courseId),
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof MapyGarminError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Unknown error';

    console.error('BRouter route sync failed:', errorMessage);

    entry.errorMessage = errorMessage;
    await addSyncHistoryEntry(entry);

    notifyTabs({ type: 'SYNC_STATUS', status: 'error', message: errorMessage });

    return {
      success: false,
      error: errorMessage,
      errorCode: error instanceof MapyGarminError ? error.code : undefined,
    };
  }
}

async function handleRefreshProfile(): Promise<BackgroundResponse> {
  try {
    await getCsrfToken(); // Fetches connect.garmin.com/modern, extracts and saves profile
    const auth = await checkAuth();
    return { success: true, data: auth };
  } catch (error) {
    // Profile refresh failure is non-fatal - return current auth state
    const auth = await checkAuth();
    return { success: true, data: auth };
  }
}

async function handleGetSyncHistory(): Promise<BackgroundResponse> {
  const history = await getSyncHistory();
  return { success: true, data: history };
}

async function handleGetSettings(): Promise<BackgroundResponse> {
  const settings = await getSettings();
  return { success: true, data: settings };
}

async function handleSetSettings(
  settings: Partial<Parameters<typeof saveSettings>[0]>
): Promise<BackgroundResponse> {
  await saveSettings(settings);
  return { success: true };
}

// Notify all mapy.cz and bikerouter.de tabs about sync status
function notifyTabs(message: { type: string; status: string; message?: string }) {
  chrome.tabs.query({ url: ['https://mapy.cz/*', 'https://en.mapy.cz/*', 'https://mapy.com/*', 'https://bikerouter.de/*'] }, tabs => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded
        });
      }
    }
  });
}

// Log when service worker starts
console.log('Mapy.cz → Garmin Sync service worker started');
