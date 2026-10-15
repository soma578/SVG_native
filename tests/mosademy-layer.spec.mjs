import { test, expect } from '@playwright/test'

test('MOSAdemy published data appears as one facility pin with detail buttons', async ({ page }) => {
  const root = 'https://mosa-github.github.io/data_test_server_page/public-data/'
  const measured = new Date().toISOString()
  const catalog = { generated_at: measured, datasets: ['latest', 'locations', 'cameras']
    .map((id) => ({ id, format: 'json', url: `${root}${id}.json` })) }
  const latest = [
    { sensor_id: '3', facility_id: '1', name: '燃料残量', type: 'generator', value: 3232.9, unit: 'L', measured_at: measured, status: 'normal' },
    { sensor_id: '4', facility_id: '1', name: '水位残量', type: 'water', value: 45.5, unit: '%', measured_at: measured, status: 'normal' },
    { sensor_id: '5', facility_id: '1', name: '電力', type: 'power', value: 7031.8, unit: 'W', measured_at: measured, status: 'normal' },
  ]
  const locations = [{ facility_id: '1', facility_name: '岡山大学病院', latitude: 34.6507388, longitude: 133.9158887 }]
  const cameras = [{ sensor_id: '1', facility_id: '1', name: 'カメラ１',
    image_url: `${root}images/6b86b273ff34fce19d6b804eff5a3f57.jpg`, measured_at: measured, status: 'normal' }]
  await page.route(cameras[0].image_url, (route) => route.fulfill({ status: 200,
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />' }))
  for (const [filename, data] of Object.entries({ catalog, latest, locations, cameras })) {
    await page.route(`${root}${filename}.json`, (route) => route.fulfill({ status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify(data) }))
  }
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === 'MOSAdemy 設備監視')
    if (!layer) throw new Error('MOSAdemy layer not registered')
    window.svgMap.setGeoViewPort(34.6507388, 133.9158887, 0.4, 0.4)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/mosademy/mosademy.html'))).toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/mosademy/mosademy.html'))
  await expect(frame.locator('#facilityCount')).toHaveText('1')
  await expect(frame.locator('#sensorCount')).toHaveText('4')
  expect(await frame.evaluate(() => window.svgMap.getLayer(window.layerID)?.getAttribute('class')))
    .toContain('岡山大学')
  const points = await frame.evaluate(() => {
    return [...window.svgImage.getElementById('sensor-root').querySelectorAll('image')]
      .map((marker) => [marker.getAttribute('data-facility-id'), marker.getAttribute('transform')])
  })
  expect(points).toEqual([['1', 'ref(svg,133.9158887,-34.6507388)']])
  const standardMetadata = await frame.evaluate(() => {
    const root = window.svgImage.documentElement
    const marker = window.svgImage.getElementById('sensor-root').querySelector('image')
    return { schema: root.getAttribute('property').split(','),
      values: window.svgMap.parseEscapedCsvLine(marker.getAttribute('content')) }
  })
  expect(standardMetadata.schema).toEqual(['施設ID', '施設名', '燃料残量', '水位残量', '電力', 'カメラ', '最終計測'])
  expect(standardMetadata.values.slice(0, 5)).toEqual(['1', '岡山大学病院', '3232.9 L', '45.5 %', '7031.8 W'])
  expect(standardMetadata.values[5]).toBe(cameras[0].image_url)
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('img')]
    .some((img) => img.src.includes('/mosademy/icons/available.svg') && img.complete && img.naturalWidth > 0)))
    .toBe(true)
  await page.evaluate(() => {
    const showModal = window.svgMap.showModal.bind(window.svgMap)
    window.svgMap.showModal = (element, ...args) => {
      window.__mosademyPropertyModal = element
      return showModal(element, ...args)
    }
  })
  await page.locator('img[src*="mosademy"][src*="available.svg"]').first().click({ timeout: 5000 })
  await expect.poll(() => page.evaluate(() => window.__mosademyPropertyModal?.querySelector?.('img')?.src || ''))
    .toBe(cameras[0].image_url)
  await expect.poll(() => page.evaluate(() => window.__mosademyPropertyModal?.querySelector?.('img')?.naturalWidth || 0))
    .toBe(1)
  const detail = await frame.evaluate(() => {
    const marker = window.svgImage.getElementById('sensor-root').querySelector('image')
    return import('./mosademy.js').then(({ showFacilityProperty }) => {
      const info = showFacilityProperty(marker)
      const buttons = [...info.querySelectorAll('[data-sensor-index]')]
      const labels = buttons.map((button) => button.textContent)
      const fuel = info.querySelector('.mosademy-detail')?.textContent
      buttons[1].click()
      const water = info.querySelector('.mosademy-detail')?.textContent
      buttons[2].click()
      const power = info.querySelector('.mosademy-detail')?.textContent
      buttons[3].click()
      return { labels, fuel, water, power, camera: info.querySelector('.mosademy-detail')?.textContent,
        image: info.querySelector('.mosademy-detail img')?.getAttribute('src') }
    })
  })
  expect(detail.labels).toEqual(['燃料残量', '水位残量', '電力', 'カメラ１'])
  expect(detail.fuel).toContain('岡山大学病院')
  expect(detail.fuel).toContain('3232.9 L')
  expect(detail.water).toContain('45.5 %')
  expect(detail.power).toContain('7031.8 W')
  expect(detail.water).not.toContain('浸水深')
  expect(detail.camera).toContain('カメラ１')
  expect(detail.image).toBe(cameras[0].image_url)
})
