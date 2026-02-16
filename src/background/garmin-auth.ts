// Garmin authentication module
// Uses browser-tab login approach for better reliability

import { MapyGarminError, ErrorCode } from '../shared/errors';
import { saveAuthToken, getAuthToken, clearAuthToken } from '../lib/storage';
import { validateImageUrl } from '../shared/security';

const GARMIN_CONNECT_URL = 'https://connect.garmin.com';

interface GarminSession {
  cookies: string;
  username: string;
  expiresAt: number;
}

// Verify Garmin session is valid by checking for key cookies
async function verifySession(): Promise<boolean> {
  console.log('[Garmin Auth] Verifying session');

  try {
    const cookies = await chrome.cookies.getAll({ domain: '.garmin.com' });
    console.log('[Garmin Auth] Found', cookies.length, 'cookies for verification');

    // Check for key authentication cookies (case-insensitive)
    const cookieNames = cookies.map(c => c.name.toLowerCase());
    const hasSession = cookieNames.includes('session');
    const hasSessionId = cookieNames.includes('sessionid');
    const hasJwt = cookieNames.some(name => name.includes('jwt'));
    const hasCastgc = cookieNames.includes('castgc');

    console.log('[Garmin Auth] Cookie check:', {
      hasSession,
      hasSessionId,
      hasJwt,
      hasCastgc,
      cookieCount: cookies.length
    });

    // Valid if we have session cookies (session, SESSIONID, or JWT)
    const isValid = hasSession || hasSessionId || hasJwt || hasCastgc;
    console.log('[Garmin Auth] Session valid:', isValid);
    return isValid;
  } catch (error) {
    console.error('[Garmin Auth] verifySession() error:', error);
    return false;
  }
}

// Check if already logged into Garmin
async function checkExistingSession(): Promise<GarminSession | null> {
  console.log('[Garmin Auth] Checking for existing session');

  try {
    const cookies = await chrome.cookies.getAll({ domain: '.garmin.com' });
    console.log('[Garmin Auth] Found', cookies.length, 'cookies');

    if (cookies.length === 0) {
      console.log('[Garmin Auth] No cookies found');
      return null;
    }

    // Verify session is valid
    const isValid = await verifySession();

    if (!isValid) {
      console.log('[Garmin Auth] Session invalid');
      return null;
    }

    console.log('[Garmin Auth] Valid session found');
    return await captureSession();
  } catch (error) {
    console.error('[Garmin Auth] Error checking existing session:', error);
    return null;
  }
}

// Capture session info from cookies
async function captureSession(): Promise<GarminSession> {
  console.log('[Garmin Auth] Capturing session');

  const cookies = await chrome.cookies.getAll({ domain: '.garmin.com' });
  console.log('[Garmin Auth] Captured', cookies.length, 'cookies');

  // Build cookie string for API requests
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  // Calculate expiry (1 year from now, matching Garmin app)
  const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;

  // Get existing token to preserve profile data
  const existingToken = await getAuthToken();

  const session: GarminSession = {
    cookies: cookieString,
    username: existingToken?.displayName || existingToken?.username || 'Garmin User',
    expiresAt,
  };

  // Save to storage, preserving profile data if it exists
  await saveAuthToken({
    sessionCookies: session.cookies,
    username: session.username,
    expiresAt: session.expiresAt,
    displayName: existingToken?.displayName,
    profileImageUrl: existingToken?.profileImageUrl,
  });

  console.log('[Garmin Auth] Session captured and saved, profile data preserved:', {
    hasDisplayName: !!existingToken?.displayName,
    hasProfileImage: !!existingToken?.profileImageUrl
  });
  return session;
}

// Clear all Garmin cookies
async function clearGarminCookies(): Promise<void> {
  console.log('[Garmin Auth] Clearing Garmin cookies');
  const domains = ['.garmin.com', 'connect.garmin.com', 'sso.garmin.com'];

  for (const domain of domains) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const cookie of cookies) {
      await chrome.cookies.remove({
        url: `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`,
        name: cookie.name,
      });
    }
    console.log(`[Garmin Auth] Cleared ${cookies.length} cookies for ${domain}`);
  }
}

