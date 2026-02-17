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
  if (history.length === 0) {
    // lgtm[js/dom-xss] - Static text, no user-controlled data
    syncHistoryContainer.innerHTML = '<div class="history-empty">No routes synced yet</div>';
    return;
  }

  // Show only last 5 entries
  const recentHistory = history.slice(0, 5);

  // lgtm[js/dom-xss] - HTML structure with properly escaped user data (escapeHtml on line 207), static SVG icons, hardcoded Garmin URLs
  syncHistoryContainer.innerHTML = recentHistory
    .map(entry => {
      const date = new Date(entry.syncedAt);
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const statusClass = entry.success ? 'success' : 'error';
      const statusIcon = entry.success
        ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

      const link = entry.garminCourseId
        ? `<a href="https://connect.garmin.com/modern/course/${entry.garminCourseId}" target="_blank" class="history-link">View</a>`
        : '';

      return `
        <div class="history-item">
          <div class="history-status ${statusClass}">${statusIcon}</div>
          <div class="history-content">
            <div class="history-name">${escapeHtml(entry.routeName)}</div>
            <div class="history-meta">
              <span class="history-type">${entry.activityType}</span>
              <span class="history-time">${timeStr}</span>
            </div>
          </div>
          ${link}
        </div>
      `;
    })
    .join('');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function checkCurrentRoute(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      showNoRouteStatus();
      return;
    }

    // Check if tab is on mapy.cz
    const url = tab.url || '';
    if (!url.includes('mapy.cz') && !url.includes('mapy.com')) {
      showNoRouteStatus();
      return;
    }

    // Check for folder first, then route
    const [folderResponse, routeResponse] = await Promise.all([
      sendMessageToTab(tab.id, { type: 'CHECK_FOLDER' }).catch(() => null),
      sendMessageToTab(tab.id, { type: 'CHECK_ROUTE' }).catch(() => null),
    ]);

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
  statusMessage.textContent = `Route found: ${routeName}`;
  statusMessage.className = 'status-message route-found';
  syncControls.classList.remove('hidden');
  folderSyncControls.classList.add('hidden');
  syncResult.classList.add('hidden');
}

function showFolderFound(folderName: string): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = `Folder found: ${folderName}`;
  statusMessage.className = 'status-message route-found';
  syncControls.classList.add('hidden');
  folderSyncControls.classList.remove('hidden');
  syncResult.classList.add('hidden');
}

function showNoRouteStatus(): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = 'Open a route or folder on mapy.cz';
  statusMessage.className = 'status-message no-route';
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

    // Ask content script to extract and sync the route
    const response = await sendMessageToTab(tab.id, {
      type: 'EXTRACT_AND_SYNC',
      activityType
    });

    if (response?.success) {
      showSyncSuccess(response.courseUrl);
      await loadSyncHistory();
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

    const response = await sendMessageToTab(tab.id, {
      type: 'EXTRACT_AND_SYNC_FOLDER',
      activityType,
    });

    if (response?.success) {
      // Show waypoint warning if >200 waypoints
      if (response.waypointCount && response.waypointCount > 200) {
        folderWaypointWarning.textContent = `Note: This folder has ${response.waypointCount} waypoints. Some older Garmin devices only support up to 200 course points.`;
        folderWaypointWarning.classList.remove('hidden');
      }
      showSyncSuccess(response.courseUrl);
      await loadSyncHistory();
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
  if (courseUrl) {
    try {
      const safeUrl = validateUrl(courseUrl, ['garmin.com']);
      // lgtm[js/dom-xss] - Static text with validated URL from Garmin API
      syncResult.innerHTML = `Route synced! <a href="${safeUrl}" target="_blank">View in Garmin Connect</a>`;
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
