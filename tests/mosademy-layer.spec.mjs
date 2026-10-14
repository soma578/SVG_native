import { test, expect } from '@playwright/test'

test('MOSAdemy public data joins by facility and displays sensors and cameras', async ({ page }) => {
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
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/mosademy/mosademy.html'))).toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/mosademy/mosademy.html'))
  await expect(frame.locator('#facilityCount')).toHaveText('1')
  const point = await frame.evaluate(() => {
    const marker = window.svgImage.getElementById('facilityPoints').querySelector('use')
    return [marker.getAttribute('data-feature-id'), marker.getAttribute('xlink:href'), marker.getAttribute('transform')]
  })
  expect(point).toEqual(['1', '#facility-available', 'ref(svg,13391.58887,-3465.07388)'])
  const detail = await frame.evaluate(() => {
    const marker = window.svgImage.getElementById('facilityPoints').querySelector('use')
    return import('./mosademy.js').then(({ showFacilityProperty }) => {
      const modal = showFacilityProperty(marker)
      return { text: modal?.textContent, image: modal?.querySelector('img')?.getAttribute('src') }
    })
  })
  expect(detail.text).toContain('岡山大学病院')
  expect(detail.text).toContain('3,232.9 L')
  expect(detail.text).toContain('45.5 %')
  expect(detail.text).toContain('7,031.8 W')
  expect(detail.text).not.toContain('浸水深')
  expect(detail.image).toBe(cameras[0].image_url)
})
