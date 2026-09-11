const module = await import('/svgmapjs/SVGMapLv0.1_r18module.js')

window.svgMap = module.svgMap
window.svgMap.initLoad()

// Development should always reflect source edits immediately. Production keeps
// the existing offline shell behavior provided by the repository service worker.
if ('serviceWorker' in navigator) {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.info('[host] service worker unavailable', error)
      })
    })
  }
}
