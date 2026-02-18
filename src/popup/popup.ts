// Popup UI logic

import './popup.css';
import {
  BackgroundMessage,
  BackgroundResponse,
  ExtensionSettings,
  SyncHistoryEntry,
  AuthStatus,
} from '../shared/messages';
import { validateImageUrl, validateUrl } from '../shared/security';

// DOM Elements
const loginView = document.getElementById('login-view')!;
const mainView = document.getElementById('main-view')!;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginError = document.getElementById('login-error')!;
const userName = document.getElementById('user-name')!;
const userAvatarImg = document.getElementById('user-avatar-img') as HTMLImageElement;
const userAvatarFallback = document.getElementById('user-avatar-fallback')!;
const logoutBtn = document.getElementById('logout-btn')!;
const syncHistoryContainer = document.getElementById('sync-history')!;
const routeStatus = document.getElementById('route-status')!;
const syncControls = document.getElementById('sync-controls')!;
const syncRouteBtn = document.getElementById('sync-route-btn') as HTMLButtonElement;
const syncActivityType = document.getElementById('sync-activity-type') as HTMLSelectElement;
const folderSyncControls = document.getElementById('folder-sync-controls')!;
const syncFolderBtn = document.getElementById('sync-folder-btn') as HTMLButtonElement;
const folderActivityType = document.getElementById('folder-activity-type') as HTMLSelectElement;
const folderWaypointWarning = document.getElementById('folder-waypoint-warning')!;
const syncResult = document.getElementById('sync-result')!;
const routeNameInput = document.getElementById('route-name-input') as HTMLInputElement;
const routeNameLabel = document.getElementById('route-name-label')!;

// Tracks the auto-detected name so we know if the user actually changed it
let detectedName: string | null = null;

// Initialize popup
async function init(): Promise<void> {
  // Set version from manifest
  const versionEl = document.getElementById('version');
  if (versionEl) {
    versionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  }

  // Check authentication status
  const authStatus = await checkAuth();

  if (authStatus.isAuthenticated) {
    showMainView(authStatus);
    await loadSettings();
    await loadSyncHistory();
    await checkCurrentRoute();

    // If profile data is missing (e.g. after extension re-add), fetch it in background
    if (!authStatus.displayName) {
      refreshProfile(); // non-blocking, updates UI when done
    }
  } else {
    showLoginView();
  }

  // Set up event listeners
  setupEventListeners();
}

function setupEventListeners(): void {
  // Login button
  loginBtn.addEventListener('click', handleLogin);

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);

  // Sync button
  syncRouteBtn.addEventListener('click', handleSyncRoute);

  // Sync folder button
  syncFolderBtn.addEventListener('click', handleSyncFolder);

}

function showLoginView(): void {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  loginError.classList.add('hidden');
}

function showMainView(auth: AuthStatus): void {
  console.log('[Popup] showMainView called with auth:', {
    username: auth.username,
    displayName: auth.displayName,
    hasProfileImageUrl: !!auth.profileImageUrl,
    profileImageUrl: auth.profileImageUrl
  });

  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  userName.textContent = auth.displayName || auth.username || 'Connected';

  // Handle avatar display
  if (auth.profileImageUrl) {
    console.log('[Popup] Setting avatar image');
    try {
      // Validate URL to prevent XSS via javascript: or data: URIs
      const safeUrl = validateImageUrl(auth.profileImageUrl, ['garmin.com', 'amazonaws.com']);
      userAvatarImg.src = safeUrl;
      userAvatarImg.classList.remove('hidden');
      userAvatarFallback.classList.add('hidden');

      userAvatarImg.onerror = () => {
        console.log('[Popup] Avatar image failed to load, showing fallback');
        userAvatarImg.classList.add('hidden');
        userAvatarFallback.classList.remove('hidden');
      };
    } catch (error) {
      console.warn('[Popup] Invalid profile image URL, using fallback');
      userAvatarImg.classList.add('hidden');
      userAvatarFallback.classList.remove('hidden');
    }
  } else {
    console.log('[Popup] No profile image URL, showing SVG fallback');
    userAvatarImg.classList.add('hidden');
    userAvatarFallback.classList.remove('hidden');
  }
}

async function handleLogin(): Promise<void> {
  // Show loading state
  loginBtn.disabled = true;
  loginBtn.textContent = 'Opening Garmin Connect...';
  loginError.classList.add('hidden');

  try {
    const response = await sendMessage({
      type: 'LOGIN',
    });

    if (response.success) {
      // Show main view
      const authStatus = await checkAuth();
      showMainView(authStatus);
      await loadSettings();
      await loadSyncHistory();
    } else {
      showError(response.error || 'Login failed');
    }
  } catch (error) {
    showError('An error occurred during login');
    console.error('Login error:', error);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in with Garmin';
  }
}

