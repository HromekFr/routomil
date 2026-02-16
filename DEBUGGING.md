# Debugging Guide: User Profile Display

## Issue: Not Seeing Real User Name/Avatar

If you're still seeing "Garmin User" placeholder instead of your real name and profile photo, follow these debugging steps.

## Step 1: Check Service Worker Console

The profile extraction happens in the background service worker. To view logs:

1. **Open Chrome Extensions page:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right)

2. **Find Routomil extension:**
   - Look for "Routomil" in the list
   - Click "Inspect views: service worker" (or "background page")

3. **Check the Console tab** for these log messages:

### Expected Log Sequence (Successful)

```
[Garmin Auth] Fetching CSRF token
[Garmin Auth] Final URL: https://connect.garmin.com/...
[Garmin Auth] Response status: 200
[Garmin Auth] Received HTML length: XXXXX
[Garmin Auth] Attempting to extract social profile from HTML
[Garmin Auth] VIEWER_SOCIAL_PROFILE found, parsing JSON
[Garmin Auth] Profile parsed: {hasFullName: true, hasSmallImage: true, hasMediumImage: true}
[Garmin Auth] Profile extraction successful: {displayName: "Your Name", profileImageUrl: "https://..."}
[Garmin Auth] Social profile extracted: Your Name
[Garmin Auth] Profile data saved to token: {displayName: "Your Name", hasProfileImage: true}
```

### Possible Error Messages

**"VIEWER_SOCIAL_PROFILE not found in HTML"**
- The Garmin page structure may have changed
- Try logging out and back in to get fresh HTML

**"HTML contains VIEWER_SOCIAL_PROFILE but regex did not match"**
- The HTML format changed - check the context log for details
- Report this as a bug

**"Profile missing fullName field"**
- Your Garmin profile may not have a name set
- Check your Garmin Connect profile settings

**"No stored token found to save profile data to"**
- The profile extraction ran before login completed
- This should resolve on next sync or popup open

## Step 2: Check When Profile Data Is Fetched

Profile data is extracted from Garmin HTML in these scenarios:

1. **After Login** - Fire-and-forget `getCsrfToken()` call
2. **During Sync** - When uploading a route (needs CSRF token)
3. **Manual Trigger** - Open popup after logging in

**If you just logged in and don't see your profile:**
- Try syncing a route (this triggers `getCsrfToken()`)
- Or wait and close/reopen the popup

## Step 3: Check Popup Console

To see what data the popup receives:

1. **Open popup** (click extension icon)
2. **Right-click in popup** → "Inspect"
3. **Check Console tab** for:

```
[Popup] showMainView called with auth: {
  username: "Your Name",
  displayName: "Your Name",
  hasProfileImageUrl: true,
  profileImageUrl: "https://s3.amazonaws.com/..."
}
```

**If `hasProfileImageUrl: false`:**
- Profile wasn't extracted yet (see Step 1)
- Or Garmin profile has no avatar image

**If `displayName` is undefined:**
- Profile extraction failed or hasn't run yet

## Step 4: Force Profile Refresh

To manually trigger profile data extraction:

1. Make sure you're logged in to Garmin via the extension
2. Go to a route on mapy.cz
3. Click "Sync to Garmin" button
4. This will call `getCsrfToken()` which extracts profile data
5. Close and reopen the popup

## Step 5: Check Stored Auth Token

To inspect what's actually stored:

1. Open service worker console (Step 1)
2. Run this in console:

```javascript
chrome.storage.local.get('authToken', async (result) => {
  if (!result.authToken) {
    console.log('No auth token found');
    return;
  }

  // Token is encrypted, but we can check if it exists
  console.log('Auth token exists (encrypted):', result.authToken.substring(0, 50) + '...');
});
```

## Step 6: Test Profile Extraction Manually

If you want to test if your Garmin account has the profile data:

1. Open https://connect.garmin.com/modern in a new tab
2. Open DevTools (F12) → Console
3. Run:

```javascript
window.VIEWER_SOCIAL_PROFILE
```

**Expected output:**
```javascript
{
  fullName: "Your Name",
  profileImageUrlSmall: "https://s3.amazonaws.com/...",
  profileImageUrlMedium: "https://s3.amazonaws.com/...",
  // ... other fields
}
```

**If undefined:**
- You might not be logged in
- Or Garmin changed their page structure

## Common Issues & Solutions

### Issue: Profile extracted but not showing in popup

**Check:** Service worker logs show profile saved, but popup shows placeholder

**Solution:**
1. The popup might be caching old auth status
2. Close popup completely and reopen
3. Or reload the extension (`chrome://extensions` → click reload icon)

### Issue: "Garmin User" shows briefly, then updates

**This is normal!** The popup loads before profile data is fetched. After first sync or CSRF token fetch, it will update.

### Issue: Avatar image shows broken icon

**Check popup console for:** `[Popup] Avatar image failed to load`

**Solutions:**
- Image URL might be expired
- Network issue
- CORS policy (unlikely with S3 URLs)
- SVG fallback should appear automatically

## Logging Reference

All log prefixes:
- `[Garmin Auth]` - Background service worker authentication
- `[Popup]` - Popup UI
- `[Garmin API]` - API upload operations

## Need More Help?

If none of the above resolves the issue:

1. Export service worker console logs (right-click → Save as...)
2. Export popup console logs
3. Note: Your Garmin username/email and any profile data
4. Report issue at: https://github.com/anthropics/claude-code/issues

## Quick Debug Checklist

- [ ] Logged in via extension (not just garmin.com)
- [ ] Synced at least one route (triggers CSRF/profile fetch)
- [ ] Service worker console shows "Profile extraction successful"
- [ ] Service worker console shows "Profile data saved to token"
- [ ] Popup console shows `hasProfileImageUrl: true` and `displayName: "..."`
- [ ] Closed and reopened popup after sync
- [ ] https://connect.garmin.com/modern shows window.VIEWER_SOCIAL_PROFILE data
