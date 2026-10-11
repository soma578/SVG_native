# AppLayer hosting policy

`svgmapAppLayers` is treated as a collection of optional WebApp layers, not as
a promise that every copied layer works without host-side dependencies.

## Fetch boundaries

- `/api/cors-proxy` is an anonymous, GET/HEAD-only relay for known public data
  sources. Its rules live in `app/api/cors-proxy/policy.js` and validate every
  redirect again. Each policy also has a response-size ceiling; both declared
  `Content-Length` and streamed bytes are checked.
- User-entered KML, CSV, vector, raster, and XYZ URLs are not accepted by the
  public relay. They work only when the source itself permits browser CORS. A
  future relay for arbitrary URLs must be authenticated and isolated.
- The LaWA fetch/XHR proxy (the sixth `setProxyURLFactory` argument) is left
  unset. Enabling it globally would also rewrite POST requests, credentials,
  API keys, and already-CORS-capable requests into a GET/HEAD-only relay.
- Plain HTTP is allowed only for image paths on official `*.mlit.go.jp` hosts,
  covering the mixed-content fallback used by river-camera layers without
  creating a general HTTP proxy.

## Delivery boundaries

- App HTML, JS, SVG, and navigation are network-only in the Service Worker;
  browser HTTP caching revalidates them. Old shell/runtime caches are removed
  when the new worker activates, and the worker no longer reloads open tabs.
  This favors version consistency over offline app startup. Map tiles and a
  small set of selected data sources retain explicit caches.
- `/api/cors-proxy` is network-only in the Service Worker. Current weather,
  river, road, and similar responses must not use stale cache entries.
- Proxy responses override browser and edge-cache headers with `no-store` for
  `Cache-Control`, `CDN-Cache-Control`, and `Vercel-CDN-Cache-Control`.
  Upstream compression and hop-by-hop headers are not forwarded. In
  particular, `Content-Encoding` and `Content-Length` are omitted because the
  runtime may have decoded the streamed body.
- The 15-second upstream timeout covers connection and response-header setup.
  It is cleared as soon as `fetch()` returns; streaming is then bounded by the
  per-policy byte ceiling and platform execution limits.
- Browser requests carrying a cross-site `Origin`, `Referer`, or
  `Sec-Fetch-Site` value are rejected. Responses use
  `Cross-Origin-Resource-Policy: same-origin`. These controls reduce casual
  relay abuse but are not authentication or a substitute for platform rate
  limits.
- `CorsProxy` receives `location.origin` as a direct-access prefix so an
  AppLayer that absolute-izes a local URL does not send the host back through
  its own allowlist proxy.
- `authoringLayers/bbs` remains in the upstream source snapshot but is excluded
  from generated `public/` assets because it assumes a writable PHP backend.
- CDN `@latest` references to `svgMapLayerLib.js` are rewritten in generated
  AppLayer assets to `/svgmapjs/svgMapLayerLib.js`. Other third-party libraries
  remain layer-specific dependencies and should be pinned as layers are
  promoted to supported status.
- API-specific POST backends remain separate from the generic CORS relay.
  `/api/jma-earthquake`, `/api/knet/tokens`, `/api/knet/data`, and `/api/maff`
  have fixed upstream targets, same-origin caller checks, input validation,
  size ceilings, timeouts, and `no-store` responses. They do not accept an
  arbitrary destination URL.
- Yahoo Geocoder remains disabled until the operator supplies a Yahoo Client
  ID. The six legacy MSIL/`海しる` layers are marked
  `EXTERNAL_API_CHANGED`: their token endpoint was retired and now redirects
  to the portal. `/api/msil-token` deliberately reports HTTP 410.
- Requests to the legacy `www.gsi.go.jp` server use TLS compatibility mode
  only for that exact allowlisted hostname. Other proxy policies continue to
  use the standard Fetch transport.

## Managed data layers

- `/api/chugoku-outages` reads the official current-outage index, the
  municipality-detail paths for prefecture codes 31 through 35, and the
  official standard/short-outage history for the available past week. It
  normalizes current and restored events, rejects records outside the five
  Chugoku prefectures, and keeps a four-minute warm-instance cache while all
  browser/CDN response caches remain `no-store`.
- Direct acquisition is the default. If the official server blocks Vercel
  egress, set `CHUGOKU_OUTAGE_RELAY_URL` and
  `CHUGOKU_OUTAGE_RELAY_TOKEN`. The relay must use a fixed approved IP, require
  the bearer token, return raw HTML, and allow only the path shapes shown
  in `.env.example`; do not expose a general URL relay or this workstation.
- The Okayama landslide layer is fully static at runtime. The versioned
  `candidates.json` snapshot supplies each feature's centre pin and attributes;
  `geometry/steep.svg` and `geometry/debris.svg` contain filled polygons fetched
  from the official GIS `Map/GetFeature` endpoint during import. Browsers never
  contact the prefectural GIS to display the layer.
- Geometry uses two levels of detail. Wide views load only the approximately
  30-metre simplified overview SVGs and draw all feature centres into one
  canvas image. Close views load the approximately 2-metre detailed compound
  paths and replace the canvas with clickable pins. The SVGs use fewer than 100
  path nodes rather than one DOM node per feature.
- Run `npm run data:okayama-landslide` only when the prefecture updates the
  feature list. The importer agrees to the official GIS terms, pages through
  both categories, and refuses to write unless the official totals are exactly
  16,794 steep-slope plus 2,868 debris-flow records.
- Run `npm run data:okayama-landslide-geometry` after updating the feature list.
  The importer checkpoints individual geometries in the gitignored cache and
  validates every response as a polygon before replacing the two static SVGs.

## Auditing

Run `npm run audit:applayers` after importing upstream changes. It inventories
files that explicitly call `getCORSURL()`, candidate external hosts outside the
allowlist, and PHP backend files.

Run `npm run audit:applayers:browser` for the dynamic audit. It toggles root
layers through `setLayerVisibility`, waits for `zoomPanMapCompleted` or a quiet
window (never `networkidle`), and writes `artifacts/applayer-audit/report.json`.
Useful environment variables are:

- `APPLAYER_AUDIT_LEVEL=1|2|3`: bootstrap, automatic data, or recipe-driven
  interaction audit. Level 3 recipes live in
  `tests/fixtures/applayer-audit-recipes.json`.
- `APPLAYER_AUDIT_BASE_URL=https://preview.example`: audit a Vercel Preview;
  without it Playwright starts the local Next development server.
- `APPLAYER_AUDIT_FILTER=警察庁` and `APPLAYER_AUDIT_LIMIT=10`: select a
  reproducible subset for diagnosis or CI sharding.
- `APPLAYER_AUDIT_PRIOR_REPORT=artifacts/...json` together with
  `APPLAYER_AUDIT_PRIOR_CATEGORIES=PROXY_POLICY_MISS,UPSTREAM_5XX`: retest only
  categories selected from an earlier report.
- `APPLAYER_AUDIT_TIMEOUT_MS=30000`: per-layer ceiling. The default is 20s.
- `APPLAYER_AUDIT_FAIL_ON=JS_ERROR,LOCAL_ASSET_404`: optional categories that
  make the reporting job fail.

The report distinguishes pass/no-visible-data, configuration or credential
requirements, retired external APIs, dedicated-backend requirements,
proxy-policy misses, upstream HTTP failures, timeouts, request failures,
JavaScript errors, and missing local assets. Run both local and Preview audits
before treating the compatibility table as authoritative.
