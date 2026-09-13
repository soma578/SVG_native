# Next.js development host

The Next.js application is a thin delivery adapter around the existing SVGMap
source trees. It does not transpile or bundle `svgmapjs/` or
`svgmapAppLayers/`; the asset preparation step copies them into `public/`.
Both source trees are committed as ordinary directories in this repository,
not gitlinks. This is necessary because `svgmapAppLayers/` contains local CSV
photo and disaster-map additions that are not present in the upstream commit.
The former nested Git metadata is retained locally under
`.submodule-git-backup/` and is intentionally not deployed.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The Next.js route redirects to `/svgmap.html`,
which is the upstream `svgmap/svgMapDemo` host UI adapted only to load this
repository's `Container.svg` and local `svgmapjs` tree. `predev` and `prebuild`
regenerate the service worker from current source files, then copy the host HTML,
`svgmapjs/`, `svgmapAppLayers/`, `map/`, and `sw.js` into `public/`. Internal source
symlinks are copied as regular files and `.git` directories are excluded. This
avoids Vercel's post-build handling of symlinks that point outside `public/`.
Changes to copied source files require rerunning `npm run assets:prepare` (or
restarting `npm run dev`); Next.js will not watch the original source trees.

`map/` contains the original SVG3 hazard polygons referenced by the native
hazard LOD layer and Okayama district boundaries for the team activity area.
See [`map/README.md`](map/README.md) for provenance, size, and regional scope.

The upstream UI provides zoom, GPS, center coordinates, scale, permanent links,
the grouped layer list, per-layer controllers, visibility/style controls, and the
SVGMap Custom Layers Manager. Next.js does not reimplement those controls.

## Offline cache

The first online visit stores the SVGMap application shell in the background.
It also stores map tiles as they are viewed and keeps the last successfully
loaded Google Sheets CSV and Google Drive image responses. Online requests for
the Sheet and Drive images are network-first, so an updated Sheet is used on the
next online reload. Cached dynamic data is used only when the network request
fails, and the map displays an offline/stale-data warning.

The cache is deliberately bounded: 800 same-origin runtime responses, 1,500
visited map tiles, and 50 dynamic Sheet/Drive responses. This is a browser cache,
not a complete offline copy of Japan: an online first visit is required, only
previously viewed tiles are available, and the browser may evict stored data
under storage pressure or when site data is cleared.

Production commands:

```bash
npm run build
npm start
```
