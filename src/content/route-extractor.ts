// Route extraction from mapy.cz

export interface ExtractedRoute {
  name: string;
  gpxContent: string;
}

// Try to extract route name from the page
export function extractRouteName(): string | null {
  // Strategy 1: Look for input fields with route name
  const nameInput = document.querySelector(
    'input[placeholder*="name" i], input[placeholder*="název" i], input[name*="name" i]'
  ) as HTMLInputElement;
  if (nameInput?.value?.trim()) {
    console.log('Route name from input:', nameInput.value.trim());
    return nameInput.value.trim();
  }

  // Strategy 2: Try various selectors for route name
  const selectors = [
    '.route-header__title',
    '.route-panel__title',
    '[data-testid="route-name"]',
    '.planning-panel h2',
    '.route-title',
    'h1', 'h2', 'h3', // Generic headings as fallback
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.trim();
    if (text && text.length > 0 && text.length < 100) {
      console.log('Route name from selector', selector, ':', text);
      return text;
    }
  }

  // Strategy 3: Extract from URL query parameters
  const urlMatch = window.location.href.match(/[?&]q=([^&]+)/);
  if (urlMatch) {
    const decodedName = decodeURIComponent(urlMatch[1]);
    console.log('Route name from URL query:', decodedName);
    return decodedName;
  }

  // Strategy 4: Check URL for route ID
  const routeIdMatch = window.location.href.match(/route[=/]([^&/]+)/i);
  if (routeIdMatch) {
    return `Route ${routeIdMatch[1]}`;
  }

  // Fallback: Use today's date
  const fallbackName = `Mapy.cz Route ${new Date().toLocaleDateString()}`;
  console.log('Using fallback route name:', fallbackName);
  return fallbackName;
}

// Check if there's a route on the page
export function hasRoute(): boolean {
  // PRIMARY: Detect Export button (most reliable indicator)
  if (findExportButton()) {
    console.log('Route detected: Export button found');
    return true;
  }

  // SECONDARY: Enhanced URL detection
  const url = window.location.href;
  if (url.includes('mapy.cz') || url.includes('mapy.com') || url.includes('en.mapy.cz')) {
    // Check for coordinate parameters or route-related query strings
    if (url.includes('x=') || url.includes('y=') || url.includes('z=') ||
        url.includes('trasa') || url.includes('plan') || url.includes('/route') ||
        url.includes('directions')) {
      console.log('Route detected: URL contains route indicators');
      return true;
    }
  }

  // TERTIARY: Original DOM selectors (keep as fallback)
  const routeIndicators = [
    '.route-panel',
    '.planning-panel',
    '[data-testid="route-panel"]',
    '.directions-panel',
    '.route-result',
  ];

  for (const selector of routeIndicators) {
    if (document.querySelector(selector)) {
      console.log('Route detected: Found selector', selector);
      return true;
    }
  }

  console.log('Route not detected');
  return false;
}

// Find the Export button on mapy.cz
function findExportButton(): HTMLElement | null {
  // Strategy 1: Text-based search for "Export" or Czech "Stáhni"
  const allButtons = document.querySelectorAll('button, a[role="button"], [role="button"]');
  for (const btn of allButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    const title = btn.getAttribute('title')?.toLowerCase() || '';

    // Look for export/download keywords in multiple languages
    if (text.includes('export') || text.includes('stáhni') || text.includes('stáhnout') ||
        ariaLabel.includes('export') || ariaLabel.includes('stáhni') ||
        title.includes('export') || title.includes('stáhni')) {
      console.log('Export button found via text/aria:', text || ariaLabel || title);
      return btn as HTMLElement;
    }
  }

  // Strategy 2: ARIA labels and attributes
  const exportByAria = document.querySelector(
    '[aria-label*="export" i], [aria-label*="stáhni" i], [title*="export" i], [title*="stáhni" i]'
  );
  if (exportByAria) {
    console.log('Export button found via ARIA');
    return exportByAria as HTMLElement;
  }

  // Strategy 3: Common class patterns and data attributes
  const exportByClass = document.querySelector(
    '.export-button, [data-action="export"], [data-export], .download-button, [data-action="download"]'
  );
  if (exportByClass) {
    console.log('Export button found via class/data attribute');
    return exportByClass as HTMLElement;
  }

  return null;
}

