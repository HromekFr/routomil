// Route name extraction from mapy.cz

// Try to extract route name from the page
export function extractRouteName(): string | null {
  console.log('[Routomil] extractRouteName: starting, url =', window.location.href);
  console.log('[Routomil] extractRouteName: document.title =', document.title);

  // Strategy 1: Look for input fields with route name
  const nameInput = document.querySelector(
    'input[placeholder*="name" i], input[placeholder*="název" i], input[name*="name" i]'
  ) as HTMLInputElement;
  console.log('[Routomil] extractRouteName: S1 nameInput =', nameInput, 'value =', nameInput?.value);
  if (nameInput?.value?.trim()) {
    const result = nameInput.value.replace(/\s+/g, ' ').trim();
    console.log('[Routomil] extractRouteName: returning from S1 =', result);
    return result;
  }

  // Strategy 2: Try various selectors for route name
  const selectors = [
    '.route-header__title',
    '.route-panel__title',
    '[data-testid="route-name"]',
    '.planning-panel h2',
    '.route-title',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    console.log(`[Routomil] extractRouteName: S2 selector="${selector}" element=`, element);
    if (!element) continue;

    const childTexts: string[] = [];
    element.childNodes.forEach(node => {
      const t = node.textContent?.replace(/\s+/g, ' ').trim();
      if (t) childTexts.push(t);
    });
    const text = childTexts.join(' ').replace(/\s+/g, ' ').trim();
    console.log(`[Routomil] extractRouteName: S2 selector="${selector}" text=`, JSON.stringify(text));

    if (text && text.length > 0 && text.length < 100) {
      console.log('[Routomil] extractRouteName: returning from S2 =', text);
      return text;
    }
  }

  // Strategy 3: Parse document.title — mapy.cz sets it to e.g.
  // "Bike route: Šumperk, Czechia ⇒ Brno, Czechia • Mapy.com"
  // Extract start and end city names and format as "Route from X to Y"
  const titleRaw = document.title.trim();
  console.log('[Routomil] extractRouteName: S3 title =', JSON.stringify(titleRaw));
  const arrowMatch = titleRaw.match(/(?:.*:\s*)?(.+?)\s*⇒\s*(.+?)(?:\s*[•·].*)?$/);
  console.log('[Routomil] extractRouteName: S3 arrowMatch =', arrowMatch);
  if (arrowMatch) {
    const startName = arrowMatch[1].split(',')[0].trim();
    const endName = arrowMatch[2].split(',')[0].trim();
    if (startName && endName) {
      const result = `Route from ${startName} to ${endName}`;
      console.log('[Routomil] extractRouteName: returning from S3 (title arrow) =', result);
      return result;
    }
  }

  // Strategy 4: Extract from URL query parameters
  const urlMatch = window.location.href.match(/[?&]q=([^&]+)/);
  console.log('[Routomil] extractRouteName: S4 urlMatch =', urlMatch);
  if (urlMatch) {
    const result = decodeURIComponent(urlMatch[1]);
    console.log('[Routomil] extractRouteName: returning from S4 (url q=) =', result);
    return result;
  }

  // Strategy 5: Check URL for route ID
  const routeIdMatch = window.location.href.match(/route[=/]([^&/]+)/i);
  console.log('[Routomil] extractRouteName: S5 routeIdMatch =', routeIdMatch);
  if (routeIdMatch) {
    const result = `Route ${routeIdMatch[1]}`;
    console.log('[Routomil] extractRouteName: returning from S5 (routeId) =', result);
    return result;
  }

  // Fallback: Use today's date
  const result = `Mapy.cz Route ${new Date().toLocaleDateString()}`;
  console.log('[Routomil] extractRouteName: returning from fallback =', result);
  return result;
}
