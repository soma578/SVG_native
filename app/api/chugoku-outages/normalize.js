const SOURCE_ORIGIN = 'https://www.teideninfo.energia.co.jp'

const decodeEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))

const text = (value) => decodeEntities(String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' '))
  .replace(/[\t\r ]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .trim()

const toIsoJst = (value) => {
  const match = String(value ?? '').match(/(\d{4})[年\/]\s*(\d{1,2})[月\/]\s*(\d{1,2})日?\s+(\d{1,2}):(\d{2})/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T${match[4].padStart(2, '0')}:${match[5]}:00+09:00`
}

export function parsePrefecturePage(html) {
  const source = String(html ?? '')
  const updated = text(source.match(/最終更新日時[：:]\s*([^<]+)/)?.[1] ?? '')
  const municipalityPaths = [...source.matchAll(/data-href=["']https:\/\/www\.teideninfo\.energia\.co\.jp(\/LWC31050\/index\/(33\d{3}))["']/gi)]
    .map((match) => ({ path: match[1], municipalityCode: match[2] }))
  return {
    updatedAt: toIsoJst(updated),
    municipalityPaths: [...new Map(municipalityPaths.map((entry) => [entry.path, entry])).values()],
  }
}

export function parseMunicipalityDetail(html, municipalityCode) {
  const source = String(html ?? '')
  const blocks = source.match(/<div\b[^>]*class=["'][^"']*LayoutBox_Gray[^"']*["'][^>]*>[\s\S]*?<\/table>[\s\S]*?<\/div>/gi) ?? []
  return blocks.map((block, blockIndex) => {
    const paragraph = block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''
    const plain = text(paragraph)
    const startedAt = toIsoJst(plain)
    const reason = plain.match(/停電理由[：:]\s*([^\n]+)/)?.[1]?.trim() ?? ''
    const restore = plain.match(/復旧は[，,]?\s*([^\n]+?)(?:の見込みです|です[。.]|$)/)?.[1]?.trim() ?? ''
    const status = plain
      .replace(/^.*?停電が発生しております[。.]?/s, '')
      .replace(/停電理由[：:][^\n]*/g, '')
      .replace(/復旧は[，,]?[^\n]*/g, '')
      .replace(/大変ご迷惑.*?お待ちください[。.]?/s, '')
      .trim()
    const areas = [...block.matchAll(/<tr\b[^>]*>[\s\S]*?<td\b[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td\b[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi)]
      .map((match) => ({
        name: text(match[1]),
        households: Number(text(match[2]).replace(/[^\d]/g, '')) || null,
      }))
      .filter((area) => area.name)
    return {
      id: `${municipalityCode}-${startedAt ?? 'unknown'}-${blockIndex + 1}`,
      municipalityCode,
      startedAt,
      status,
      expectedRestore: restore,
      reason,
      households: areas.reduce((sum, area) => sum + (area.households ?? 0), 0) || null,
      areas,
    }
  })
}

export function assertAllowedOutagePath(pathname) {
  if (pathname === '/LWC31133.html' || /^\/LWC31050\/index\/33\d{3}$/.test(pathname)) return pathname
  throw new Error(`Unsupported outage source path: ${pathname}`)
}

export { SOURCE_ORIGIN }
