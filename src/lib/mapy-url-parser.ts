// Mapy.cz URL parsing and route parameter extraction

export interface MapyRouteParams {
  rc: string | null;    // original rc value from URL (may contain abbreviated coords)
  rg: string[];         // rc split into 10-char chunks (fallback when rc unavailable)
  rs: string[];         // stop types (e.g., 'muni', 'ward')
  ri: string[];         // stop IDs
  rp_c: string | null;  // route profile from mrp.c (e.g., '121' for cycling)
  rp_aw: string | null; // route waypoints (rwp → rp_aw mapping)
  rut: string | null;   // route update token (required by some routes)
}

/**
 * Split rc parameter into rg chunks (10 characters each)
 * The URL parameter 'rc' is split into 10-character chunks to create 'rg' values.
 * Example: rc=9hChxxXvtO95rPhx1qo5 → rg=['9hChxxXvtO', '95rPhx1qo5']
 */
export function splitRcToRg(rc: string): string[] {
  if (!rc) return [];

  const chunks: string[] = [];
  for (let i = 0; i < rc.length; i += 10) {
    chunks.push(rc.substring(i, i + 10));
  }
  return chunks;
}

/**
 * Parse Mapy.cz URL and extract route parameters
 * Extracts the parameters needed to call the Mapy.cz export API
 */
export function parseMapyUrl(urlString: string): MapyRouteParams {
  const url = new URL(urlString);
  const params = url.searchParams;

  const rc = params.get('rc');
  const rwp = params.get('rwp');

  const result: MapyRouteParams = {
    rc,                                // Original rc (may contain abbreviated coords)
    rg: rc ? splitRcToRg(rc) : [],     // Split rc into 10-char chunks (fallback)
    rs: params.getAll('rs'),           // Stop types
    ri: params.getAll('ri'),           // Stop IDs
    rp_aw: rwp,                        // Route waypoints (rwp → rp_aw)
    rut: params.get('rut'),            // Route update token (present on some routes)
    rp_c: null,
  };

  // Parse mrp JSON (route profile)
  const mrpString = params.get('mrp');
  if (mrpString) {
    try {
      const mrp = JSON.parse(decodeURIComponent(mrpString)) as { c?: number };
      result.rp_c = mrp.c ? String(mrp.c) : null;
    } catch (e) {
      console.error('Failed to parse mrp:', e instanceof Error ? e.message : 'Unknown error');
    }
  }

  return result;
}

/**
 * Check if URL contains route parameters
 * Returns true if the URL has route data (rc or rg parameters)
 */
export function hasRouteParams(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const params = url.searchParams;

    // Check for rc parameter (coordinate data)
    if (params.get('rc')) {
      return true;
    }

    // Check for rg parameters (already split coordinates)
    if (params.getAll('rg').length > 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Build Mapy.cz export API URL from route parameters
 * Creates the URL for fetching GPX data directly from the Mapy.cz API
 */
export function buildMapyExportUrl(params: MapyRouteParams): string {
  const baseUrl = 'https://mapy.com/api/tplannerexport';
  const url = new URL(baseUrl);

  // Export format (always GPX for our use case)
  url.searchParams.set('export', 'gpx');

  // Language preference
  url.searchParams.set('lang', 'en,cs');

  // Route profile (cycling, hiking, etc.)
  if (params.rp_c) {
    url.searchParams.set('rp_c', params.rp_c);
  }

  // Route coordinates: prefer original rc (handles abbreviated coords)
  // over split rg chunks (which break on non-10-char encodings)
  if (params.rc) {
    url.searchParams.set('rc', params.rc);
  } else if (params.rg) {
    params.rg.forEach(rg => url.searchParams.append('rg', rg));
  }

  // Stop types (rs)
  if (params.rs) {
    params.rs.forEach(rs => url.searchParams.append('rs', rs));
  }

  // Stop IDs (ri)
  if (params.ri) {
    params.ri.forEach(ri => url.searchParams.append('ri', ri));
  }

  // Route waypoints (rp_aw)
  if (params.rp_aw) {
    url.searchParams.set('rp_aw', params.rp_aw);
  }

  // Route update token (required by some routes)
  if (params.rut) {
    url.searchParams.set('rut', params.rut);
  }

  // Add cache buster to avoid cached responses
  url.searchParams.set('rand', Math.random().toString().substring(2));

  return url.toString();
}
