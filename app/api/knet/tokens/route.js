import { noStoreHeaders, relayError, validateSameOriginRequest } from '../../_lib/fixed-relay.js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request) {
  try { validateSameOriginRequest(request) } catch (error) { return relayError(error.message, 403) }
  try {
    const response = await fetch('https://www.kyoshin.bosai.go.jp/ja/eqdownload/', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return relayError(`K-NET token page returned ${response.status}`)
    const text = await response.text()
    const token1 = text.match(/name="csrfmiddlewaretoken"\s+value="([^"]+)"/)?.[1] || ''
    const cookies = response.headers.getSetCookie?.() || [response.headers.get('set-cookie')]
    const csrf = cookies.map((value) => value?.match(/(?:^|;\s*)csrftoken=([^;]+)/)?.[1]).find(Boolean) || ''
    if (!token1 || !csrf) return relayError('K-NET did not issue CSRF tokens')
    return Response.json({ token1, token2: `csrftoken=${csrf}` }, { headers: noStoreHeaders() })
  } catch (error) {
    console.error('[knet-token-relay]', error)
    return relayError('K-NET token request failed')
  }
}
