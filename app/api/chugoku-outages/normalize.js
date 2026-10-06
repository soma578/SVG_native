const SOURCE_ORIGIN = 'https://www.teideninfo.energia.co.jp'

const PREFECTURES = Object.freeze({
  31: '鳥取県',
  32: '島根県',
  33: '岡山県',
  34: '広島県',
  35: '山口県',
})

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
  const municipalityPaths = [...source.matchAll(/(?:data-href|href)=["']https:\/\/www\.teideninfo\.energia\.co\.jp(\/LWC31050\/index\/((?:31|32|33|34|35)\d{3}))["']/gi)]
    .map((match) => ({
      path: match[1],
      municipalityCode: match[2],
      prefectureCode: match[2].slice(0, 2),
      prefectureName: PREFECTURES[match[2].slice(0, 2)],
    }))
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
      eventId: `${municipalityCode}-${startedAt ?? 'unknown'}-${blockIndex + 1}`,
      state: 'current',
      municipalityCode,
      prefectureCode: municipalityCode.slice(0, 2),
      prefectureName: PREFECTURES[municipalityCode.slice(0, 2)],
      startedAt,
      status,
      expectedRestore: restore,
      reason,
      households: areas.reduce((sum, area) => sum + (area.households ?? 0), 0) || null,
      areas,
    }
  })
}

export function parseHistoryPage(html, outageType = 'standard') {
  const source = String(html ?? '')
  const updated = text(source.match(/最終更新日時[：:]\s*([^<]+)/)?.[1] ?? '')
  const starts = [...source.matchAll(/<ul\b[^>]*class=["'][^"']*\bjs-knm\b[^"']*["'][^>]*data-egs-tdn=["']([^"']+)["'][^>]*>/gi)]
  const outages = []
  for (let index = 0; index < starts.length; index += 1) {
    const eventId = starts[index][1]
    const fallbackEnd = source.indexOf('<script', starts[index].index)
    const block = source.slice(starts[index].index, starts[index + 1]?.index
      ?? (fallbackEnd > starts[index].index ? fallbackEnd : source.length))
    const summary = block.match(/FC_red[^>]*>([\s\S]*?)<\/div>[\s\S]*?FC_blue[^>]*>([\s\S]*?)<\/div>[\s\S]*?<div\b[^>]*class=["']u-fx1["'][^>]*>([\s\S]*?)<\/div>[\s\S]*?<div\b[^>]*class=["'][^"']*\bR\b[^"']*p-table-listCell03[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    if (!summary) continue
    const startedAt = toIsoJst(text(summary[1]))
    const restoredAt = toIsoJst(text(summary[2]))
    const reason = text(summary[3])
    const households = Number(text(summary[4]).replace(/[^\d]/g, '')) || null
    const markers = [...block.matchAll(/data-tdk=["']([^"']+)["']|<li\b[^>]*class=["'][^"']*\bjs-scg\b[^"']*["'][^>]*data-scg=["']([^"']+)["'][^>]*>/gi)]
    let prefectureName = ''
    for (let markerIndex = 0; markerIndex < markers.length; markerIndex += 1) {
      const marker = markers[markerIndex]
      if (marker[1]) {
        prefectureName = text(marker[1])
        continue
      }
      const municipalityName = text(marker[2])
      const municipalityBlock = block.slice(marker.index, markers[markerIndex + 1]?.index ?? block.length)
      const areas = [...municipalityBlock.matchAll(/data-jsy=["']([^"']+)["']/gi)]
        .map((match) => ({ name: text(match[1]), households: null }))
      const prefectureCode = Object.entries(PREFECTURES).find(([, name]) => name === prefectureName)?.[0] ?? null
      outages.push({
        id: `${eventId}-${prefectureCode ?? 'unknown'}-${municipalityName}`,
        eventId,
        state: 'restored',
        outageType,
        prefectureCode,
        prefectureName,
        municipalityCode: null,
        municipalityName,
        startedAt,
        restoredAt,
        status: '復旧済み',
        expectedRestore: '',
        reason,
        households,
        areas,
      })
    }
  }
  return { updatedAt: toIsoJst(updated), outages }
}

export function assertAllowedOutagePath(pathname) {
  const target = new URL(pathname, SOURCE_ORIGIN)
  if (target.origin !== SOURCE_ORIGIN) throw new Error(`Unsupported outage source path: ${pathname}`)
  if (target.pathname === '/' && !target.search) return '/'
  if (/^\/LWC31050\/index\/(?:31|32|33|34|35)\d{3}$/.test(target.pathname) && !target.search) {
    return target.pathname
  }
  if (target.pathname === '/LWC30040/index') {
    const keys = [...target.searchParams.keys()]
    const date = target.searchParams.get('date')
    const type = target.searchParams.get('type')
    if (/^\d{8}$/.test(date ?? '') && (type == null || type === 's')
      && keys.every((key) => key === 'date' || key === 'type')) {
      return `${target.pathname}?${target.searchParams.toString()}`
    }
  }
  throw new Error(`Unsupported outage source path: ${pathname}`)
}

export { PREFECTURES, SOURCE_ORIGIN }
