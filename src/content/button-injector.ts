// Inject "Sync to Garmin" button into mapy.cz

import { ActivityType } from '../shared/messages';

export interface SyncButtonCallbacks {
  onSync: (activityType: ActivityType) => void;
}

const BUTTON_ID = 'mapy-garmin-sync-button';
const MENU_ID = 'mapy-garmin-sync-menu';

export function injectSyncButton(callbacks: SyncButtonCallbacks): void {
  // Remove existing button if present
  removeExistingButton();

  // Find the best location to inject the button
  const targetContainer = findInjectionTarget();
  if (!targetContainer) {
    console.log('Mapy Garmin Sync: No suitable injection point found');
    return;
  }

  // Create button container
  const container = document.createElement('div');
  container.id = BUTTON_ID;
  container.className = 'mapy-garmin-sync-container';

  // Create main button
  const button = document.createElement('button');
  button.className = 'mapy-garmin-sync-btn';
  button.innerHTML = `
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
    <span>Sync to Garmin</span>
  `;

  // Create dropdown arrow
  const dropdownArrow = document.createElement('button');
  dropdownArrow.className = 'mapy-garmin-sync-dropdown';
  dropdownArrow.innerHTML = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M7 10l5 5 5-5z"/>
    </svg>
  `;

  // Create dropdown menu
  const menu = document.createElement('div');
  menu.id = MENU_ID;
  menu.className = 'mapy-garmin-sync-menu hidden';
  menu.innerHTML = `
    <div class="menu-item" data-type="cycling">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
      </svg>
      <span>Cycling</span>
    </div>
    <div class="menu-item" data-type="hiking">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
      </svg>
      <span>Hiking</span>
    </div>
  `;

  container.appendChild(button);
  container.appendChild(dropdownArrow);
  container.appendChild(menu);

  // Add event listeners
  let selectedType: ActivityType = 'cycling';

  button.addEventListener('click', () => {
    callbacks.onSync(selectedType);
  });

  dropdownArrow.addEventListener('click', e => {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });

  menu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', e => {
      const target = e.currentTarget as HTMLElement;
      const type = target.dataset.type as ActivityType;
      selectedType = type;
      menu.classList.add('hidden');

      // Update button text
      const icon = target.querySelector('svg')?.outerHTML || '';
      const text = target.querySelector('span')?.textContent || type;
      button.innerHTML = `${icon}<span>Sync as ${text}</span>`;

      callbacks.onSync(type);
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', e => {
    if (!container.contains(e.target as Node)) {
      menu.classList.add('hidden');
    }
  });

  // Insert button
  targetContainer.appendChild(container);
}

function findInjectionTarget(): HTMLElement | null {
  // Priority list of selectors to find injection point
  const selectors = [
    // Route panel controls
    '.route-panel__controls',
    '.route-panel__actions',
    '.planning-panel__controls',
    // Export/share section
    '.export-controls',
    '.share-section',
    // Generic route panel areas
    '.route-panel__footer',
    '.route-panel__header',
    '.planning-panel',
    // Sidebar areas
    '.sidebar__content',
    '.panel__content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  // Fallback: create a floating button container
  return createFloatingContainer();
}

function createFloatingContainer(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'mapy-garmin-sync-floating';
  document.body.appendChild(container);
  return container;
}

export function removeExistingButton(): void {
  const existing = document.getElementById(BUTTON_ID);
  if (existing) {
    existing.remove();
  }

  const floatingContainer = document.querySelector('.mapy-garmin-sync-floating');
  if (floatingContainer) {
    floatingContainer.remove();
  }
}

export function updateButtonState(state: 'idle' | 'syncing' | 'success' | 'error'): void {
  const button = document.querySelector(`#${BUTTON_ID} .mapy-garmin-sync-btn`) as HTMLButtonElement;
  if (!button) return;

  button.classList.remove('syncing', 'success', 'error');
  button.disabled = state === 'syncing';

  switch (state) {
    case 'syncing':
      button.classList.add('syncing');
      button.innerHTML = `
        <svg class="spinner" viewBox="0 0 24 24" width="16" height="16">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="50" stroke-linecap="round"/>
        </svg>
        <span>Syncing...</span>
      `;
      break;

    case 'success':
      button.classList.add('success');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        <span>Synced!</span>
      `;
      setTimeout(() => updateButtonState('idle'), 3000);
      break;

    case 'error':
      button.classList.add('error');
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <span>Sync Failed</span>
      `;
      setTimeout(() => updateButtonState('idle'), 5000);
      break;

    case 'idle':
    default:
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Sync to Garmin</span>
      `;
      break;
  }
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  // Remove existing toast
  const existing = document.querySelector('.mapy-garmin-toast');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.className = `mapy-garmin-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Remove after delay
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
