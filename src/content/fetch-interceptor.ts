// MAIN world script — builds the correct Mapy.cz tplannerexport URL from internal SMap.Coords
// and fetches the GPX directly, without any UI interaction or window.fetch patching.
//
// Why MAIN world is needed:
//   SMap.Coords.stringToCoords() handles delta-encoded rc parameters (where non-first
//   waypoints are stored as short delta values rather than full 10-char absolute coords).
//   That decoding logic lives in the page's JS context and is only accessible from MAIN world.

const ROUTOMIL_SOURCE = 'routomil-extension';
const ALLOWED_ORIGINS = ['https://mapy.cz', 'https://en.mapy.cz', 'https://mapy.com'];
const EXPORT_BASE_URL = 'https://mapy.com/api/tplannerexport';

// Minimal interface — only the two SMap.Coords methods we use
interface SMapCoordsStatic {
  /** Decode a delta-encoded rc string into an array of coordinate objects. */
  stringToCoords(rc: string): SMapCoordsInstance[];
  /** Encode a single-element array back to the absolute 10-char rg string. */
  coordsToString(coords: SMapCoordsInstance[]): string;
}
interface SMapCoordsInstance {
  toWGS84(): [number, number];
}

// Listen for the export trigger from the ISOLATED content script
window.addEventListener('message', (event: MessageEvent) => {
  if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  if (event.data?.source !== ROUTOMIL_SOURCE) return;
  if (event.data?.type === 'ROUTOMIL_REQUEST_EXPORT') {
    handleExportRequest();
  }
});

async function handleExportRequest(): Promise<void> {
  try {
    const gpx = await fetchGpxViaSMap();
    window.postMessage(
      { type: 'ROUTOMIL_GPX_INTERCEPTED', gpx, source: ROUTOMIL_SOURCE },
      '*'
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : 'GPX export failed';
    window.postMessage(
      { type: 'ROUTOMIL_GPX_INTERCEPTED', error, source: ROUTOMIL_SOURCE },
      '*'
    );
  }
}

async function fetchGpxViaSMap(): Promise<string> {
  // Access SMap.Coords from the page's JS context (MAIN world only)
  const SMapCoords = (window as unknown as { SMap?: { Coords?: SMapCoordsStatic } })
    .SMap?.Coords;
  if (!SMapCoords) {
    throw new Error('SMap.Coords is not available — are you on a Mapy.cz page?');
  }

  const pageUrl = new URL(window.location.href);
  const rc = pageUrl.searchParams.get('rc');
  if (!rc) {
    throw new Error('No route found in URL (missing rc parameter)');
  }

  // Decode rc → absolute SMap.Coords objects (handles delta encoding transparently)
  const coordObjs = SMapCoords.stringToCoords(rc);
  if (!coordObjs || coordObjs.length === 0) {
    throw new Error('Could not decode route coordinates from rc parameter');
  }

  // Re-encode each coord as an absolute 10-char rg chunk
  const rgValues = coordObjs.map(c => SMapCoords.coordsToString([c]));

  // Build the export URL with the same parameters Mapy.cz's own Export button uses
  const exportUrl = new URL(EXPORT_BASE_URL);
  exportUrl.searchParams.set('export', 'gpx');
  exportUrl.searchParams.set('lang', 'en,cs');

  // Route profile (from mrp.c)
  const mrpStr = pageUrl.searchParams.get('mrp');
  if (mrpStr) {
    try {
      const mrp = JSON.parse(decodeURIComponent(mrpStr)) as { c?: number };
      if (mrp.c) exportUrl.searchParams.set('rp_c', String(mrp.c));
    } catch {
      // mrp parse failure is non-fatal; export API uses a default profile
    }
  }

  // Waypoint absolute coordinates (decoded from rc)
  rgValues.forEach(rg => exportUrl.searchParams.append('rg', rg));

  // Waypoint stop types and IDs
  pageUrl.searchParams.getAll('rs').forEach(rs => exportUrl.searchParams.append('rs', rs));
  pageUrl.searchParams.getAll('ri').forEach(ri => exportUrl.searchParams.append('ri', ri));

  // Route update token (present on some routes)
  const rut = pageUrl.searchParams.get('rut');
  if (rut) exportUrl.searchParams.set('rut', rut);

  // Cache buster (matches Mapy.cz behaviour)
  exportUrl.searchParams.set('rand', Math.random().toString().substring(2));

  const response = await fetch(exportUrl.toString());
  if (!response.ok) {
    throw new Error(`Mapy.cz export API returned HTTP ${response.status}`);
  }

  const gpxText = await response.text();
  if (!gpxText.includes('<gpx')) {
    throw new Error('Export response does not contain valid GPX data');
  }

  return gpxText;
}
