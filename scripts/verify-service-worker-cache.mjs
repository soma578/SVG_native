import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const handlers = new Map()
const deleted = []
const caches = {
  keys: async () => ['svgmap-shell-old', 'svgmap-runtime-old', 'svgmap-tiles-v2'],
  delete: async (name) => { deleted.push(name); return true },
}
const self = {
  location: { origin: 'https://map.example' },
  clients: { claim: async () => {}, matchAll: async () => [] },
  skipWaiting: async () => {},
  addEventListener: (name, callback) => handlers.set(name, callback),
}
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
  self, caches, URL, Request, Response, AbortController,
  setTimeout, clearTimeout, fetch: async () => new Response('ok'),
})

async function dispatch(url, mode = 'cors', method = 'GET') {
  let responsePromise
  handlers.get('fetch')({
    request: { url, mode, method },
    respondWith: (response) => { responsePromise = Promise.resolve(response) },
  })
  return responsePromise
}

assert.equal(await dispatch('https://map.example/svgmap.html', 'navigate'), undefined,
  'Top-level navigation must use the network, never an old map shell')
assert.equal(await dispatch('https://map.example/svgmapAppLayers/controller.html', 'navigate'), undefined,
  'A failed controller iframe must never receive the map shell')
assert.equal(await dispatch('https://map.example/svgmap-bootstrap.js'), undefined,
  'Application JS must not be served from the Service Worker cache')
assert.equal(await dispatch('https://map.example/svgmapAppLayers/Container.svg'), undefined,
  'Application SVG must not be served from the Service Worker cache')
assert.equal((await dispatch('https://map.example/api/mizupigui')).status, 200,
  'Live water-stake data must bypass Service Worker caches')

let activation
handlers.get('activate')({ waitUntil: (promise) => { activation = promise } })
await activation
assert.deepEqual(deleted.sort(), ['svgmap-runtime-old', 'svgmap-shell-old'],
  'Old shell/runtime caches must be removed during activation')

console.log('[service-worker-cache] navigation, iframe, JS, SVG bypass and old-cache cleanup passed')
