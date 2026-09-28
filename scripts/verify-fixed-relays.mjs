import assert from 'node:assert/strict'
import { POST as postJma } from '../app/api/jma-earthquake/route.js'
import { POST as postKnetData } from '../app/api/knet/data/route.js'
import { GET as getKnetTokens } from '../app/api/knet/tokens/route.js'
import { POST as postMaff } from '../app/api/maff/route.js'
import { POST as postMsil } from '../app/api/msil-token/route.js'

const originalFetch = globalThis.fetch
const seen = []
try {
  globalThis.fetch = async (target, options = {}) => {
    seen.push({ target: String(target), options })
    if (String(target).includes('/eqdownload/')) {
      return new Response('<input name="csrfmiddlewaretoken" value="abcdefghijklmnop">', {
        headers: { 'Set-Cookie': 'csrftoken=qrstuvwxyzABCDEF; Path=/; Secure' },
      })
    }
    return Response.json({ ok: true })
  }

  const jmaForm = new FormData()
  jmaForm.append('mode', 'search')
  let response = await postJma(new Request('http://localhost/api/jma-earthquake', {
    method: 'POST', body: jmaForm,
  }))
  assert.equal(response.status, 200)
  assert.equal(seen.at(-1).target, 'https://www.data.jma.go.jp/eqdb/data/shindo/api/')

  const maffPayload = {
    systemID: 'd45b4360-2d8f-86e0-84e1-9d5949e3624d',
    layerIdArr: ['aaa81ee7-f2af-44fe-a6d1-2f8e0b834056'],
    extent: { lat1: 35.7, lat2: 35.65, lon1: 139.7, lon2: 139.75 },
  }
  response = await postMaff(new Request('http://localhost/api/maff', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(maffPayload),
  }))
  assert.equal(response.status, 200)
  assert.equal(seen.at(-1).target, 'https://map-internal.api.maff.go.jp/mobileapi/getBasicLayerGeometry')

  const knetForm = new FormData()
  knetForm.append('csrfmiddlewaretoken', 'abcdefghijklmnop')
  response = await postKnetData(new Request(
    'http://localhost/api/knet/data?path=eqdownload/api/eqsearch/&cookie=csrftoken%3DqrstuvwxyzABCDEF',
    { method: 'POST', body: knetForm },
  ))
  assert.equal(response.status, 200)
  assert.equal(seen.at(-1).target, 'https://www.kyoshin.bosai.go.jp/ja/eqdownload/api/eqsearch/')

  response = await getKnetTokens(new Request('http://localhost/api/knet/tokens'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    token1: 'abcdefghijklmnop', token2: 'csrftoken=qrstuvwxyzABCDEF',
  })

  response = await postMsil(new Request('http://localhost/api/msil-token', { method: 'POST' }))
  assert.equal(response.status, 410)

  response = await postMaff(new Request('http://localhost/api/maff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
    body: JSON.stringify(maffPayload),
  }))
  assert.equal(response.status, 403)

  response = await postKnetData(new Request(
    'http://localhost/api/knet/data?path=https://attacker.example/&cookie=csrftoken%3DqrstuvwxyzABCDEF',
    { method: 'POST', body: knetForm },
  ))
  assert.equal(response.status, 400)
} finally {
  globalThis.fetch = originalFetch
}

console.log('[fixed-relays] fixed targets, input policy, same-origin checks, K-NET tokens, and MSIL retirement passed')
