import { test, expect } from '@playwright/test'

test('water-stake layer renders the latest Sheet snapshot without exposing a key', async ({ page }) => {
  const requests = []
  await page.route('**/api/mizupigui', async (route) => {
    requests.push({ method: route.request().method(), headers: route.request().headers() })
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      updatedAt: '2026-10-11T00:00:00Z',
      stakes: [
        { id: 'A001', name: '1号杭', lat: 34.5231, lng: 133.6712, waterLevel: 1,
          tiltDetected: false, batteryOk: true, lastReceivedAt: '2026-10-11T08:47:00+09:00', floodedAt: null },
        { id: 'A002', name: '座標未設定', lat: null, lng: null, waterLevel: null,
          tiltDetected: false, batteryOk: true, lastReceivedAt: '2026-10-11T08:47:00+09:00', floodedAt: null },
      ],
    }) })
  })
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => window.svgMap?.getRootLayersProps?.().length || 0)).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((item) => item.title === '水ピィ杭 最新状態（logpot）')
    if (!layer) throw new Error('Water-stake layer is not registered')
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/mizupigui/mizupigui.html'))).toBe(true)
  const frame = page.frames().find((item) => item.url().includes('/mizupigui/mizupigui.html'))
  await expect(frame.locator('#totalCount')).toHaveText('2')
  await expect(frame.locator('#visibleCount')).toHaveText('1')
  const marker = await page.evaluate(() => {
    for (const svg of Object.values(window.svgMap.getSvgImages())) {
      const point = svg?.getElementById?.('stakePoints')?.querySelector('use')
      if (point) return { symbol: point.getAttribute('xlink:href'),
        layer: point.getAttribute('data-layer-id'), title: point.getAttribute('data-title') }
    }
    return null
  })
  expect(marker).toEqual({ symbol: '#stake-level-1', layer: 'mizupigui', title: '1号杭' })
  expect(requests.length).toBeGreaterThan(0)
  expect(requests.every((request) => request.method === 'GET' && !request.headers['x-api-key'])).toBe(true)
})