// Extract GPX by triggering the export functionality
export async function extractGpx(): Promise<ExtractedRoute | null> {
  console.log('Starting GPX extraction...');

  // Method 1: Try to find and click the main Export button
  const exportButton = findExportButton();
  if (exportButton) {
    console.log('Found Export button, attempting to click and capture GPX...');
    const result = await clickAndCaptureGpx(exportButton);
    if (result) {
      console.log('Successfully extracted GPX via Export button');
      return result;
    }
    console.log('Export button click did not yield GPX, trying other methods...');
  }

  // Method 2: Try to find specific GPX export button
  const gpxButton = findGpxExportButton();
  if (gpxButton) {
    console.log('Found specific GPX button, attempting extraction...');
    const result = await extractViaExportButton(gpxButton);
    if (result) {
      console.log('Successfully extracted GPX via GPX button');
      return result;
    }
  }

  // Method 3: Try to intercept the route data from the page's state
  console.log('Attempting to extract from page state...');
  const routeData = extractFromPageState();
  if (routeData) {
    console.log('Successfully extracted GPX from page state');
    return routeData;
  }

  // Method 4: Try to find GPX download link
  console.log('Looking for GPX download link...');
  const gpxLink = findGpxDownloadLink();
  if (gpxLink) {
    const result = await extractViaDownloadLink(gpxLink);
    if (result) {
      console.log('Successfully extracted GPX via download link');
      return result;
    }
  }

  console.error('All GPX extraction methods failed');
  return null;
}

function findGpxExportButton(): HTMLElement | null {
  // Look for export/share buttons that might have GPX option
  const buttonSelectors = [
    'button[data-export="gpx"]',
    'button:contains("GPX")',
    '[data-testid="export-gpx"]',
    '.export-menu button',
    '.share-menu button',
  ];

  for (const selector of buttonSelectors) {
    try {
      const element = document.querySelector(selector);
      if (element instanceof HTMLElement) {
        return element;
      }
    } catch {
      // Invalid selector, continue
    }
  }

  // Look for buttons with GPX text
  const buttons = document.querySelectorAll('button, a');
  for (const btn of buttons) {
    if (btn.textContent?.toLowerCase().includes('gpx')) {
      return btn as HTMLElement;
    }
  }

  return null;
}

function findGpxDownloadLink(): HTMLAnchorElement | null {
  const links = document.querySelectorAll('a[href*=".gpx"], a[download*=".gpx"]');
  if (links.length > 0) {
    return links[0] as HTMLAnchorElement;
  }
  return null;
}

// Click Export button and intercept GPX download
async function clickAndCaptureGpx(button: HTMLElement): Promise<ExtractedRoute | null> {
  return new Promise((resolve) => {
    let captured = false;

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = args[0] instanceof Request ? args[0].url : String(args[0]);

      if (url.includes('.gpx') || url.includes('export') || url.includes('format=gpx') ||
          url.includes('download') || url.includes('stahni')) {
        try {
          const clone = response.clone();
          const text = await clone.text();

          if (text.includes('<?xml') && text.includes('<gpx')) {
            captured = true;
            window.fetch = originalFetch;
            console.log('GPX captured via fetch interception');
            resolve({
              name: extractRouteName() || 'Mapy.cz Route',
              gpxContent: text
            });
          }
        } catch (error) {
          console.error('Error reading fetch response:', error);
        }
      }

      return response;
    };

    // Intercept XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    const OriginalXHRClass = originalXHR;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).XMLHttpRequest = function() {
      const xhr = new OriginalXHRClass();
      const originalOpen = xhr.open;

      xhr.open = function(method: string, url: string | URL, ...rest: unknown[]) {
        const urlString = typeof url === 'string' ? url : url.toString();
        if (urlString.includes('.gpx') || urlString.includes('export') || urlString.includes('download')) {
          xhr.addEventListener('load', function() {
            if (this.responseText?.includes('<?xml') && this.responseText?.includes('<gpx')) {
              captured = true;
              window.XMLHttpRequest = originalXHR;
              console.log('GPX captured via XHR interception');
              resolve({
                name: extractRouteName() || 'Mapy.cz Route',
                gpxContent: this.responseText
              });
            }
          });
        }
        // @ts-expect-error - Dynamic arguments
        return originalOpen.call(this, method, url, ...rest);
      };

      return xhr;
    };

    // Click the button to open the export modal
    console.log('Clicking Export button to open modal...');
    button.click();

    // Wait for modal to appear and click the Export button inside it
    setTimeout(() => {
      if (!captured) {
        console.log('Looking for Export button inside modal...');
        const modalExportButton = findModalExportButton();

        if (modalExportButton) {
          console.log('Found modal Export button, clicking...');
          modalExportButton.click();
        } else {
          console.log('No modal Export button found, waiting for download to start...');
        }
      }
    }, 500); // Wait 500ms for modal to appear

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!captured) {
        window.fetch = originalFetch;
        window.XMLHttpRequest = originalXHR;
        console.log('GPX capture timed out after 10 seconds');
        resolve(null);
      }
    }, 10000);
  });
}

