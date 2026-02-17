# Mapy.cz Internal API & JS Globals

Reverse-engineered on 2026-02-17 via Chrome DevTools on `https://mapy.com` with a route loaded in the planner (`?planovani-trasy`).

---

## Global objects available on mapy.com

```js
// Confirmed present (route planner context)
window.Loader   // object  — Seznam's AMD-like module loader
window.SMap     // function — the SMap map/API library (constructor)
window.JAK      // object  — JavaScript Application Kit (Seznam utility lib)
```

No React, no Vue, no Redux store exposed on `window`. The planner app state lives inside Loader bundles (`single`, `multi`) and is not directly accessible.

---

## `SMap.Coords` — coordinate codec

This is the key class for working with Mapy.cz's URL coordinate encoding.

### Encoding format

The URL parameter `rc` encodes waypoints as a concatenated string:

- **First waypoint**: always 10 characters (absolute encoding)
- **Subsequent waypoints**: variable length, shorter than 10 chars (delta encoding relative to previous waypoint)

The export API (`tplannerexport`) uses `rg` parameters instead, one per waypoint, **always 10 characters each** (absolute encoding only). Naively splitting `rc` every 10 chars fails when delta-encoded waypoints are present.

**Example** (3 waypoints: Šumperk → coordinate pin → Hrabišín):

| Source | Value |
|--------|-------|
| URL `rc` | `9n6UvxXMp-9nUgtxXBwximCbK7` |
| `rg[0]` (Šumperk)   | `9n6UvxXMp-` (10 chars, absolute — same as first 10 of `rc`) |
| `rg[1]` (pin)       | `9nUgtxXBwx` (10 chars, absolute — same as chars 11–20 of `rc`) |
| `rg[2]` (Hrabišín)  | `9nYTvxWyHk` (10 chars, absolute — decoded from delta `imCbK7` in `rc`) |

### Key static methods

```js
// Decode a full rc string (with delta encoding) → array of SMap.Coords instances
const coords = SMap.Coords.stringToCoords(rc);
// → e.g. [ SMap.Coords, SMap.Coords, SMap.Coords ]

// Encode a single SMap.Coords instance → 10-char absolute rg string
const rg = SMap.Coords.coordsToString([coords[0]]);
// → e.g. '9n6UvxXMp-'

// Access the encoding alphabet
SMap.Coords._alphabet  // string

// Other static constructors (not used by us)
SMap.Coords.fromWGS84(lon, lat)
SMap.Coords.fromPP(...)
SMap.Coords.fromEvent(...)
```

### Key prototype methods

```js
const c = coords[0];
c.toWGS84()    // → [lon, lat]  e.g. [16.9706, 49.9653]
c.toString()   // → "(lon,lat)"
c.isValid()    // → boolean
c.clone()      // → SMap.Coords
c.distance(other)  // → metres
```

### Verified decoding round-trip (DevTools console)

```js
const rc = '9n6UvxXMp-9nUgtxXBwximCbK7';
const coords = SMap.Coords.stringToCoords(rc);
// coords.length → 3

coords.map(c => c.toWGS84());
// [0] → [16.970607340335846, 49.96528320014477]  (Šumperk)
// [1] → [17.015836089849472, 49.92994040250778]  (coordinate pin)
// [2] → [17.036353647708893, 49.91405166685581]  (Hrabišín)

coords.map(c => SMap.Coords.coordsToString([c]));
// [0] → '9n6UvxXMp-'
// [1] → '9nUgtxXBwx'
// [2] → '9nYTvxWyHk'   ← decoded from delta 'imCbK7' in the original rc ✓
```

---

## `SMap.Route` — route planner class

### Why not used

`SMap.Route` represents a route planning request (finds the path between waypoints). It is **not** the same as the GPX export. While its prototype has useful-looking methods (`getCoords`, `_buildParams`, `_buildUrl`), the live route instance is not exposed on any global or DOM element — it lives inside the planner app's closure.

```js
// Static factory — creates a NEW route request (requires coords array)
SMap.Route.route(coords, params)
// → SMap.Route instance (sends a routing API request, does not return the current page route)

// Prototype methods (on instances)
SMap.Route.prototype.getCoords()     // waypoint SMap.Coords[]
SMap.Route.prototype._buildParams()  // builds routing API params
SMap.Route.prototype._buildUrl()     // builds routing API URL
SMap.Route.prototype.send()          // fires the route request
SMap.Route.prototype.getResults()    // parsed route response
```

