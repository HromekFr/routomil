// ISOLATED content script for bikerouter.de
// Handles messages from popup and bridges to the MAIN world interceptor via postMessage.

import { ActivityType, BackgroundResponse } from '../shared/messages';

const ROUTOMIL_SOURCE = 'routomil-extension';
const BIKEROUTER_ORIGIN = 'https://bikerouter.de';

/**
 * Check if the current URL hash has at least 2 waypoints.
 */
function hasRoute(): boolean {
  const hash = window.location.hash;
  const match = hash.match(/lonlats=([^&]+)/);
  if (!match) return false;
  const waypoints = match[1].split(';').filter(Boolean);
  return waypoints.length >= 2;
}

/**
 * Count waypoints in the current URL hash.
 */
function getWaypointCount(): number {
  const hash = window.location.hash;
  const match = hash.match(/lonlats=([^&]+)/);
  if (!match) return 0;
  return match[1].split(';').filter(Boolean).length;
}

/**
 * Promise-based postMessage exchange with the MAIN world interceptor.
 * Sends a message and waits for the matching response type.
 */
function postMessageToMain<T>(
  requestType: string,
  responseType: string,
  timeoutMs = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error(`Timed out waiting for ${responseType}`));
    }, timeoutMs);

    function handler(event: MessageEvent): void {
      if (event.origin !== BIKEROUTER_ORIGIN) return;
      if (event.data?.source !== ROUTOMIL_SOURCE) return;
      if (event.data?.type !== responseType) return;

      clearTimeout(timeoutId);
      window.removeEventListener('message', handler);
      resolve(event.data as T);
    }

    window.addEventListener('message', handler);
    window.postMessage({ type: requestType, source: ROUTOMIL_SOURCE }, BIKEROUTER_ORIGIN);
  });
}

interface RouteStatusResponse {
  type: string;
  source: string;
  segmentCount: number;
  expectedSegments?: number;
  ready: boolean;
}

interface RouteReadyResponse {
  type: string;
  source: string;
  geojsonContent?: string;
  routeName?: string;
  error?: string;
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

async function handleExtractAndSync(
  activityType: ActivityType,
  nameOverride?: string
): Promise<{ success: boolean; error?: string; errorCode?: string; courseUrl?: string }> {
  try {
    // Check authentication
    const authResponse = await sendMessage({ type: 'CHECK_AUTH' });
    if (!authResponse.success || !(authResponse.data as { isAuthenticated: boolean })?.isAuthenticated) {
      return { success: false, error: 'Please log in to Garmin Connect in the extension popup' };
    }

    if (!hasRoute()) {
      return { success: false, error: 'No route found. Add at least 2 waypoints on bikerouter.de.' };
    }

    // Request stitched GeoJSON from MAIN world
    let routeData: RouteReadyResponse;
    try {
      routeData = await postMessageToMain<RouteReadyResponse>(
        'ROUTOMIL_REQUEST_BIKEROUTER_EXPORT',
        'ROUTOMIL_BIKEROUTER_ROUTE_READY',
        15000
      );
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get route data',
      };
    }

    if (routeData.error) {
      return { success: false, error: routeData.error };
    }

    if (!routeData.geojsonContent) {
      return { success: false, error: 'No GeoJSON data received from route' };
    }

    const routeName = nameOverride || routeData.routeName || 'BRouter Route';

    // Send to service worker for parsing and upload
    const syncResponse = await sendMessage({
      type: 'SYNC_ROUTE_GEOJSON',
      geojsonContent: routeData.geojsonContent,
      routeName,
      activityType,
    });

    if (syncResponse.success) {
      const data = syncResponse.data as { courseUrl?: string };
      return { success: true, courseUrl: data?.courseUrl };
    } else {
      return {
        success: false,
        error: syncResponse.error || 'Sync failed',
        errorCode: syncResponse.errorCode,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An error occurred during sync',
    };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (message: { type: string; activityType?: ActivityType; routeName?: string }, _sender, sendResponse) => {
    if (message.type === 'CHECK_ROUTE') {
      const routeExists = hasRoute();
      sendResponse({
        hasRoute: routeExists,
        routeName: routeExists ? `BRouter Route (${getWaypointCount()} waypoints)` : null,
      });
      return true;
    } else if (message.type === 'EXTRACT_AND_SYNC') {
      const activityType = message.activityType || 'cycling';
      handleExtractAndSync(activityType, message.routeName).then(result => {
        sendResponse(result);
      });
      return true;
    }
  }
);

console.log('Routomil: BRouter content script loaded');
