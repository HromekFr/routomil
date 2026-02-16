// Background service worker - main orchestrator

import { login, logout, checkAuth, getCsrfToken } from './garmin-auth';
import { uploadCourse, getCourseUrl } from './garmin-api';
import { convertGpxToGarminCourse } from '../lib/gpx-parser';
import {
  getSyncHistory,
  addSyncHistoryEntry,
  getSettings,
  saveSettings,
} from '../lib/storage';
import {
  BackgroundMessage,
  BackgroundResponse,
  RouteData,
  SyncHistoryEntry,
} from '../shared/messages';
import { MapyGarminError, ErrorCode, getErrorMessage } from '../shared/errors';

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

    case 'SYNC_ROUTE':
      return handleSyncRoute(message.route);

    case 'GET_SYNC_HISTORY':
      return handleGetSyncHistory();

    case 'GET_SETTINGS':
      return handleGetSettings();

    case 'SET_SETTINGS':
      return handleSetSettings(message.settings);

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

async function handleSyncRoute(route: RouteData): Promise<BackgroundResponse> {
  const entryId = crypto.randomUUID();
  const entry: SyncHistoryEntry = {
    id: entryId,
    routeName: route.name,
    activityType: route.activityType,
    syncedAt: Date.now(),
    success: false,
  };

  try {
    // Get parsed route from content script
    if (!route.parsedRoute) {
      throw new MapyGarminError('No parsed route data provided', ErrorCode.GPX_PARSE_ERROR);
    }

    const gpxRoute = route.parsedRoute;

    if (gpxRoute.points.length === 0) {
      throw new MapyGarminError('Route has no points', ErrorCode.GPX_PARSE_ERROR);
    }

    // Step 1: Get CSRF token
    const csrfToken = await getCsrfToken();

    // Step 2: Convert GPX to Garmin Course JSON
    const courseData = convertGpxToGarminCourse(gpxRoute, route.activityType);

    // Step 3: Upload to Garmin
    const { courseId } = await uploadCourse(courseData, csrfToken);

    // Success
    entry.success = true;
    entry.garminCourseId = courseId;
    await addSyncHistoryEntry(entry);

    // Notify any open tabs about success
    notifyTabs({ type: 'SYNC_STATUS', status: 'success', message: getCourseUrl(courseId) });

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

    entry.errorMessage = errorMessage;
    await addSyncHistoryEntry(entry);

    // Notify any open tabs about failure
    notifyTabs({ type: 'SYNC_STATUS', status: 'error', message: errorMessage });

    return { success: false, error: errorMessage };
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

// Notify all mapy.cz tabs about sync status
function notifyTabs(message: { type: string; status: string; message?: string }) {
  chrome.tabs.query({ url: ['https://mapy.cz/*', 'https://en.mapy.cz/*', 'https://mapy.com/*'] }, tabs => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded
        });
      }
    }
  });
}

// Monitor GPX downloads for potential future extraction method
chrome.downloads.onCreated.addListener((downloadItem) => {
  if (downloadItem.filename?.toLowerCase().endsWith('.gpx')) {
    console.log('GPX download detected:', downloadItem.filename);
    // Cache the download ID for potential retrieval
    chrome.storage.session.set({
      lastGpxDownload: {
        id: downloadItem.id,
        filename: downloadItem.filename,
        timestamp: Date.now()
      }
    }).catch((error) => {
      console.error('Failed to cache GPX download info:', error);
    });
  }
});

// Log when service worker starts
console.log('Mapy.cz → Garmin Sync service worker started');