// Find the Export button inside the export modal dialog
function findModalExportButton(): HTMLElement | null {
  // Look for common modal/dialog containers
  const modalSelectors = [
    '[role="dialog"]',
    '.modal',
    '.dialog',
    '[class*="modal"]',
    '[class*="dialog"]',
    '[class*="export"]',
  ];

  for (const selector of modalSelectors) {
    const modal = document.querySelector(selector);
    if (modal) {
      // Look for Export button inside this modal
      const buttons = modal.querySelectorAll('button, a[role="button"], [role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';

        // Look for "Export" text in multiple languages
        if (text.includes('export') || text.includes('stáhni') || text.includes('exportovat') ||
            ariaLabel.includes('export') || ariaLabel.includes('stáhni')) {
          console.log('Found Export button in modal via selector:', selector);
          return btn as HTMLElement;
        }
      }
    }
  }

  // Fallback: Find any visible Export button that wasn't there before
  const allButtons = document.querySelectorAll('button, a[role="button"], [role="button"]');
  for (const btn of allButtons) {
    const text = btn.textContent?.toLowerCase() || '';
    const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
    const htmlBtn = btn as HTMLElement;

    // Check if button is visible and contains export text
    if ((text.includes('export') || text.includes('stáhni') || ariaLabel.includes('export')) &&
        htmlBtn.offsetParent !== null) { // Check if visible
      console.log('Found visible Export button:', text || ariaLabel);
      return htmlBtn;
    }
  }

  return null;
}

async function extractViaExportButton(button: HTMLElement): Promise<ExtractedRoute | null> {
  return new Promise(resolve => {
    // Set up fetch interception to capture GPX response
    const originalFetch = window.fetch;
    let resolved = false;

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      const url = args[0] instanceof Request ? args[0].url : String(args[0]);
      if (url.includes('gpx') || url.includes('export')) {
        try {
          const clone = response.clone();
          const text = await clone.text();
          if (text.includes('<?xml') && text.includes('<gpx')) {
            resolved = true;
            window.fetch = originalFetch;
            resolve({
              name: extractRouteName() || 'Mapy.cz Route',
              gpxContent: text,
            });
          }
        } catch {
          // Not GPX, continue
        }
      }

      return response;
    };

    // Click the button
    button.click();

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!resolved) {
        window.fetch = originalFetch;
        resolve(null);
      }
    }, 5000);
  });
}

async function extractViaDownloadLink(link: HTMLAnchorElement): Promise<ExtractedRoute | null> {
  try {
    const response = await fetch(link.href);
    const text = await response.text();

    if (text.includes('<?xml') && text.includes('<gpx')) {
      return {
        name: extractRouteName() || 'Mapy.cz Route',
        gpxContent: text,
      };
    }
  } catch (error) {
    console.error('Failed to fetch GPX from link:', error);
  }

  return null;
}

function extractFromPageState(): ExtractedRoute | null {
  // Try to access mapy.cz's internal state
  // This is a fallback that looks for route data in window objects

  try {
    // Check for common state management patterns
    const windowAny = window as unknown as Record<string, unknown>;

    // Look for route data in various possible locations
    const stateLocations = ['__MAPY_STATE__', '__NEXT_DATA__', 'mapyState', 'routeData'];

    for (const location of stateLocations) {
      if (windowAny[location]) {
        const state = windowAny[location] as Record<string, unknown>;
        const gpx = findGpxInObject(state);
        if (gpx) {
          return {
            name: extractRouteName() || 'Mapy.cz Route',
            gpxContent: gpx,
          };
        }
      }
    }
  } catch {
    // State access failed
  }

  return null;
}

function findGpxInObject(obj: unknown, depth = 0): string | null {
  if (depth > 5) return null;

  if (typeof obj === 'string') {
    if (obj.includes('<?xml') && obj.includes('<gpx')) {
      return obj;
    }
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const value of Object.values(obj)) {
      const result = findGpxInObject(value, depth + 1);
      if (result) return result;
    }
  }

  return null;
}

// Build GPX from route coordinates if we can access them
export function buildGpxFromCoordinates(
  coordinates: Array<{ lat: number; lon: number; ele?: number }>,
  name: string
): string {
  const points = coordinates
    .map(c => {
      const ele = c.ele !== undefined ? `<ele>${c.ele}</ele>` : '';
      return `<trkpt lat="${c.lat}" lon="${c.lon}">${ele}</trkpt>`;
    })
    .join('\n        ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Mapy.cz Garmin Sync">
  <metadata>
    <name>${escapeXml(name)}</name>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
        ${points}
    </trkseg>
  </trk>
</gpx>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