async function handleLogout(): Promise<void> {
  await sendMessage({ type: 'LOGOUT' });
  showLoginView();
}

function showError(message: string): void {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

async function checkAuth(): Promise<AuthStatus> {
  const response = await sendMessage({ type: 'CHECK_AUTH' });
  return (response.data as AuthStatus) || { isAuthenticated: false };
}

async function refreshProfile(): Promise<void> {
  try {
    const response = await sendMessage({ type: 'REFRESH_PROFILE' });
    if (response.success && response.data) {
      showMainView(response.data as AuthStatus);
    }
  } catch (error) {
    // Silently fail - "Garmin User" stays if profile can't be fetched
  }
}

async function loadSettings(): Promise<void> {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  if (response.success && response.data) {
    const settings = response.data as ExtensionSettings;
    syncActivityType.value = settings.defaultActivityType;
    folderActivityType.value = settings.defaultActivityType;
  }
}

async function loadSyncHistory(): Promise<void> {
  const response = await sendMessage({ type: 'GET_SYNC_HISTORY' });

  if (response.success && response.data) {
    const history = response.data as SyncHistoryEntry[];
    renderSyncHistory(history);
  }
}

function renderSyncHistory(history: SyncHistoryEntry[]): void {
  syncHistoryContainer.textContent = '';

  if (history.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'history-empty';
    emptyDiv.textContent = 'No routes synced yet';
    syncHistoryContainer.appendChild(emptyDiv);
    return;
  }

  // Show only last 5 entries
  const recentHistory = history.slice(0, 5);

  for (const entry of recentHistory) {
    const date = new Date(entry.syncedAt);
    const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const item = document.createElement('div');
    item.className = 'history-item';

    // Status icon built with DOM APIs (no innerHTML)
    const statusDiv = document.createElement('div');
    statusDiv.className = `history-status ${entry.success ? 'success' : 'error'}`;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('fill', 'currentColor');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', entry.success
      ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
      : 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
    );
    svg.appendChild(path);
    statusDiv.appendChild(svg);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'history-content';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'history-name';
    nameDiv.textContent = entry.routeName;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'history-meta';

    const typeSpan = document.createElement('span');
    typeSpan.className = 'history-type';
    typeSpan.textContent = entry.activityType;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = timeStr;

    metaDiv.appendChild(typeSpan);
    metaDiv.appendChild(timeSpan);
    contentDiv.appendChild(nameDiv);
    contentDiv.appendChild(metaDiv);
    item.appendChild(statusDiv);
    item.appendChild(contentDiv);

    if (entry.garminCourseId) {
      const link = document.createElement('a');
      link.href = `https://connect.garmin.com/modern/course/${entry.garminCourseId}`;
      link.target = '_blank';
      link.className = 'history-link';
      link.textContent = 'View';
      item.appendChild(link);
    }

    syncHistoryContainer.appendChild(item);
  }
}


async function checkCurrentRoute(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showNoRouteStatus();
      return;
    }

    // Check if tab is on a supported site
    const url = tab.url || '';
    const isMapy = url.includes('mapy.cz') || url.includes('mapy.com');
    const isBikeRouter = url.includes('bikerouter.de');

    if (!isMapy && !isBikeRouter) {
      showNoRouteStatus();
      return;
    }

    if (isBikeRouter) {
      // bikerouter.de: only route sync (no folder)
      const routeResponse = await sendMessageToTab(tab.id, { type: 'CHECK_ROUTE' }).catch(() => null);
      if (routeResponse?.hasRoute) {
        showRouteFound(routeResponse.routeName || 'BRouter Route');
      } else {
        showNoRouteStatus();
      }
      return;
    }

    // Check for folder first, then route (mapy.cz)
    const [folderResponse, routeResponse] = await Promise.all([
      sendMessageToTab(tab.id, { type: 'CHECK_FOLDER' }).catch(() => null),
      sendMessageToTab(tab.id, { type: 'CHECK_ROUTE' }).catch(() => null),
    ]);

    console.log('[Routomil] checkCurrentRoute: folderResponse =', folderResponse, 'routeResponse =', routeResponse);

    if (folderResponse?.hasFolder) {
      showFolderFound(folderResponse.folderName || 'Mapy.cz Folder');
    } else if (routeResponse?.hasRoute) {
      showRouteFound(routeResponse.routeName || 'Current route');
    } else {
      showNoRouteStatus();
    }
  } catch (error) {
    console.error('Error checking route:', error);
    showNoRouteStatus();
  }
}

function showRouteFound(routeName: string): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = '';
  statusMessage.className = 'status-message route-found hidden';
  routeNameLabel.textContent = 'Route found';
  routeNameLabel.classList.remove('hidden');
  detectedName = routeName;
  routeNameInput.value = routeName;
  routeNameInput.classList.remove('hidden');
  syncControls.classList.remove('hidden');
  folderSyncControls.classList.add('hidden');
  syncResult.classList.add('hidden');
}

