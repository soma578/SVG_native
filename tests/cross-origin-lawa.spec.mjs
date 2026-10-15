import { test, expect } from '@playwright/test'

test('cross-origin S-LaWA initializes the Mizupigui layer from its own host', async ({ page }) => {
  const layerHost = 'http://localhost:3000'
  const layerPath = '/svgmapAppLayers/appLayers/mizupigui/mizupigui.svg'
  await page.route('**/svgmapAppLayers/Container.svg', async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    const relative = `./appLayers/mizupigui/mizupigui.svg`
    expect(source).toContain(relative)
    await route.fulfill({ response, body: source.replace(relative, `${layerHost}${layerPath}`) })
  })
  await page.route(`${layerHost}/api/mizupigui`, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      updatedAt: new Date().toISOString(),
      stakes: [{ id: 'S-LAWA-TEST', name: 'S-LaWA試験杭', lat: 34.65, lng: 133.9,
        waterLevel: 1, tiltDetected: false, batteryOk: true,
        lastReceivedAt: new Date().toISOString() }],
    }),
  }))
  await page.goto('http://127.0.0.1:3000/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === '水ピィ杭 最新状態（logpot）')
    if (!layer) throw new Error('Mizupigui layer missing')
    // Keep the marker away from SVGMap's centre-sight overlay so the click
    // reaches the POI rather than the map chrome.
    window.svgMap.setGeoViewPort(34.50, 133.75, 0.4, 0.4)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().find((frame) => frame.url().startsWith(`${layerHost}/svgmapAppLayers/appLayers/mizupigui/mizupigui.html`))?.locator('#visibleCount').textContent())
    .toBe('1')
  await expect.poll(() => page.evaluate(() => Object.values(window.svgMap.getSvgImages())
    .some((doc) => doc.querySelector?.('[data-feature-id="S-LAWA-TEST"]')))).toBe(true)
  await page.evaluate(() => {
    const showModal = window.svgMap.showModal.bind(window.svgMap)
    window.svgMap.showModal = (element, ...args) => {
      window.__crossOriginStakeProperty = element
      return showModal(element, ...args)
    }
  })
  const point = await page.evaluate(() => window.svgMap.geo2Screen(34.65, 133.9))
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#mapcanvas [data-layernode]')]
    .some((element) => element.getAttribute('property')?.includes('杭ID') && element.querySelector('canvas[hasdrawing]')))).toBe(true)
  await page.mouse.click(point.x, point.y)
  await expect.poll(() => page.evaluate(() => ({
    tag: window.__crossOriginStakeProperty?.tagName || '',
    text: window.__crossOriginStakeProperty?.textContent || '',
  }))).toMatchObject({ tag: 'TABLE', text: expect.stringContaining('S-LaWA試験杭') })
})

test('cross-origin S-LaWA webcam modal uses the layer host for its image', async ({ page }) => {
  const layerHost = 'http://localhost:3000'
  const layerPath = '/svgmapAppLayers/appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/'
  await page.route('**/svgmapAppLayers/Container.svg', async (route) => {
    const response = await route.fetch()
    const source = await response.text()
    const relative = `./appLayers/svg3-bosai/japan-river-webcams/map/layers/portable/japan-river-webcams/webcamLayer.svg`
    expect(source).toContain(relative)
    await route.fulfill({ response, body: source.replace(relative, `${layerHost}${layerPath}webcamLayer.svg`) })
  })
  const imageUrl = `${layerHost}/api/river-camera-image?id=311777010`
  let imageRequests = 0
  await page.route(imageUrl, (route) => {
    imageRequests += 1
    return route.fulfill({ status: 200, contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />' })
  })
  await page.goto('http://127.0.0.1:3000/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === '全国河川監視カメラ')
    if (!layer) throw new Error('Webcam layer missing')
    const showModal = window.svgMap.showModal.bind(window.svgMap)
    window.svgMap.showModal = (html, ...args) => {
      const modal = showModal(html, ...args)
      window.__crossOriginWebcamModal = modal
      return modal
    }
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().find((frame) => frame.url().startsWith(`${layerHost}${layerPath}webcamLayer.html`))
    ?.evaluate(() => window.svgMap?.constructor?.name)).toBe('SandboxSvgMap')
  const frame = page.frames().find((entry) => entry.url().startsWith(`${layerHost}${layerPath}webcamLayer.html`))
  await frame.evaluate(async () => {
    const { renderWebcamDetail } = await import('./webcamDetail.js')
    const html = renderWebcamDetail({ title: '試験カメラ',
      imageUrl: 'https://cam.river.go.jp/cam/now/311777010.jpg',
      pageUrl: 'https://www.river.go.jp/kawabou/' }, { imageEnabled: true, refreshEnabled: false })
    window.svgMap.showModal(html)
  })
  await expect.poll(() => page.evaluate(() => {
    const image = window.__crossOriginWebcamModal?.querySelector?.('img[data-webcam-image]')
    return image && [image.src, image.naturalWidth]
  })).toEqual([imageUrl, 1])
  expect(imageRequests).toBeGreaterThan(0)
})

test('cross-origin S-LaWA loads both emergency asset demo layers', async ({ page }) => {
  const layerHost = 'http://localhost:3000'
  const root = '/svgmapAppLayers/appLayers/emergencyAssets/'
  await page.route('**/svgmapAppLayers/Container.svg', async (route) => {
    const response = await route.fetch()
    let source = await response.text()
    for (const name of ['battery', 'movingHouse']) {
      const relative = `./appLayers/emergencyAssets/${name}.svg`
      expect(source).toContain(relative)
      source = source.replace(relative, `${layerHost}${root}${name}.svg`)
    }
    await route.fulfill({ response, body: source })
  })
  await page.goto('http://127.0.0.1:3000/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layers = window.svgMap.getRootLayersProps()
    window.svgMap.setGeoViewPort(34.65, 133.9, 0.4, 0.4)
    for (const title of ['非常用電源・固体電池（デモ）', 'ムービングハウス・利用状況（デモ）']) {
      const layer = layers.find((entry) => entry.title === title)
      if (!layer) throw new Error(`Layer missing: ${title}`)
      window.svgMap.setRootLayersProps(layer.id, true, false)
    }
    window.svgMap.refreshScreen()
  })
  for (const name of ['battery', 'movingHouse']) {
    await expect.poll(async () => Number(await page.frames().find((frame) => frame.url().startsWith(`${layerHost}${root}${name}.html`))
      ?.locator('#visibleCount').textContent())).toBeGreaterThan(0)
  }
})
