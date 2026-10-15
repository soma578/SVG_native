import { test, expect } from '@playwright/test'

test('SVGMap property table previews signed Sheet and published camera images', async ({ page }) => {
  await page.goto('/no-property-test-page', { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    let propertyHandler
    let modal
    window.svgMap = {
      setShowPoiProperty: (handler) => { propertyHandler = handler },
      parseEscapedCsvLine: (value) => value.split(','),
      getHyperLink: () => null,
      getCORSURL: (value) => value,
      showModal: (element) => { modal = element },
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = '/customShowPoiProperty.js'
      script.onload = resolve
      script.onerror = reject
      document.head.appendChild(script)
    })
    const render = (field, value) => {
      const svg = document.implementation.createDocument('http://www.w3.org/2000/svg', 'svg')
      svg.documentElement.setAttribute('property', field)
      const marker = svg.createElement('image')
      marker.setAttribute('content', value)
      svg.documentElement.appendChild(marker)
      propertyHandler(marker)
      return { image: modal.querySelector('img')?.getAttribute('src'),
        loading: modal.querySelector('img')?.loading,
        link: modal.querySelector('a')?.href,
        linkText: modal.querySelector('a')?.textContent,
        text: modal.textContent }
    }
    return {
      sheet: render('imageUrl', '/api/private-sheet-image?id=sample&sig=test'),
      camera: render('カメラ', 'https://example.com/camera.jpg'),
      river: render('カメラ画像', 'https://cam.river.go.jp/cam/now/311777010.jpg'),
      drive: render('写真', 'https://drive.google.com/file/d/FILE_123/view'),
      official: render('公式ページ', 'https://www.river.go.jp/kawabou/'),
      unsafe: render('imageUrl', 'javascript:alert(1)'),
    }
  })
  expect(result.sheet.image).toBe(`${new URL(page.url()).origin}/api/private-sheet-image?id=sample&sig=test`)
  expect(result.camera.image).toBe('https://example.com/camera.jpg')
  expect(result.camera.loading).toBe('eager')
  expect(result.camera.linkText).toBe('画像を開く')
  expect(result.camera.text).not.toContain('camera.jpg')
  expect(result.river.image).toBe('/api/river-camera-image?id=311777010')
  expect(result.river.link).toBe('https://cam.river.go.jp/cam/now/311777010.jpg')
  expect(result.drive.image).toBe(`${new URL(page.url()).origin}/api/drive-image?id=FILE_123`)
  expect(result.drive.link).toBe('https://drive.google.com/file/d/FILE_123/view')
  expect(result.official.link).toBe('https://www.river.go.jp/kawabou/')
  expect(result.official.linkText).toBe('公式ページを開く')
  expect(result.official.text).not.toContain('https://www.river.go.jp/kawabou/')
  expect(result.unsafe.image).toBeUndefined()
})
