const module = await import('/svgmapjs/SVGMapLv0.1_r18module.js')
window.svgMap = module.svgMap
const { CorsProxy } = await import('/svgmapjs/CorsProxyModule.js')
const corsProxy = new CorsProxy()
corsProxy.setService('/api/cors-proxy?url=', null, true, true)
window.corsProxy = corsProxy
window.svgMap.setProxyURLFactory(null, null, null, corsProxy.getURLfunction(), true)
if (window.svgMap.setDefaultHilightStyle) {
  window.svgMap.setDefaultHilightStyle({ fill: { color: '', lineWidth: 2, lineColor: 'red' } })
}
const showCacheStatus = (message, danger = false) => {
  let status = document.getElementById('svgMapCacheStatus')
  if (!status) {
    status = document.createElement('div')
    status.id = 'svgMapCacheStatus'
    status.setAttribute('role', 'status')
    Object.assign(status.style, {
      position: 'fixed', top: '42px', left: '50%', zIndex: '2000',
      maxWidth: 'calc(100% - 24px)', padding: '7px 12px', border: '1px solid #9a6700',
      borderRadius: '4px', background: '#fff3bf', color: '#5f3b00',
      font: 'bold 12px sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,.2)',
      transform: 'translateX(-50%)',
    })
    document.body.appendChild(status)
  }
  status.style.display = message ? 'block' : 'none'
  status.style.borderColor = danger ? '#b42318' : '#9a6700'
  status.style.background = danger ? '#fee4e2' : '#fff3bf'
  status.style.color = danger ? '#7a271a' : '#5f3b00'
  status.textContent = message
}

const cacheTimestamp = (value) => {
  const date = new Date(value || '')
  return Number.isNaN(date.getTime()) ? '保存時刻不明' : date.toLocaleString('ja-JP')
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const message = event.data || {}
    if (message.type === 'SVG3_CACHE_FALLBACK') {
      showCacheStatus(`通信できないため保存済みの${message.label}を表示（保存: ${cacheTimestamp(message.cachedAt)}）`, true)
    } else if (message.type === 'SVG3_CACHE_FRESH' && navigator.onLine) {
      showCacheStatus('')
    }
  })
  window.addEventListener('offline', () => {
    showCacheStatus('オフラインです。取得済みの地図・データを使用します', true)
  })
  window.addEventListener('online', () => showCacheStatus('オンラインに復帰しました'))
  if (!navigator.onLine) {
    showCacheStatus('オフラインです。取得済みの地図・データを使用します', true)
  }
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.info('[host] service worker unavailable', error)
  })
}

// Start loading layers only after the cache listener is ready. Dynamic CSV and
// image fallbacks can otherwise arrive before the page can surface the warning.
window.svgMap.initLoad()
