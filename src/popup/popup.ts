// Popup UI logic

import './popup.css';
import {
  BackgroundMessage,
  BackgroundResponse,
  ExtensionSettings,
  SyncHistoryEntry,
  AuthStatus,
} from '../shared/messages';

// DOM Elements
const loginView = document.getElementById('login-view')!;
const mainView = document.getElementById('main-view')!;
const loginBtn = document.getElementById('login-btn') as HTMLButtonElement;
const loginError = document.getElementById('login-error')!;
const userName = document.getElementById('user-name')!;
const userAvatarImg = document.getElementById('user-avatar-img') as HTMLImageElement;
const userAvatarFallback = document.getElementById('user-avatar-fallback')!;
const logoutBtn = document.getElementById('logout-btn')!;
const defaultActivitySelect = document.getElementById('default-activity') as HTMLSelectElement;
const showNotificationsCheckbox = document.getElementById('show-notifications') as HTMLInputElement;
const syncHistoryContainer = document.getElementById('sync-history')!;
const routeStatus = document.getElementById('route-status')!;
const syncControls = document.getElementById('sync-controls')!;
const syncRouteBtn = document.getElementById('sync-route-btn') as HTMLButtonElement;
const syncActivityType = document.getElementById('sync-activity-type') as HTMLSelectElement;
const syncResult = document.getElementById('sync-result')!;

// Initialize popup
async function init(): Promise<void> {
  // Check authentication status
  const authStatus = await checkAuth();

  if (authStatus.isAuthenticated) {
    showMainView(authStatus);
    await loadSettings();
    await loadSyncHistory();
    await checkCurrentRoute();
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

  // Settings changes
  defaultActivitySelect.addEventListener('change', saveSettings);
  showNotificationsCheckbox.addEventListener('change', saveSettings);
}

function showLoginView(): void {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  loginError.classList.add('hidden');
}

function showMainView(auth: AuthStatus): void {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  userName.textContent = auth.displayName || auth.username || 'Connected';

  // Handle avatar display
  if (auth.profileImageUrl) {
    userAvatarImg.src = auth.profileImageUrl;
    userAvatarImg.classList.remove('hidden');
    userAvatarFallback.classList.add('hidden');

    // Fallback to SVG if image fails to load
    userAvatarImg.onerror = () => {
      userAvatarImg.classList.add('hidden');
      userAvatarFallback.classList.remove('hidden');
    };
  } else {
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

async function loadSettings(): Promise<void> {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  if (response.success && response.data) {
    const settings = response.data as ExtensionSettings;
    defaultActivitySelect.value = settings.defaultActivityType;
    showNotificationsCheckbox.checked = settings.showSyncNotifications;
  }
}

async function saveSettings(): Promise<void> {
  await sendMessage({
    type: 'SET_SETTINGS',
    settings: {
      defaultActivityType: defaultActivitySelect.value as 'cycling' | 'hiking',
      showSyncNotifications: showNotificationsCheckbox.checked,
    },
  });
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
    syncHistoryContainer.innerHTML = '<div class="history-empty">No routes synced yet</div>';
    return;
  }

  // Show only last 5 entries
  const recentHistory = history.slice(0, 5);

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

    // Ask content script if there's a route
    const response = await sendMessageToTab(tab.id, { type: 'CHECK_ROUTE' });

    if (response?.hasRoute) {
      showRouteFound(response.routeName || 'Current route');
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
  syncResult.classList.add('hidden');
}

function showNoRouteStatus(): void {
  const statusMessage = routeStatus.querySelector('.status-message') as HTMLElement;
  statusMessage.textContent = 'Open a route on mapy.cz';
  statusMessage.className = 'status-message no-route';
  syncControls.classList.add('hidden');
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

function showSyncSuccess(courseUrl?: string): void {
  syncResult.className = 'sync-result success';
  if (courseUrl) {
    syncResult.innerHTML = `Route synced! <a href="${courseUrl}" target="_blank">View in Garmin Connect</a>`;
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
