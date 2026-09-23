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
    if (!/^https?:\/\//i.test(String(value))) return null
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) ? url : null
    } catch {
      return null
    }
  }

  function appendValue(cell, value) {
    const text = value == null || value === '' ? '--' : String(value)
    const url = parseWebUrl(text)
    if (!url) {
      cell.textContent = text
      return
    }

    const link = document.createElement('a')
    link.href = url.href
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = url.href
    cell.appendChild(link)

    if (imagePath.test(url.pathname)) {
      const image = document.createElement('img')
      image.alt = ''
      image.loading = 'lazy'
      image.style.cssText = 'display:block;max-width:100%;opacity:1'
      image.src = url.protocol === 'http:' ? window.svgMap.getCORSURL(url.href) : url.href
      cell.appendChild(image)
    }
  }

  function appendRow(table, name, value) {
    const row = document.createElement('tr')
    appendCell(row, name)
    const valueCell = document.createElement('td')
    valueCell.style.wordBreak = 'break-all'
    appendValue(valueCell, value)
    row.appendChild(valueCell)
    table.appendChild(row)
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
      if (title || layerName) appendRow(table, 'title/Layer', [title, layerName].filter(Boolean).join('/'))
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

  window.addEventListener('load', () => {
    if (window.svgMap?.setShowPoiProperty) window.svgMap.setShowPoiProperty(customShowPoiProperty)
  })
})()
