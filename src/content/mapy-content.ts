// Main content script for mapy.cz

import './mapy-content.css';
import { extractRouteName } from './route-extractor';
import { detectFolder } from './folder-detector';
import { fetchGpxFromFolder, validateFolderGpx } from '../lib/mapy-folder-api';
import { parseMapyUrl, hasRouteParams } from '../lib/mapy-url-parser';
import { ActivityType, BackgroundResponse } from '../shared/messages';

const ROUTOMIL_SOURCE = 'routomil-extension';
const ALLOWED_MAPY_ORIGINS = ['https://mapy.cz', 'https://en.mapy.cz', 'https://mapy.com'];

// Initialize when DOM is ready
function initialize(): void {
  console.log('Mapy.cz → Garmin Sync: Content script loaded');
}

async function handleSyncFromPopup(activityType: ActivityType): Promise<{ success: boolean; error?: string; errorCode?: string; courseUrl?: string }> {
  console.log('Mapy.cz → Garmin Sync: Starting sync from popup as', activityType);

  try {
    // Check if user is authenticated
    const authResponse = await sendMessage({ type: 'CHECK_AUTH' });
    if (!authResponse.success || !(authResponse.data as { isAuthenticated: boolean })?.isAuthenticated) {
      return { success: false, error: 'Please log in to Garmin Connect in the extension popup' };
    }

    // Parse route parameters from current URL
    const currentUrl = window.location.href;
    if (!hasRouteParams(currentUrl)) {
      return { success: false, error: 'No route found in current URL. Please plan a route first.' };
    }

    const routeParams = parseMapyUrl(currentUrl);
    if (!routeParams.rc && routeParams.rg.length === 0) {
      return { success: false, error: 'Could not extract route coordinates from URL' };
    }

    // Extract route name from page
    const routeName = extractRouteName() || 'Mapy.cz Route';

    console.log(`Parsed route with ${routeParams.rg.length} coordinate chunks`);

    // Send route parameters to background for API fetch and upload
    const syncResponse = await sendMessage({
      type: 'SYNC_ROUTE_FROM_URL',
      routeParams,
      routeName,
      activityType,
    });

    if (syncResponse.success) {
      const data = syncResponse.data as { courseUrl?: string };
      return { success: true, courseUrl: data?.courseUrl };
    } else {
      return { success: false, error: syncResponse.error || 'Sync failed', errorCode: syncResponse.errorCode };
    }
  } catch (error) {
    console.error('Mapy.cz → Garmin Sync: Error during sync', error);
    return { success: false, error: error instanceof Error ? error.message : 'An error occurred during sync' };
  }
}

async function handleSyncFolderFromPopup(activityType: ActivityType): Promise<{ success: boolean; error?: string; errorCode?: string; courseUrl?: string; waypointCount?: number }> {
  console.log('Mapy.cz → Garmin Sync: Starting folder sync from popup as', activityType);

  try {
    // Check if user is authenticated
    const authResponse = await sendMessage({ type: 'CHECK_AUTH' });
    if (!authResponse.success || !(authResponse.data as { isAuthenticated: boolean })?.isAuthenticated) {
      return { success: false, error: 'Please log in to Garmin Connect in the extension popup' };
    }

    const currentUrl = window.location.href;
    const folderInfo = detectFolder(currentUrl);
    if (!folderInfo) {
      return { success: false, error: 'No folder found on current page. Open a Mapy.cz folder page first.' };
    }

    const { folderId, folderName } = folderInfo;
    console.log(`Fetching folder ${folderId} from Mapy.cz`);

    // Fetch GPX from folder API (content script has auth cookies)
    const gpxContent = await fetchGpxFromFolder(folderId);

    // Validate GPX (single route, not empty)
    const gpxInfo = validateFolderGpx(gpxContent);

    console.log(`Folder GPX: ${gpxInfo.waypointCount} waypoints`);

    // Send GPX to service worker for parsing and upload
    const syncResponse = await sendMessage({
      type: 'SYNC_FOLDER_GPX',
      gpxContent,
      folderName: folderName || 'Mapy.cz Folder',
      activityType,
    });

    if (syncResponse.success) {
      const data = syncResponse.data as { courseUrl?: string };
      return { success: true, courseUrl: data?.courseUrl, waypointCount: gpxInfo.waypointCount };
    } else {
      return { success: false, error: syncResponse.error || 'Folder sync failed', errorCode: syncResponse.errorCode };
    }
  } catch (error) {
    console.error('Mapy.cz → Garmin Sync: Error during folder sync', error);
    return { success: false, error: error instanceof Error ? error.message : 'An error occurred during folder sync' };
  }
}

