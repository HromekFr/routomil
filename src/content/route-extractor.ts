// Route name extraction from mapy.cz

// Try to extract route name from the page
export function extractRouteName(): string | null {
  // Strategy 1: Look for input fields with route name
  const nameInput = document.querySelector(
    'input[placeholder*="name" i], input[placeholder*="název" i], input[name*="name" i]'
  ) as HTMLInputElement;
  if (nameInput?.value?.trim()) {
    return nameInput.value.replace(/\s+/g, ' ').trim();
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
    if (!element) continue;

    // Extract text from each direct child node separately, then join with spaces.
    // This handles adjacent inline elements like <span>8:13 h</span><span>128.1 km</span>
    // where textContent would produce "8:13 h128.1 km" with no space.
    const childTexts: string[] = [];
    element.childNodes.forEach(node => {
      const t = node.textContent?.replace(/\s+/g, ' ').trim();
      if (t) childTexts.push(t);
    });
    const text = childTexts.join(' ').replace(/\s+/g, ' ').trim();

    if (text && text.length > 0 && text.length < 100) {
      return text;
    }
  }

  // Strategy 3: Extract from URL query parameters
  const urlMatch = window.location.href.match(/[?&]q=([^&]+)/);
  if (urlMatch) {
    return decodeURIComponent(urlMatch[1]);
  }

  // Strategy 4: Check URL for route ID
  const routeIdMatch = window.location.href.match(/route[=/]([^&/]+)/i);
  if (routeIdMatch) {
    return `Route ${routeIdMatch[1]}`;
  }

  // Fallback: Use today's date
  return `Mapy.cz Route ${new Date().toLocaleDateString()}`;
}
