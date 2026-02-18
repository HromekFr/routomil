// MAIN world script — passively intercepts BRouter API fetch responses on bikerouter.de
// and stitches segments on demand via postMessage.
//
// Why MAIN world is needed:
//   We patch window.fetch to capture responses before they reach the page.
//   ISOLATED world cannot patch window.fetch of the page context.

const ROUTOMIL_SOURCE = 'routomil-extension';
const BIKEROUTER_ORIGIN = 'https://bikerouter.de';
const BROUTER_ENGINE_PATH = 'brouter-engine/brouter';

// Map from normalized lonlats key (e.g. "16.98,49.96|17.04,49.93") to raw GeoJSON string
const capturedSegments = new Map<string, string>();

// Patch window.fetch to passively capture BRouter segment responses
const originalFetch = window.fetch.bind(window);
window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await originalFetch(input, init);

  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes(BROUTER_ENGINE_PATH)) {
      const lonlats = extractLonlatsFromUrl(url);
      if (lonlats) {
        // Clone response so we can read the body without consuming the original
        const cloned = response.clone();
        cloned.text().then(text => {
          if (text && text.includes('"FeatureCollection"')) {
            capturedSegments.set(lonlats, text);
          }
        }).catch(() => {
          // Silently ignore read errors
        });
      }
    }
  } catch {
    // Never break the page's fetch
  }

  return response;
};

/**
 * Extract and normalize the lonlats query param from a BRouter API URL.
 * Returns e.g. "16.98,49.96|17.04,49.93" or null if not present.
 */
function extractLonlatsFromUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const lonlats = url.searchParams.get('lonlats');
    return lonlats ? normalizeLonlats(lonlats) : null;
  } catch {
    return null;
  }
}

/**
 * Normalize lonlats string for consistent map key comparison.
 * Trims whitespace and normalizes pipe-separated coordinate pairs.
 */
function normalizeLonlats(lonlats: string): string {
  return lonlats.trim();
}

/**
 * Parse waypoints from the URL hash: #map=.../profile&lonlats=lon1,lat1;lon2,lat2;...
 * Returns array of "lon,lat" strings in order.
 */
function parseWaypointsFromHash(): string[] {
  const hash = window.location.hash;
  const match = hash.match(/lonlats=([^&]+)/);
  if (!match) return [];
  return match[1].split(';').filter(Boolean);
}

/**
 * Build the segment key for a consecutive pair of waypoints.
 * BRouter uses pipe-separated lonlats in the API call.
 */
function buildSegmentKey(wp1: string, wp2: string): string {
  return `${wp1}|${wp2}`;
}

// Listen for postMessages from the ISOLATED content script
window.addEventListener('message', (event: MessageEvent) => {
  if (event.origin !== BIKEROUTER_ORIGIN) return;
  if (event.data?.source !== ROUTOMIL_SOURCE) return;

  if (event.data?.type === 'ROUTOMIL_REQUEST_BIKEROUTER_EXPORT') {
    handleExportRequest();
  } else if (event.data?.type === 'ROUTOMIL_CHECK_BIKEROUTER_ROUTE') {
    handleCheckRequest();
  }
});

function handleCheckRequest(): void {
  const waypoints = parseWaypointsFromHash();
  if (waypoints.length < 2) {
    window.postMessage(
      { type: 'ROUTOMIL_BIKEROUTER_ROUTE_STATUS', source: ROUTOMIL_SOURCE, segmentCount: 0, ready: false },
      BIKEROUTER_ORIGIN
    );
    return;
  }

  const expectedSegments = waypoints.length - 1;
  let capturedCount = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const key = buildSegmentKey(waypoints[i], waypoints[i + 1]);
    if (capturedSegments.has(key)) capturedCount++;
  }

  window.postMessage(
    {
      type: 'ROUTOMIL_BIKEROUTER_ROUTE_STATUS',
      source: ROUTOMIL_SOURCE,
      segmentCount: capturedCount,
      expectedSegments,
      ready: capturedCount === expectedSegments,
    },
    BIKEROUTER_ORIGIN
  );
}

function handleExportRequest(): void {
  const waypoints = parseWaypointsFromHash();

  if (waypoints.length < 2) {
    window.postMessage(
      {
        type: 'ROUTOMIL_BIKEROUTER_ROUTE_READY',
        source: ROUTOMIL_SOURCE,
        error: 'No route found. Add at least 2 waypoints on bikerouter.de.',
      },
      BIKEROUTER_ORIGIN
    );
    return;
  }

  const segmentJsonStrings: string[] = [];
  const missingSegments: string[] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const key = buildSegmentKey(waypoints[i], waypoints[i + 1]);
    const segment = capturedSegments.get(key);
    if (segment) {
      segmentJsonStrings.push(segment);
    } else {
      missingSegments.push(key);
    }
  }

  if (missingSegments.length > 0) {
    window.postMessage(
      {
        type: 'ROUTOMIL_BIKEROUTER_ROUTE_READY',
        source: ROUTOMIL_SOURCE,
        error: `Route not fully loaded. Missing ${missingSegments.length} segment(s). Please wait for the route to finish loading.`,
      },
      BIKEROUTER_ORIGIN
    );
    return;
  }

  // Encode segment strings as JSON array for transport
  const geojsonContent = JSON.stringify(segmentJsonStrings);

  // Derive route name from profile in hash if available
  const routeName = extractRouteName();

  window.postMessage(
    {
      type: 'ROUTOMIL_BIKEROUTER_ROUTE_READY',
      source: ROUTOMIL_SOURCE,
      geojsonContent,
      routeName,
    },
    BIKEROUTER_ORIGIN
  );
}

/**
 * Extract a route name from the URL hash profile parameter.
 * Falls back to "BRouter Route".
 */
function extractRouteName(): string {
  const hash = window.location.hash;
  // Hash format: #map=14/49.96/17.01/standard&lonlats=...&profile=fastbike
  const profileMatch = hash.match(/profile=([^&]+)/);
  if (profileMatch) {
    // Convert "fastbike" → "Fastbike Route"
    const profile = decodeURIComponent(profileMatch[1]);
    return profile.charAt(0).toUpperCase() + profile.slice(1) + ' Route';
  }
  return 'BRouter Route';
}
