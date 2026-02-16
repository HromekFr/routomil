// Mapy.cz Export API client

import { MapyRouteParams, buildMapyExportUrl } from './mapy-url-parser';
import { MapyGarminError, ErrorCode } from '../shared/errors';

/**
 * Fetch GPX data from Mapy.cz export API
 * This replaces DOM-based extraction with a direct API call
 *
 * @param params Route parameters extracted from Mapy.cz URL
 * @returns GPX XML content as string
 * @throws MapyGarminError if fetch fails or response is invalid
 */
export async function fetchGpxFromMapy(params: MapyRouteParams): Promise<string> {
  if (!params.rg || params.rg.length === 0) {
    throw new MapyGarminError(
      'No route coordinates found in URL',
      ErrorCode.ROUTE_EXTRACTION_FAILED
    );
  }

  const url = buildMapyExportUrl(params);

  try {
    console.log('Fetching GPX from Mapy.cz API:', url.substring(0, 100) + '...');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new MapyGarminError(
        `Mapy.cz API returned HTTP ${response.status}: ${response.statusText}`,
        ErrorCode.ROUTE_EXTRACTION_FAILED
      );
    }

    const gpxContent = await response.text();

    // Validate response contains GPX data
    if (!gpxContent || gpxContent.trim().length === 0) {
      throw new MapyGarminError(
        'Mapy.cz API returned empty response',
        ErrorCode.ROUTE_EXTRACTION_FAILED
      );
    }

    if (!gpxContent.includes('<gpx')) {
      throw new MapyGarminError(
        'Mapy.cz API response does not contain GPX data',
        ErrorCode.ROUTE_EXTRACTION_FAILED
      );
    }

    console.log('Successfully fetched GPX from Mapy.cz API');
    return gpxContent;
  } catch (error) {
    if (error instanceof MapyGarminError) {
      throw error;
    }

    // Network or other errors
    throw new MapyGarminError(
      `Failed to fetch GPX from Mapy.cz: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.ROUTE_EXTRACTION_FAILED
    );
  }
}
