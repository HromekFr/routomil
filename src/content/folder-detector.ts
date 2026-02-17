// Mapy.cz folder page detection and ID extraction

export interface FolderInfo {
  folderId: string;
  folderName: string | null;
}

/**
 * Check if the current URL is a Mapy.cz folder page.
 * Folder pages contain the `cat=mista-trasy` and `mid=` parameters.
 *
 * Example URL:
 *   https://mapy.com/en/turisticka?moje-mapy&l=1&cat=mista-trasy&mid=68933efd30d1fdb55139c439
 */
export function isFolderPage(url: string): boolean {
  try {
    const parsed = new URL(url);
    const search = parsed.search + (parsed.hash.includes('?') ? '&' + parsed.hash.split('?')[1] : '');
    return (
      (search.includes('cat=mista-trasy') || search.includes('moje-mapy')) &&
      search.includes('mid=')
    );
  } catch {
    return false;
  }
}

/**
 * Extract folder ID from a Mapy.cz folder URL.
 * Returns null if the ID cannot be found.
 */
export function extractFolderId(url: string): string | null {
  try {
    // mid= can appear in query string or hash fragment
    const parsed = new URL(url);

    // Check query string first
    const queryMid = parsed.searchParams.get('mid');
    if (queryMid) return queryMid;

    // Check hash fragment (e.g. #...&mid=xxx)
    const hash = parsed.hash;
    const hashMatch = hash.match(/[?&]mid=([^&]+)/);
    if (hashMatch) return hashMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract folder name from the page DOM.
 * Returns null if no name can be found.
 */
export function extractFolderName(): string | null {
  // Try common folder title selectors used by Mapy.cz
  const selectors = [
    '.my-maps-detail__name',
    '.folder-name',
    '[data-folder-name]',
    'h1.title',
    '.moje-mapy-header h1',
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  }

  // Fall back to document title (strip site name)
  const title = document.title;
  if (title && title !== 'Mapy.cz' && title !== 'Mapy.com') {
    return title.replace(/\s*[|–-]\s*Mapy\.(cz|com).*$/i, '').trim() || null;
  }

  return null;
}

/**
 * Detect folder info from the current page.
 * Returns null if the current page is not a folder page or folder ID cannot be extracted.
 */
export function detectFolder(url: string): FolderInfo | null {
  if (!isFolderPage(url)) return null;

  const folderId = extractFolderId(url);
  if (!folderId) return null;

  const folderName = extractFolderName();
  return { folderId, folderName };
}
