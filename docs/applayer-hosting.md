# AppLayer hosting policy

`svgmapAppLayers` is treated as a collection of optional WebApp layers, not as
a promise that every copied layer works without host-side dependencies.

## Fetch boundaries

- `/api/cors-proxy` is an anonymous, GET/HEAD-only relay for known public data
  sources. Its rules live in `app/api/cors-proxy/policy.js` and validate every
  redirect again.
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

- `/api/cors-proxy` is network-only in the Service Worker. Current weather,
  river, road, and similar responses must not use the runtime cache's
  stale-while-revalidate behavior.
- `authoringLayers/bbs` remains in the upstream source snapshot but is excluded
  from generated `public/` assets because it assumes a writable PHP backend.
- CDN `@latest` references to `svgMapLayerLib.js` are rewritten in generated
  AppLayer assets to `/svgmapjs/svgMapLayerLib.js`. Other third-party libraries
  remain layer-specific dependencies and should be pinned as layers are
  promoted to supported status.
- PHP and API-specific backends are not handled by the generic CORS relay.
  Yahoo Geocoder, K-NET, and eMAFF are marked or documented as requiring a
  dedicated backend before they can be supported on Vercel.

## Auditing

Run `npm run audit:applayers` after importing upstream changes. It inventories
files that explicitly call `getCORSURL()`, candidate external hosts outside the
allowlist, and PHP backend files. This is a static dependency audit; a future
browser-based compatibility job should additionally toggle every Container
layer and classify network, console, timeout, and backend failures.