// Open Garmin login in browser tab and wait for user to log in
export async function login(): Promise<GarminSession> {
  console.log('[Garmin Auth] Starting browser-tab login');

  // First check if already logged in
  const existing = await checkExistingSession();
  if (existing) {
    console.log('[Garmin Auth] Already authenticated');
    return existing;
  }

  // Open login page in new tab
  return new Promise((resolve, reject) => {
    chrome.tabs.create(
      {
        url: `${GARMIN_CONNECT_URL}/signin`,
        active: true,
      },
      tab => {
        if (!tab.id) {
          reject(new MapyGarminError('Failed to create tab', ErrorCode.AUTH_NETWORK_ERROR));
          return;
        }

        const tabId = tab.id;
        let checkInterval: NodeJS.Timeout;
        let timeoutTimer: NodeJS.Timeout;

        // Check if user logged in
        const checkLogin = async () => {
          try {
            const currentTab = await chrome.tabs.get(tabId);

            if (!currentTab.url) {
              console.log('[Garmin Auth] Tab URL not available yet');
              return;
            }

            console.log('[Garmin Auth] Current tab URL:', currentTab.url);

            // Check if on dashboard (login successful)
            const isGarminConnect = currentTab.url.includes('connect.garmin.com');
            const notSignIn = !currentTab.url.includes('signin');
            const notSSO = !currentTab.url.includes('sso.garmin.com');
            const notEmbedSignIn = !currentTab.url.includes('/embed/');

            if (isGarminConnect && notSignIn && notSSO && notEmbedSignIn) {
              console.log('[Garmin Auth] Login detected!');

              clearInterval(checkInterval);
              clearTimeout(timeoutTimer);

              try {
                const session = await captureSession();
                console.log('[Garmin Auth] Session captured');

                // Pre-fetch profile data (non-blocking)
                getCsrfToken().catch(() => {});

                // Close login tab
                chrome.tabs.remove(tabId);
                console.log('[Garmin Auth] Login tab closed');

                resolve(session);
              } catch (captureError) {
                console.error('[Garmin Auth] Error capturing session:', captureError);
                reject(
                  new MapyGarminError(
                    'Failed to capture session',
                    ErrorCode.AUTH_NETWORK_ERROR
                  )
                );
              }
            }
          } catch (error) {
            console.error('[Garmin Auth] Error in checkLogin:', error);
            clearInterval(checkInterval);
            clearTimeout(timeoutTimer);
            reject(
              new MapyGarminError(
                'Login cancelled or tab closed',
                ErrorCode.AUTH_NETWORK_ERROR
              )
            );
          }
        };

        // Check every 2 seconds
        checkInterval = setInterval(checkLogin, 2000);

        // Timeout after 5 minutes
        timeoutTimer = setTimeout(() => {
          clearInterval(checkInterval);
          chrome.tabs.remove(tabId).catch(() => {});
          reject(
            new MapyGarminError(
              'Login timeout - please try again',
              ErrorCode.AUTH_NETWORK_ERROR
            )
          );
        }, 5 * 60 * 1000);
      }
    );
  });
}

