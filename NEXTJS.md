# Next.js development host

The Next.js application is a thin delivery adapter around the existing SVGMap
source trees. It does not copy, transpile, or bundle `svgmapjs/` or
`svgmapAppLayers/`.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. `predev` creates three `public/` symlinks pointing
to the existing source directories and service worker. On localhost the bootstrap
unregisters service workers so edits are visible without stale shell-cache data.

Production commands:

```bash
npm run build
npm start
```