function showFolderFound(folderName: string): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = '';
  statusMessage.className = 'status-message route-found hidden';
  routeNameLabel.textContent = 'Folder found';
  routeNameLabel.classList.remove('hidden');
  detectedName = folderName;
  routeNameInput.value = folderName;
  routeNameInput.classList.remove('hidden');
  syncControls.classList.add('hidden');
  folderSyncControls.classList.remove('hidden');
  syncResult.classList.add('hidden');
}

function showNoRouteStatus(): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = 'Open a route or folder on mapy.cz or bikerouter.de';
  statusMessage.className = 'status-message no-route';
  detectedName = null;
  routeNameLabel.classList.add('hidden');
  routeNameInput.classList.add('hidden');
  syncControls.classList.add('hidden');
  folderSyncControls.classList.add('hidden');
  syncResult.classList.add('hidden');
}

async function handleSyncRoute(): Promise<void> {
  syncRouteBtn.disabled = true;
  syncRouteBtn.classList.add('syncing');
  syncResult.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    // Get activity type
    const activityType = syncActivityType.value as 'cycling' | 'hiking';

    // Always send the name shown in the input — what the user sees is what Garmin gets
    const routeName = routeNameInput.value.trim() || undefined;

    // Ask content script to extract and sync the route
    const response = await sendMessageToTab(tab.id, {
      type: 'EXTRACT_AND_SYNC',
      activityType,
      routeName,
    });

    if (response?.success) {
      showSyncSuccess(response.courseUrl);
      await loadSyncHistory();
    } else if (response?.errorCode === 'AUTH_SESSION_EXPIRED') {
      await handleLogout();
      await handleLogin();
    } else {
      showSyncError(response?.error || 'Failed to sync route');
    }
  } catch (error) {
    console.error('Sync error:', error);
    showSyncError(error instanceof Error ? error.message : 'An error occurred');
  } finally {
    syncRouteBtn.disabled = false;
    syncRouteBtn.classList.remove('syncing');
  }
}

async function handleSyncFolder(): Promise<void> {
  syncFolderBtn.disabled = true;
  syncFolderBtn.classList.add('syncing');
  syncResult.classList.add('hidden');
  folderWaypointWarning.classList.add('hidden');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      throw new Error('No active tab found');
    }

    const activityType = folderActivityType.value as 'cycling' | 'hiking';

    // Always send the name shown in the input — what the user sees is what Garmin gets
    const folderName = routeNameInput.value.trim() || undefined;

    const response = await sendMessageToTab(tab.id, {
      type: 'EXTRACT_AND_SYNC_FOLDER',
      activityType,
      folderName,
    });

    if (response?.success) {
      // Show waypoint warning if >200 waypoints
      if (response.waypointCount && response.waypointCount > 200) {
        folderWaypointWarning.textContent = `Note: This folder has ${response.waypointCount} waypoints. Some older Garmin devices only support up to 200 course points.`;
        folderWaypointWarning.classList.remove('hidden');
      }
      showSyncSuccess(response.courseUrl);
      await loadSyncHistory();
    } else if (response?.errorCode === 'AUTH_SESSION_EXPIRED') {
      await handleLogout();
      await handleLogin();
    } else {
      showSyncError(response?.error || 'Failed to sync folder');
    }
  } catch (error) {
    console.error('Folder sync error:', error);
    showSyncError(error instanceof Error ? error.message : 'An error occurred');
  } finally {
    syncFolderBtn.disabled = false;
    syncFolderBtn.classList.remove('syncing');
  }
}

function showSyncSuccess(courseUrl?: string): void {
  syncResult.className = 'sync-result success';
  syncResult.textContent = '';
  if (courseUrl) {
    try {
      const safeUrl = validateUrl(courseUrl, ['garmin.com']);
      syncResult.appendChild(document.createTextNode('Route synced! '));
      const link = document.createElement('a');
      link.href = safeUrl;
      link.target = '_blank';
      link.textContent = 'View in Garmin Connect';
      syncResult.appendChild(link);
    } catch {
      syncResult.textContent = 'Route synced successfully!';
    }
  } else {
    syncResult.textContent = 'Route synced successfully!';
  }
  syncResult.classList.remove('hidden');
}

function showSyncError(message: string): void {
  syncResult.className = 'sync-result error';
  syncResult.textContent = `Error: ${message}`;
  syncResult.classList.remove('hidden');
}

function sendMessageToTab(tabId: number, message: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function sendMessage(message: BackgroundMessage): Promise<BackgroundResponse> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response || { success: false, error: 'No response' });
      }
    });
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
