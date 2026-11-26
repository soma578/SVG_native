import { test, expect } from '@playwright/test'

test('Okayama AED layer loads official snapshot and SVGMap properties', async ({ page }) => {
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === 'AED N@VI 設置情報（岡山県）')
    if (!layer) throw new Error('AED layer not registered')
    window.svgMap.setGeoViewPort(34.65, 133.90, 0.3, 0.3)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/aedNavi/aedNavi.html'))).toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/aedNavi/aedNavi.html'))
  await expect(frame.locator('#status')).toContainText('画面内')
  await page.evaluate(() => {
    window.svgMap.setGeoViewPort(34.65, 133.90, 0.3, 0.3)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => frame.evaluate(() => window.svgImage.getElementById('aedPoints').querySelectorAll('use').length))
    .toBeGreaterThan(10)
  const details = await frame.evaluate(() => {
    const markers = [...window.svgImage.getElementById('aedPoints').querySelectorAll('use')]
    const marker = markers.find((node) => node.getAttribute('data-record-id') === '41329')
    return { count: markers.length, properties: window.svgImage.documentElement.getAttribute('property')?.split(','),
      values: marker && window.svgMap.parseEscapedCsvLine(marker.getAttribute('content')),
      title: marker?.getAttribute('data-title') }
  })
  expect(details.count).toBeGreaterThan(10)
  expect(details.properties.slice(0, 8)).toEqual(['設置画像1', '設置画像2', '設置画像3', '設置画像4', '設置画像5', '設置場所名', '設置場所住所', '設置場所詳細'])
  expect(details.properties.length).toBe(details.values.length)
  expect(details.values[0]).toMatch(/^https:\/\/aed-navi\.jp\/files\/share\/.+\.jpg$/)
  const imageWidth = await page.evaluate((url) => new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth)
    image.onerror = () => resolve(0)
    image.src = url
  }), details.values[0])
  expect(imageWidth).toBeGreaterThan(0)
  expect(details.values[5]).toBe('ホテルグランヴィア岡山')
  expect(details.values[9]).toBe('サポーター')
  expect(details.values.at(-2)).toBe('AED N@VI')
  expect(details.values.at(-1)).toBe('https://aed-navi.jp/map')
  expect(details.title).toBe('AED N@VI 設置情報（岡山県）')
})
