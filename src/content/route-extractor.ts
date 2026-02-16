// Route name extraction from mapy.cz

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