// Check if authenticated
export async function checkAuth(): Promise<{
  isAuthenticated: boolean;
  username?: string;
  expiresAt?: number;
  displayName?: string;
  profileImageUrl?: string;
}> {
  console.log('[Garmin Auth] Checking authentication');

  // Check for existing session first
  const session = await checkExistingSession();

  if (session) {
    // Get stored token for profile data
    const token = await getAuthToken();
    const result = {
      isAuthenticated: true,
      username: token?.displayName || session.username,
      expiresAt: session.expiresAt,
      displayName: token?.displayName,
      profileImageUrl: token?.profileImageUrl,
    };
    console.log('[Garmin Auth] checkAuth returning (with session):', {
      username: result.username,
      hasDisplayName: !!result.displayName,
      hasProfileImage: !!result.profileImageUrl
    });
    return result;
  }

  // Fall back to stored token
  const token = await getAuthToken();

  if (!token) {
    console.log('[Garmin Auth] checkAuth returning: not authenticated');
    return { isAuthenticated: false };
  }

  const result = {
    isAuthenticated: true,
    username: token.displayName || token.username,
    expiresAt: token.expiresAt,
    displayName: token.displayName,
    profileImageUrl: token.profileImageUrl,
  };
  console.log('[Garmin Auth] checkAuth returning (from token):', {
    username: result.username,
    hasDisplayName: !!result.displayName,
    hasProfileImage: !!result.profileImageUrl
  });
  return result;
}

// Logout
export async function logout(): Promise<void> {
  console.log('[Garmin Auth] Logging out');
  await clearAuthToken();
  await clearGarminCookies();
}

// Get session cookies for API requests
export async function getSessionCookies(): Promise<string | null> {
  const token = await getAuthToken();
  return token?.sessionCookies || null;
}

// ============================================================================
// CSRF Token Extraction (Phase 2: Course API Migration)
// ============================================================================

/**
 * Extract social profile data from HTML page
 * Looks for: window.VIEWER_SOCIAL_PROFILE = { ... }
 * Returns null on any failure - never throws
 */
export function extractSocialProfileFromHtml(html: string): { displayName: string; profileImageUrl?: string } | null {
  try {
    console.log('[Garmin Auth] Attempting to extract social profile from HTML');

    // Match window.VIEWER_SOCIAL_PROFILE = { ... }; (allows optional whitespace before semicolon)
    const pattern = /window\.VIEWER_SOCIAL_PROFILE\s*=\s*(\{[\s\S]*?\})\s*;/;
    const match = html.match(pattern);

    if (!match || !match[1]) {
      console.log('[Garmin Auth] VIEWER_SOCIAL_PROFILE not found in HTML');
      // Log if we can find any mention of VIEWER_SOCIAL_PROFILE
      if (html.includes('VIEWER_SOCIAL_PROFILE')) {
        console.log('[Garmin Auth] HTML contains VIEWER_SOCIAL_PROFILE but regex did not match');
        const index = html.indexOf('VIEWER_SOCIAL_PROFILE');
        console.log('[Garmin Auth] Context:', html.substring(Math.max(0, index - 50), index + 200));
      }
      return null;
    }

    console.log('[Garmin Auth] VIEWER_SOCIAL_PROFILE found, parsing JSON');

    // Parse JSON
    const profile = JSON.parse(match[1]);
    console.log('[Garmin Auth] Profile parsed:', {
      hasFullName: !!profile.fullName,
      hasSmallImage: !!profile.profileImageUrlSmall,
      hasMediumImage: !!profile.profileImageUrlMedium
    });

    // Extract fullName
    if (!profile.fullName) {
      console.log('[Garmin Auth] Profile missing fullName field');
      return null;
    }

    // Extract profile image URL (prefer small, fallback to medium)
    let profileImageUrl = profile.profileImageUrlSmall || profile.profileImageUrlMedium;

    // Validate as defense-in-depth (primary protection is in popup.ts)
    if (profileImageUrl) {
      try {
        profileImageUrl = validateImageUrl(profileImageUrl, ['garmin.com', 'amazonaws.com']);
      } catch (error) {
        console.warn('[Garmin Auth] Invalid profile image URL from API, discarding');
        profileImageUrl = undefined;
      }
    }

    const result = {
      displayName: profile.fullName,
      profileImageUrl,
    };

    console.log('[Garmin Auth] Profile extraction successful:', result);
    return result;
  } catch (error) {
    // Never throw - return null on any error
    console.error('[Garmin Auth] Error extracting social profile:', error);
    return null;
  }
}

/**
 * Extract CSRF token from HTML page
 * Looks for: <meta name="csrf-token" content="...">
 */