### Why SMap.Coords is sufficient

The GPX export only needs waypoint coordinates (the `rg` param) plus the stop types and IDs (`rs`, `ri`) already present in the page URL. `SMap.Coords.stringToCoords` gives us the correctly decoded waypoints without needing the live `SMap.Route` instance.

---

## `window.Loader` — module system

Seznam's module loader. Modules are loaded from bundles; the internal module registry is not exposed.

```js
Loader.base      // string — CDN base URL
Loader.mode      // string
Loader.lang      // string
Loader.version   // string
Loader.async     // boolean
Loader.apiKey    // string
Loader.load()    // loads a module or file
Loader._files    // object — only 3 keys: 'css', 'single', 'multi' (the loaded bundles)
```

---

## `rwp` / `rp_aw` — route waypoints path data

The URL parameter `rwp` encodes the computed route path for **coordinate-only and mixed coordinate/named routes**. It is passed as `rp_aw` to `tplannerexport`.

**When present:** routes where at least one waypoint is a coordinate pin (`rs=coor`) AND the route has been computed. The value is opaque (e.g. `1;9nayVxXJPFMuflE`).

**When absent:** named-waypoint-only routes (all `rs=muni`).

**Required by export API:** yes, when present in the page URL — omitting it causes HTTP 500.

### Example (coordinate → coordinate)

| Source | Value |
|--------|-------|
| Page URL `rc` | `9naLtxXJkLg.0f1Z` (18 chars — second waypoint is 6-char delta `g.0f1Z`) |
| Page URL `rwp` | `1;9nayVxXJPFMuflE` |
| Export `rg[0]` | `9naLtxXJkL` (absolute, same as rc[0:10]) |
| Export `rg[1]` | `9nbKtxXJKj` (decoded from delta `g.0f1Z` via `SMap.Coords.stringToCoords`) |
| Export `rp_aw` | `1;9nayVxXJPFMuflE` (forwarded directly from `rwp`) |

### Key insight: `rwp` presence does NOT indicate delta-free `rc`

Early implementation used `rwp` presence as a proxy for "safe to split rc every 10 chars". This was wrong — coordinate→coordinate routes have **both** `rwp` AND a delta-encoded `rc`. Always decode via `SMap.Coords.stringToCoords`.

---

## `tplannerexport` API

**Endpoint:** `https://mapy.com/api/tplannerexport`

**Method:** GET (browser sends cookies automatically — Mapy.cz session required)

### Parameters

| Param | Source | Notes |
|-------|--------|-------|
| `export` | constant `gpx` | Format |
| `lang` | constant `en,cs` | Language |
| `rp_c` | `mrp.c` from URL | Route profile (e.g. `121` = cycling) |
| `rg` | decoded from `rc` via `SMap.Coords` | One per waypoint, 10-char absolute; **repeat param** |
| `rs` | `rs` from URL | Stop type (`muni`, `coor`, …); **repeat param** |
| `ri` | `ri` from URL | Stop ID (empty string for coordinate pins); **repeat param** |
| `rp_aw` | `rwp` from URL (optional) | Route waypoints path data — required when `rwp` is present; omitting causes HTTP 500 |
| `rut` | `rut` from URL (optional) | Route update token |
| `rand` | random float | Cache buster |

### Example URL

```
https://mapy.com/api/tplannerexport
  ?export=gpx
  &lang=en%2Ccs
  &rp_c=121
  &rg=9n6UvxXMp-
  &rg=9nUgtxXBwx
  &rg=9nYTvxWyHk
  &rs=muni
  &rs=coor
  &rs=muni
  &ri=166
  &ri=
  &ri=275
  &rand=0.550694...
```

---

## How this is used in the extension

`src/content/fetch-interceptor.ts` runs in **MAIN world** (`"world": "MAIN"` in manifest) to access `window.SMap`. The ISOLATED content script (`mapy-content.ts`) triggers it via `window.postMessage`. See the code and `CHANGELOG.md` for the full flow.
