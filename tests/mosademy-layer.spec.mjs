import { test, expect } from '@playwright/test'

test('MOSAdemy published data appears as one facility pin with two camera details', async ({ page }) => {
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
  const cameras = [
    { sensor_id: '1', facility_id: '1', name: 'カメラ１',
      image_url: `${root}images/6b86b273ff34fce19d6b804eff5a3f57.jpg`, measured_at: measured, status: 'normal' },
    { sensor_id: '2', facility_id: '1', name: 'カメラ２',
      image_url: `${root}images/d4735e3a265e16eee03f59718b9b5d03.jpg`, measured_at: measured, status: 'normal' },
  ]
  for (const camera of cameras) {
    await page.route(camera.image_url, (route) => route.fulfill({ status: 200,
      contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" />' }))
  }
  for (const [filename, data] of Object.entries({ catalog, latest, locations, cameras })) {
    await page.route(`${root}${filename}.json`, (route) => route.fulfill({ status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' }, contentType: 'application/json', body: JSON.stringify(data) }))
  }
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded' })
  await expect.poll(() => page.evaluate(() => {
    try { return window.svgMap?.getRootLayersProps?.().length || 0 } catch { return 0 }
  })).toBeGreaterThan(0)
  await page.evaluate(() => {
    const layer = window.svgMap.getRootLayersProps().find((entry) => entry.title === 'MOSAdemy 設備監視（岡山大学医学部）')
    if (!layer) throw new Error('MOSAdemy layer not registered')
    window.svgMap.setGeoViewPort(34.6507388, 133.9158887, 0.4, 0.4)
    window.svgMap.setRootLayersProps(layer.id, true, false)
    window.svgMap.refreshScreen()
  })
  await expect.poll(() => page.frames().some((frame) => frame.url().includes('/mosademy/mosademy.html'))).toBe(true)
  const frame = page.frames().find((entry) => entry.url().includes('/mosademy/mosademy.html'))
  await expect(frame.locator('#facilityCount')).toHaveText('1')
  await expect(frame.locator('#sensorCount')).toHaveText('5')
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
      values: window.svgMap.parseEscapedCsvLine(marker.getAttribute('content')),
      title: marker.getAttribute('title') }
  })
  expect(standardMetadata.schema).toEqual(['施設ID', '施設名', '燃料残量', '水位残量', '電力', 'カメラ１画像', 'カメラ２画像', '最終計測', '出典', '出典公式ページ'])
  expect(standardMetadata.title).toBe('MOSAdemy 設備監視（岡山大学医学部）')
  expect(standardMetadata.values.slice(0, 5)).toEqual(['1', '岡山大学病院', '3232.9 L', '45.5 %', '7031.8 W'])
  expect(standardMetadata.values[5]).toBe(cameras[0].image_url)
  expect(standardMetadata.values[6]).toBe(cameras[1].image_url)
  expect(standardMetadata.values[8]).toBe('MOSAdemy 公開データ')
  expect(standardMetadata.values[9]).toBe('https://mosa-github.github.io/data_test_server_page/')
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
  await expect.poll(() => page.evaluate(() => {
    const table = window.__mosademyPropertyModal
    const row = [...(table?.querySelectorAll?.('tr') || [])].find((item) => item.cells?.[0]?.textContent === 'title/Layer')
    return row?.cells?.[1]?.textContent
  })).toBe('MOSAdemy 設備監視（岡山大学医学部）')
  expect(await page.evaluate(() => [...(window.__mosademyPropertyModal?.querySelectorAll?.('tr') || [])]
    .find((row) => row.cells?.[0]?.textContent === '出典')?.cells?.[1]?.textContent)).toBe('MOSAdemy 公開データ')
  expect(await page.evaluate(() => [...(window.__mosademyPropertyModal?.querySelectorAll?.('tr') || [])]
    .find((row) => row.cells?.[0]?.textContent === '出典公式ページ')?.querySelector('a')?.href))
    .toBe('https://mosa-github.github.io/data_test_server_page/')
  await expect.poll(() => page.evaluate(() => [...(window.__mosademyPropertyModal?.querySelectorAll?.('img') || [])]
    .map((image) => [image.src, image.naturalWidth])))
    .toEqual(cameras.map((camera) => [camera.image_url, 1]))
  const detail = await frame.evaluate(() => {
    const marker = window.svgImage.getElementById('sensor-root').querySelector('image')
    return import('./mosademy.js').then(({ showFacilityProperty }) => {
      const info = showFacilityProperty(marker)
      const details = [...info.querySelectorAll('[data-sensor-index]')]
      const labels = details.map((section) => section.querySelector('summary')?.textContent)
      return {
        labels,
        fuel: details[0].textContent,
        water: details[1].textContent,
        power: details[2].textContent,
        firstCamera: { text: details[3].textContent, image: details[3].querySelector('img')?.getAttribute('src') },
        secondCamera: { text: details[4].textContent, image: details[4].querySelector('img')?.getAttribute('src') },
        firstOpen: details[0].open,
      }
    })
  })
  expect(detail.labels).toEqual(['燃料残量', '水位残量', '電力', 'カメラ１', 'カメラ２'])
  expect(detail.firstOpen).toBe(true)
  expect(detail.fuel).toContain('岡山大学病院')
  expect(detail.fuel).toContain('3232.9 L')
  expect(detail.water).toContain('45.5 %')
  expect(detail.power).toContain('7031.8 W')
  expect(detail.water).not.toContain('浸水深')
  expect(detail.firstCamera.text).toContain('カメラ１')
  expect(detail.firstCamera.image).toBe(cameras[0].image_url)
  expect(detail.secondCamera.text).toContain('カメラ２')
  expect(detail.secondCamera.image).toBe(cameras[1].image_url)
})
