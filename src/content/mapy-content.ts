// Main content script for mapy.cz

import './mapy-content.css';
import { extractRouteName } from './route-extractor';
import { parseMapyUrl, hasRouteParams } from '../lib/mapy-url-parser';
import { ActivityType, BackgroundResponse } from '../shared/messages';

// Initialize when DOM is ready
function initialize(): void {
  console.log('Mapy.cz → Garmin Sync: Content script loaded');
}

async function handleSyncFromPopup(activityType: ActivityType): Promise<{ success: boolean; error?: string; courseUrl?: string }> {
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
    if (routeParams.rg.length === 0) {
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
      return { success: false, error: syncResponse.error || 'Sync failed' };
    }
  } catch (error) {
    console.error('Mapy.cz → Garmin Sync: Error during sync', error);
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
  } else if (message.type === 'EXTRACT_AND_SYNC') {
    // Extract and sync the route
    const activityType = message.activityType || 'cycling';
    handleSyncFromPopup(activityType).then(result => {
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
