# SVG3 static map assets

These files are vendored from the local SVG3 checkout at
`../SVG3-variants/svgmap-app-layers-host` using
`node scripts/import-svg3-map-assets.mjs`. The Next.js host copies this `map/`
directory into `public/map/` before development and production builds. The
source checkout is not needed in Vercel after the files have been committed.

- `layers/hazard/`: original SVG3 hazard SVGs used by the smaller native SVGMap
  LOD references under `svgmapAppLayers/appLayers/svg3-bosai/hazard/`. Those
  references use absolute `/map/layers/hazard/...` URLs.
- `data/districts/okayama/districts-svg/`: Okayama district boundaries used by
  the team activity area layer. The bundled activity records currently point
  to Okayama. If activity records are added for another region, import that
  region's boundary SVGs too.

The hazard directory is about 288 MiB and the Okayama boundary directory about
19 MiB. These are actual data assets, not symlinks or runtime calls to the
local SVG3 checkout. Run `node scripts/verify-svg3-map-assets.mjs` to confirm
that native hazard references and bundled team activity records resolve.
