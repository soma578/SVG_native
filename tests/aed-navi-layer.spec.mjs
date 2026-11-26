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
  const details = await frame.evaluate(() => {
    const markers = [...window.svgImage.getElementById('aedPoints').querySelectorAll('use')]
    const marker = markers.find((node) => node.getAttribute('content')?.includes('岡山')) || markers[0]
    return { count: markers.length, properties: window.svgImage.documentElement.getAttribute('property')?.split(','),
      values: marker && window.svgMap.parseEscapedCsvLine(marker.getAttribute('content')),
      title: marker?.getAttribute('data-title') }
  })
  expect(details.count).toBeGreaterThan(10)
  expect(details.properties).toEqual(['施設名', '所在地', 'AED N@VI ID', '掲載時間の目安', '緯度', '経度', 'データ取得日時', '出典', '出典公式ページ'])
  expect(details.values[0]).toBeTruthy()
  expect(details.values[7]).toBe('AED N@VI')
  expect(details.values[8]).toBe('https://aed-navi.jp/map')
  expect(details.title).toBe('AED N@VI 設置情報（岡山県）')
})
