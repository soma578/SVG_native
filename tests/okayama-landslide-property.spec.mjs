import { test, expect } from '@playwright/test'

test('Okayama landslide polygon opens its standard property table', async ({ page }) => {
  const lat = 34.6565
  const lng = 133.9715
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  }))
    .toBeGreaterThan(0)
  await page.evaluate(({ lat, lng }) => {
    const layer = window.svgMap.getRootLayersProps()
      .find((entry) => entry.title === '岡山県 新たな土砂災害リスク箇所')
    if (!layer) throw new Error('Landslide layer not registered')
    window.svgMap.setGeoViewPort(lat - 0.01, lng - 0.01, 0.02, 0.02)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  }, { lat, lng })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/okayamaLandslideCandidates.html')))
    .toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/okayamaLandslideCandidates.html'))
  await expect.poll(() => frame.locator('#visibleCount').textContent()).not.toBe('読込中')
  await expect.poll(() => page.evaluate(() => Object.values(window.svgMap.getSvgImagesProps())
    .map((props) => props?.Path || '')
    .filter((path) => /okayamaLandslideCandidates.*(?:steep|debris)-detail-shards\.svg$/.test(path)).length))
    .toBe(2)
  await expect.poll(() => frame.evaluate(({ lat, lng }) =>
    window.customHitTester?.({ lat, lng })?.length || 0, { lat, lng })).toBeGreaterThan(0)
  const titles = await frame.evaluate(({ lat, lng }) => window.customHitTester({ lat, lng })
    .map((target) => target.getAttribute('xlink:title')), { lat, lng })
  expect(titles).toContain('岡山市中区円山 / 急傾斜 / No.12010001')
  expect(titles).not.toContain(null)
  await page.evaluate(() => {
    const original = window.svgMap.showModal.bind(window.svgMap)
    window.svgMap.showModal = (element, ...args) => {
      window.__landslidePropertyModal = element
      return original(element, ...args)
    }
  })
  const point = await page.evaluate(({ lat, lng }) => window.svgMap.geo2Screen(lat, lng), { lat, lng })
  await page.mouse.click(point.x, point.y)
  await expect.poll(() => page.evaluate(() => window.__landslidePropertyModal?.textContent || ''))
    .toContain('12010001')
  expect(await page.evaluate(() => [...(window.__landslidePropertyModal?.querySelectorAll?.('tr') || [])]
    .find((row) => row.cells?.[0]?.textContent === 'title/Layer')?.cells?.[1]?.textContent))
    .toBe('岡山県 新たな土砂災害リスク箇所')
  expect(await page.evaluate(() => [...(window.__landslidePropertyModal?.querySelectorAll?.('tr') || [])]
    .find((row) => row.cells?.[0]?.textContent === '出典公式ページ')?.querySelector('a')?.href))
    .toBe('https://www.pref.okayama.jp/page/1036031.html')

  // The simplified overview polygons must remain selectable before the
  // detailed outline takes over.
  await page.evaluate(({ lat, lng }) => {
    window.svgMap.setGeoViewPort(lat - 0.14, lng - 0.14, 0.2, 0.2)
    window.svgMap.refreshScreen()
  }, { lat, lng })
  await expect.poll(() => frame.evaluate(({ lat, lng }) =>
    window.customHitTester?.({ lat, lng })?.some((target) =>
      target.getAttribute('content')?.startsWith('12010001,')) || false, { lat, lng }))
    .toBe(true)
})

test('wide-area risk mesh does not open the root-layer property', async ({ page }) => {
  const lat = 34.65
  const lng = 133.97
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(({ lat, lng }) => {
    const layer = window.svgMap.getRootLayersProps()
      .find((entry) => entry.title === '岡山県 新たな土砂災害リスク箇所')
    if (!layer) throw new Error('Landslide layer not registered')
    window.svgMap.setGeoViewPort(lat - 0.4, lng - 0.4, 0.8, 0.8)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  }, { lat, lng })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/okayamaLandslideCandidates.html')))
    .toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/okayamaLandslideCandidates.html'))
  await expect.poll(() => frame.evaluate(() => window.svgImage?.getElementById('steepFar')?.getAttribute('visibility')))
    .toBe('visible')
  await expect.poll(() => page.evaluate(() => Object.values(window.svgMap.getSvgImagesProps())
    .map((props) => props?.Path || '')
    .filter((path) => /okayamaLandslideCandidates.*(?:steep|debris)-far\.svg$/.test(path)).length))
    .toBe(2)
  expect(await frame.evaluate(({ lat, lng }) => window.customHitTester?.({ lat, lng }), { lat, lng })).toBeNull()
  const point = await page.evaluate(({ lat, lng }) => window.svgMap.geo2Screen(lat, lng), { lat, lng })
  await page.mouse.click(point.x, point.y)
  await expect(page.locator('#ticker')).not.toContainText('岡山県 新たな土砂災害リスク箇所')
  await expect(page.locator('#modalDiv')).toHaveCount(0)
})