/**
 * Promise-based postMessage exchange with the MAIN world fetch interceptor.
 * Sends ROUTOMIL_REQUEST_EXPORT and waits for ROUTOMIL_GPX_INTERCEPTED.
 */
function requestInterceptedGpx(): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('GPX interception timed out after 15 seconds'));
    }, 15000);

    function handler(event: MessageEvent): void {
      if (!ALLOWED_MAPY_ORIGINS.includes(event.origin)) return;
      if (event.data?.source !== ROUTOMIL_SOURCE) return;
      if (event.data?.type !== 'ROUTOMIL_GPX_INTERCEPTED') return;

      clearTimeout(timeoutId);
      window.removeEventListener('message', handler);

      if (event.data.error) {
        reject(new Error(event.data.error as string));
      } else if (typeof event.data.gpx === 'string') {
        resolve(event.data.gpx as string);
      } else {
        reject(new Error('Invalid GPX interception response'));
      }
    }

    window.addEventListener('message', handler);

    // Trigger the export in MAIN world
    window.postMessage({ type: 'ROUTOMIL_REQUEST_EXPORT', source: ROUTOMIL_SOURCE }, '*');
  });
}

/**
 * Sync a route by intercepting Mapy.cz's own GPX export.
 * Used for routes with coordinate-type waypoints where the URL's rc is delta-encoded.
 */
async function handleSyncViaIntercept(
  activityType: ActivityType
): Promise<{ success: boolean; error?: string; errorCode?: string; courseUrl?: string }> {
  console.log('Mapy.cz → Garmin Sync: Starting sync via GPX interception as', activityType);

  try {
    // Check authentication
    const authResponse = await sendMessage({ type: 'CHECK_AUTH' });
    if (!authResponse.success || !(authResponse.data as { isAuthenticated: boolean })?.isAuthenticated) {
      return { success: false, error: 'Please log in to Garmin Connect in the extension popup' };
    }

    const routeName = extractRouteName() || 'Mapy.cz Route';

    // Request GPX via MAIN world interceptor
    let gpxContent: string;
    try {
      gpxContent = await requestInterceptedGpx();
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to intercept GPX export',
      };
    }

    // Basic GPX validation
    if (!gpxContent.includes('<gpx')) {
      return { success: false, error: 'Intercepted content is not valid GPX' };
    }

    // Send GPX to service worker for parsing and upload
    const syncResponse = await sendMessage({
      type: 'SYNC_ROUTE_GPX',
      gpxContent,
      routeName,
      activityType,
    });

    if (syncResponse.success) {
      const data = syncResponse.data as { courseUrl?: string };
      return { success: true, courseUrl: data?.courseUrl };
    } else {
      return { success: false, error: syncResponse.error || 'Sync failed', errorCode: syncResponse.errorCode };
    }
  } catch (error) {
    console.error('Mapy.cz → Garmin Sync: Error during interception sync', error);
    return { success: false, error: error instanceof Error ? error.message : 'An error occurred during sync' };
  }
}

function sendMessage(message: unknown): Promise<BackgroundResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message: { type: string; activityType?: ActivityType }, _sender, sendResponse) => {
  if (message.type === 'CHECK_ROUTE') {
    // Check if there's a route in the URL
    const currentUrl = window.location.href;
    const routeExists = hasRouteParams(currentUrl);
    const routeName = routeExists ? extractRouteName() : null;
    sendResponse({
      hasRoute: routeExists,
      routeName: routeName
    });
    return true;
  } else if (message.type === 'CHECK_FOLDER') {
    // Check if this is a folder page
    const currentUrl = window.location.href;
    const folderInfo = detectFolder(currentUrl);
    sendResponse({
      hasFolder: folderInfo !== null,
      folderId: folderInfo?.folderId || null,
      folderName: folderInfo?.folderName || null,
    });
    return true;
  } else if (message.type === 'EXTRACT_AND_SYNC') {
    // Always use the SMap decode path: SMap.Coords.stringToCoords handles both absolute
    // and delta-encoded rc correctly for all route types (named, coordinate, or mixed).
    const activityType = message.activityType || 'cycling';
    handleSyncViaIntercept(activityType).then(result => { sendResponse(result); });
    return true;
  } else if (message.type === 'EXTRACT_AND_SYNC_FOLDER') {
    // Extract and sync the folder
    const activityType = message.activityType || 'cycling';
    handleSyncFolderFromPopup(activityType).then(result => {
      sendResponse(result);
    });
    return true;
  }
});

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