export function extractCsrfTokenFromHtml(html: string): string {
  // Match meta tag with csrf-token name
  // Handles multiple formats and attribute orders
  const patterns = [
    // Standard format with name first
    /<meta\s+name="csrf-token"\s+content="([^"]+)"/i,
    // Standard format with content first
    /<meta\s+content="([^"]+)"\s+name="csrf-token"/i,
    // Single quotes
    /<meta\s+name='csrf-token'\s+content='([^']+)'/i,
    /<meta\s+content='([^']+)'\s+name='csrf-token'/i,
    // Mixed quotes or attributes with extra spaces
    /csrf-token["']\s*content\s*=\s*["']([^"']+)/i,
    // Reverse: content first with mixed quotes
    /content\s*=\s*["']([^"']+)["']\s+name\s*=\s*["']csrf-token/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      console.log('[Garmin Auth] Token found with pattern:', pattern);
      return match[1];
    }
  }

  // Log helpful debug info
  console.error('[Garmin Auth] CSRF token patterns not matched');
  console.error('[Garmin Auth] Searching for "csrf" in HTML:', html.toLowerCase().includes('csrf'));
  console.error('[Garmin Auth] Searching for "token" in HTML:', html.toLowerCase().includes('token'));

  throw new MapyGarminError('CSRF token not found in page', ErrorCode.AUTH_NETWORK_ERROR);
}

/**
 * Get CSRF token from Garmin Connect
 * Fetches page and extracts token from meta tag
 * Reference: test-course-api.js lines 196-254
 */
export async function getCsrfToken(): Promise<string> {
  console.log('[Garmin Auth] Fetching CSRF token');

  try {
    const response = await fetch(`${GARMIN_CONNECT_URL}/modern`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authenticated session
      redirect: 'follow', // Explicitly follow redirects
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // Log final URL after redirects
    console.log('[Garmin Auth] Final URL:', response.url);
    console.log('[Garmin Auth] Response status:', response.status);

    // Check if authenticated
    if (response.status === 401) {
      throw new MapyGarminError('Not authenticated with Garmin Connect', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    // Check if redirected to login
    if (response.url.includes('sso.garmin.com') || response.url.includes('/signin')) {
      throw new MapyGarminError('Session expired - redirected to login', ErrorCode.AUTH_SESSION_EXPIRED);
    }

    if (!response.ok) {
      throw new MapyGarminError(
        `Failed to fetch CSRF token: HTTP ${response.status}`,
        ErrorCode.AUTH_NETWORK_ERROR
      );
    }

    // Get HTML content
    const html = await response.text();
    console.log('[Garmin Auth] Received HTML length:', html.length);
    console.log('[Garmin Auth] HTML preview:', html.substring(0, 500));

    // Extract social profile data
    const socialProfile = extractSocialProfileFromHtml(html);
    if (socialProfile) {
      console.log('[Garmin Auth] Social profile extracted:', socialProfile.displayName);
      const token = await getAuthToken();
      if (token) {
        token.displayName = socialProfile.displayName;
        token.profileImageUrl = socialProfile.profileImageUrl;
        token.username = socialProfile.displayName;
        await saveAuthToken(token);
        console.log('[Garmin Auth] Profile data saved to token:', {
          displayName: token.displayName,
          hasProfileImage: !!token.profileImageUrl
        });
      } else {
        console.log('[Garmin Auth] No stored token found to save profile data to');
      }
    } else {
      console.log('[Garmin Auth] Social profile extraction returned null');
    }

    // Extract token from HTML
    const token = extractCsrfTokenFromHtml(html);
    console.log('[Garmin Auth] CSRF token extracted:', token.substring(0, 10) + '...');

    return token;
  } catch (error) {
    console.error('[Garmin Auth] Error fetching CSRF token:', error);

    if (error instanceof MapyGarminError) {
      throw error;
    }

    throw new MapyGarminError(
      'Failed to fetch CSRF token: ' + (error as Error).message,
      ErrorCode.AUTH_NETWORK_ERROR
    );
  }
}
