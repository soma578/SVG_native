const isDevelopment = location.hostname === 'localhost' || location.hostname === '127.0.0.1'

// A previously installed production worker must not hide source edits while developing.
if (isDevelopment && 'serviceWorker' in navigator) {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

const module = await import('/svgmapjs/SVGMapLv0.1_r18module.js')
window.svgMap = module.svgMap
const { CorsProxy } = await import('/svgmapjs/CorsProxyModule.js')
const corsProxy = new CorsProxy()
corsProxy.setService('https://service.svgmap.org/corsaw/', null, true, false)
window.corsProxy = corsProxy
window.svgMap.setProxyURLFactory(null, null, null, corsProxy.getURLfunction(), true)
if (window.svgMap.setDefaultHilightStyle) {
  window.svgMap.setDefaultHilightStyle({ fill: { color: '', lineWidth: 2, lineColor: 'red' } })
}
window.svgMap.initLoad()

// Production keeps the existing repository service worker and offline shell.
if (!isDevelopment && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.info('[host] service worker unavailable', error)
    })
  })
}
