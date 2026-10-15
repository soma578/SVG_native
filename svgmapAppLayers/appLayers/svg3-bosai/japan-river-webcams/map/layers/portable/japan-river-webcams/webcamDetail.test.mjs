import assert from 'node:assert/strict'
import { renderWebcamDetail } from './webcamDetail.js'

const camera = {
  title: '監視カメラ',
  imageUrl: 'https://cam.river.go.jp/cam/now/311777010.jpg',
  pageUrl: 'https://www.river.go.jp/kawabou/',
}
const html = renderWebcamDetail(camera, { imageEnabled: true })
const expected = new URL('/api/river-camera-image?id=311777010', import.meta.url).href
assert.ok(html.includes(`src="${expected}"`))
assert.ok(html.includes(`data-source="${expected}"`))
assert.doesNotMatch(html, /src="\/api\/river-camera-image/)
assert.match(html, /画像はレイヤー配信元の中継を通じて取得します/)
const sandboxHtml = renderWebcamDetail(camera, { imageEnabled: true, refreshEnabled: false })
assert.doesNotMatch(sandboxHtml, /data-webcam-refresh/)
assert.ok(sandboxHtml.includes(`src="${expected}"`))
console.log('River camera modal uses its own origin for images')
