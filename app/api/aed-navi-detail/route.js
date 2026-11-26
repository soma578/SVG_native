export const dynamic = 'force-dynamic'

const SOURCE = 'https://aed-navi.jp/aed/infolist'
const NO_STORE = { 'Cache-Control': 'no-store', 'CDN-Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store' }

export async function GET(request) {
  const query = new URL(request.url).searchParams
  const id = Number(query.get('id'))
  const lat = Number(query.get('lat'))
  const lng = Number(query.get('lng'))
  if (!Number.isSafeInteger(id) || id < 1 || !Number.isFinite(lat) || lat < 20 || lat > 55 || !Number.isFinite(lng) || lng < 120 || lng > 150) {
    return Response.json({ error: 'Invalid AED location' }, { status: 400, headers: NO_STORE })
  }
  const body = new URLSearchParams({ 'id[0]': String(id), latitude: String(lat), longitude: String(lng), request: '0' })
  try {
    const response = await fetch(SOURCE, {
      method: 'POST', body, cache: 'no-store', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', Accept: 'application/json', 'User-Agent': 'HLMap-AED-Navi/1.0' },
    })
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`)
    const data = await response.json()
    const record = (Array.isArray(data) ? data : []).find((item) => Number(item?.id) === id)
    if (!record) return Response.json({ error: 'AED not found' }, { status: 404, headers: NO_STORE })
    return Response.json({ record }, { headers: NO_STORE })
  } catch (error) {
    console.error('[aed-navi-detail]', error)
    return Response.json({ error: 'AED details temporarily unavailable' }, { status: 502, headers: NO_STORE })
  }
}
