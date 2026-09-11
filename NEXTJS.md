# Next.js development host

The Next.js application is a thin delivery adapter around the existing SVGMap
source trees. It does not copy, transpile, or bundle `svgmapjs/` or
`svgmapAppLayers/`.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The Next.js route redirects to `/svgmap.html`,
which is the upstream `svgmap/svgMapDemo` host UI adapted only to load this
repository's `Container.svg` and local `svgmapjs` tree. `predev` creates four
`public/` symlinks pointing to that host HTML, the existing source directories,
and the service worker. On localhost the bootstrap unregisters service workers
so edits are visible without stale shell-cache data.

The upstream UI provides zoom, GPS, center coordinates, scale, permanent links,
the grouped layer list, per-layer controllers, visibility/style controls, and the
SVGMap Custom Layers Manager. Next.js does not reimplement those controls.

Production commands:

```bash
npm run build
npm start
```
