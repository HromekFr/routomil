// Mapy.cz Folder Export API client

import { MapyGarminError, ErrorCode } from '../shared/errors';

const FOLDER_EXPORT_BASE_URL = 'https://mapy.com/api/mapybox-export/v1/folder/gpx';

/**
 * Build folder export URL for Mapy.cz API
 */
export function buildFolderExportUrl(folderId: string): string {
  const params = new URLSearchParams({
    id: folderId,
    export: 'gpx',
    shrink: 'false',
    single: 'true',
    tponly: 'true',
  });
  return `${FOLDER_EXPORT_BASE_URL}?${params}`;
}

/**
 * Fetch GPX data from a Mapy.cz folder
 * Must be called from content script context (has auth cookies for mapy.com)
 *
 * @param folderId Folder ID extracted from the Mapy.cz URL (mid= parameter)
 * @returns GPX XML content as string
 * @throws MapyGarminError if fetch fails or response is invalid
 */
export async function fetchGpxFromFolder(folderId: string): Promise<string> {
  if (!folderId || folderId.trim().length === 0) {
    throw new MapyGarminError('No folder ID provided', ErrorCode.FOLDER_NOT_FOUND);
  }

  const url = buildFolderExportUrl(folderId);

  try {
    console.log('Fetching GPX from Mapy.cz folder API');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.status === 404) {
      throw new MapyGarminError(
        'Folder not found. Make sure the folder is public or you are logged in.',
        ErrorCode.FOLDER_NOT_FOUND
      );
    }

    if (!response.ok) {
      throw new MapyGarminError(
        `Mapy.cz folder API returned HTTP ${response.status}: ${response.statusText}`,
        ErrorCode.FOLDER_EXPORT_FAILED
      );
    }

    const gpxContent = await response.text();

    if (!gpxContent || gpxContent.trim().length === 0) {
      throw new MapyGarminError(
        'Mapy.cz folder API returned empty response',
        ErrorCode.FOLDER_EXPORT_FAILED
      );
    }

    if (!gpxContent.includes('<gpx')) {
      throw new MapyGarminError(
        'Mapy.cz folder API response does not contain GPX data',
        ErrorCode.FOLDER_EXPORT_FAILED
      );
    }

    console.log('Successfully fetched GPX from Mapy.cz folder API');
    return gpxContent;
  } catch (error) {
    if (error instanceof MapyGarminError) {
      throw error;
    }

    throw new MapyGarminError(
      `Failed to fetch folder from Mapy.cz: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ErrorCode.FOLDER_EXPORT_FAILED
    );
  }
}

export interface FolderGpxInfo {
  trackCount: number;
  waypointCount: number;
}

/**
 * Validate GPX content from a folder export.
 * Throws MapyGarminError for invalid content (empty folder, multiple routes).
 * Returns info about the GPX content.
 */
export function validateFolderGpx(gpxContent: string): FolderGpxInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, 'text/xml');

  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    throw new MapyGarminError('Invalid GPX XML in folder export', ErrorCode.FOLDER_EXPORT_FAILED);
  }

  const trkNodes = doc.getElementsByTagName('trk');
  const trackCount = trkNodes.length;
  const waypointCount = doc.getElementsByTagName('wpt').length;

  if (trackCount === 0) {
    throw new MapyGarminError(
      'This folder contains no routes. Add a route to the folder before syncing.',
      ErrorCode.FOLDER_EMPTY
    );
  }

  if (trackCount > 1) {
    throw new MapyGarminError(
      `This folder contains ${trackCount} routes. Please sync individual routes instead.`,
      ErrorCode.FOLDER_MULTIPLE_ROUTES
    );
  }

  return { trackCount, waypointCount };
}
