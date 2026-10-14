import { test, expect } from '@playwright/test'

const updatedAt = '2026-10-14T10:30:00+09:00'
const cases = [
  {
    title: '非常用電源・固体電池（デモ）', html: 'battery.html', json: 'battery.json',
    icon: 'battery-available.svg',
    record: { id: 'BAT-001', name: '試験用電源', address: 'テスト', lat: 34.6, lng: 133.7,
      status: 'available', chargePercent: 75, capacityKWh: 10, updatedAt },
    detail: '残量',
  },
  {
    title: 'ムービングハウス・利用状況（デモ）', html: 'movingHouse.html', json: 'movingHouse.json',
    icon: 'house-available.svg',
    record: { id: 'MH-001', name: '試験用住宅', address: 'テスト', lat: 34.6, lng: 133.7,
      placement: 'installed', accepting: true, capacity: 4, occupied: 2, updatedAt },
    detail: '空き人数',
  },
]

for (const item of cases) {
  test(`${item.title} displays a distinct POI and property card`, async ({ page }) => {
    await page.route(`**/emergencyAssets/${item.json}`, async (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ updatedAt, assets: [item.record] }),
    }))
    await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
    await expect.poll(() => page.evaluate(() => {
      try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
    })).toBeGreaterThan(0)
    await page.evaluate((title) => {
      const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === title)
      if (!layer) throw new Error('Layer not registered')
      window.svgMap.setRootLayersProps(layer.id, true, false)
      window.svgMap.refreshScreen()
    }, item.title)
    await expect.poll(() => page.frames().some((frame) => frame.url().includes(`/emergencyAssets/${item.html}`))).toBe(true)
    const frame = page.frames().find((entry) => entry.url().includes(`/emergencyAssets/${item.html}`))
    await expect(frame.locator('#totalCount')).toHaveText('1')
    const marker = await page.evaluate((id) => {
      for (const svg of Object.values(window.svgMap.getSvgImages())) {
        const point = svg?.getElementById?.('assetPoints')?.querySelector('use')
        if (point?.getAttribute('data-feature-id') === id) return point.getAttribute('xlink:href')
      }
      return null
    }, item.record.id)
    expect(marker).toBe('#asset-available')
    const metadata = await frame.evaluate(() => {
      const root = window.svgImage.documentElement
      const point = window.svgImage.getElementById('assetPoints').querySelector('use')
      return { labels: root.getAttribute('property').split(','),
        values: window.svgMap.parseEscapedCsvLine(point.getAttribute('content')) }
    })
    expect(metadata.values).toHaveLength(metadata.labels.length)
    expect(metadata.values.at(-1)).toBe('手動登録データ')
    await expect.poll(() => page.evaluate((icon) => [...document.querySelectorAll('img')]
      .some((img) => img.src.includes(`/emergencyAssets/icons/${icon}`) && img.complete && img.naturalWidth > 0), item.icon))
      .toBe(true)
    const detailText = await frame.evaluate(() => {
      const point = window.svgImage.getElementById('assetPoints').querySelector('use')
      return import('./assets.js').then(({ showAssetProperty }) => showAssetProperty(point)?.textContent)
    })
    expect(detailText).toContain(item.detail)
  })
}

test('published examples are explicitly marked as fictional and use image POI icons', async ({ page }) => {
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === '非常用電源・固体電池（デモ）')
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/emergencyAssets/battery.html'))).toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/emergencyAssets/battery.html'))
  await expect(frame.locator('#totalCount')).toHaveText('8')
  await expect(frame.locator('#demoNotice')).toBeVisible()
  const glyph = await page.evaluate(() => {
    for (const svg of Object.values(window.svgMap.getSvgImages())) {
      const symbol = svg?.getElementById?.('asset-available')
      const icon = symbol?.querySelector('image')
      if (icon) return { href: icon.getAttribute('xlink:href'),
        width: icon.getAttribute('width'), height: icon.getAttribute('height') }
    }
    return null
  })
  expect(glyph).toEqual({ href: './icons/battery-available.svg', width: '26', height: '26' })
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('img')]
    .some((img) => img.src.includes('/emergencyAssets/icons/battery-available.svg') && img.complete && img.naturalWidth > 0)))
    .toBe(true)
  const iconResponse = await page.request.get('/svgmapAppLayers/appLayers/emergencyAssets/icons/battery-available.svg')
  expect(iconResponse.status()).toBe(200)
  expect(await iconResponse.text()).toContain('<path')
})
