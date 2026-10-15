// Safe host-level POI renderer based on svgMapDemo's customShowPoiProperty.
// Metadata is inserted as DOM text; only validated HTTP(S) URLs become links.
// SPDX-License-Identifier: MPL-2.0
(() => {
  const imagePath = /\.(?:gif|jpe?g|png|svg|webp)$/i

  function appendCell(row, value, header = false) {
    const cell = document.createElement(header ? 'th' : 'td')
    cell.textContent = value == null || value === '' ? '--' : String(value)
    cell.style.wordBreak = 'break-all'
    row.appendChild(cell)
    return cell
  }

  function parseWebUrl(value) {
    const raw = String(value)
    const localImage = /^\/api\/(?:private-sheet-image|drive-image)\?/.test(raw)
    if (!/^https?:\/\//i.test(raw) && !localImage) return null
    try {
      const url = new URL(raw, window.location.origin)
      if (!['http:', 'https:'].includes(url.protocol)) return null
      if (localImage && url.origin !== window.location.origin) return null
      return url
    } catch {
      return null
    }
  }

  function imageSource(url, fieldName) {
    const imageField = /image|photo|写真|画像|カメラ/i.test(fieldName)
    if (!imageField) return imagePath.test(url.pathname) ? url.href : null
    const riverCamera = url.protocol === 'https:' && url.hostname === 'cam.river.go.jp'
      ? url.pathname.match(/^\/cam\/now\/([A-Za-z0-9_-]{1,80})\.jpg$/) : null
    if (riverCamera) return `/api/river-camera-image?id=${encodeURIComponent(riverCamera[1])}`
    if (url.origin === window.location.origin &&
        ['/api/private-sheet-image', '/api/drive-image'].includes(url.pathname)) return url.href
    if (url.hostname === 'drive.google.com' && url.protocol === 'https:') {
      const id = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1]
        || (url.pathname === '/open' ? url.searchParams.get('id') : null)
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null
      const preview = new URL('/api/drive-image', window.location.origin)
      preview.searchParams.set('id', id)
      const resourceKey = url.searchParams.get('resourcekey')
      if (resourceKey && /^[A-Za-z0-9_-]+$/.test(resourceKey)) preview.searchParams.set('resourcekey', resourceKey)
      return preview.href
    }
    return imagePath.test(url.pathname) ? url.href : null
  }

  function appendValue(cell, value, fieldName = '') {
    const text = value == null || value === '' ? '--' : String(value)
    const url = parseWebUrl(text)
    if (!url) {
      cell.textContent = text
      return
    }

    const source = imageSource(url, fieldName)
    const link = document.createElement('a')
    link.href = url.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = source ? '画像を開く' : /公式|official/i.test(fieldName) ? '公式ページを開く' : 'リンクを開く'
    cell.appendChild(link)

    if (source) {
      const image = document.createElement('img')
      image.alt = fieldName || '画像'
      // A property panel is opened by an explicit click; load its image now.
      image.loading = 'eager'
      image.referrerPolicy = 'no-referrer'
      image.style.cssText = 'display:block;max-width:100%;max-height:360px;object-fit:contain;opacity:1'
      image.addEventListener('error', () => {
        image.remove()
        const notice = document.createElement('span')
        notice.textContent = '画像を表示できません。リンクから確認してください。'
        notice.style.display = 'block'
        cell.appendChild(notice)
      }, { once: true })
      image.src = source.startsWith('http:') ? window.svgMap.getCORSURL(source) : source
      cell.appendChild(image)
    }
  }

  function appendRow(table, name, value) {
    const row = document.createElement('tr')
    appendCell(row, name)
    const valueCell = document.createElement('td')
    valueCell.style.wordBreak = 'break-all'
    appendValue(valueCell, value, name)
    row.appendChild(valueCell)
    table.appendChild(row)
  }

  function isOkayamaLayer(layerName) {
    if (!layerName) return false
    try {
      const layer = window.svgMap.getRootLayersProps()
        .find((item) => item.title === layerName)
      return Boolean(layer && window.svgMap.getLayer(layer.id)
        ?.getAttribute('class')?.split(/\s+/).includes('岡山大学'))
    } catch { return false }
  }

  function customShowPoiProperty(target) {
    const table = document.createElement('table')
    table.style.cssText = 'table-layout:fixed;width:100%;border:solid orange;border-collapse:collapse;font-size:12px'
    table.setAttribute('border', '1')

    const heading = document.createElement('tr')
    const nameHeading = appendCell(heading, 'name', true)
    nameHeading.style.width = '25%'
    appendCell(heading, 'value', true)
    table.appendChild(heading)

    const content = target.getAttribute('content')
    if (content != null) {
      const metadata = window.svgMap.parseEscapedCsvLine(content)
      const schema = target.ownerDocument.documentElement.getAttribute('property')?.split(',') || []
      const title = target.getAttribute('data-title')
      const layerName = target.getAttribute('data-layername')
      if (title || layerName) appendRow(table, 'title/Layer', isOkayamaLayer(layerName) || title === layerName
        ? layerName : [title, layerName].filter(Boolean).join('/'))
      metadata.forEach((value, index) => appendRow(table, schema[index] || String(index), value))
    } else {
      for (const attribute of target.attributes) appendRow(table, attribute.name, attribute.value)
    }

    const hyperlink = window.svgMap.getHyperLink(target)
    if (hyperlink?.href) appendRow(table, 'link', hyperlink.href)
    if (target.hasAttribute('lat')) appendRow(table, 'latitude', target.getAttribute('lat'))
    if (target.hasAttribute('lng')) appendRow(table, 'longitude', target.getAttribute('lng'))

    window.svgMap.showModal(table, 400, 600)
  }

  // Imported by svgmap-bootstrap after svgMap exists and before initLoad().
  window.svgMap.setShowPoiProperty(customShowPoiProperty)
})()
