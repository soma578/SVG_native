import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const containerSource = fs.readFileSync('svgmapAppLayers/Container.svg', 'utf8')
const recipes = JSON.parse(fs.readFileSync('tests/fixtures/applayer-audit-recipes.json', 'utf8'))
const level = Math.max(1, Math.min(3, Number(process.env.APPLAYER_AUDIT_LEVEL || 1)))
const layerTimeoutMs = Math.max(3_000, Number(process.env.APPLAYER_AUDIT_TIMEOUT_MS || 20_000))
const quietWindowMs = Math.max(500, Number(process.env.APPLAYER_AUDIT_QUIET_MS || 1_500))
const filter = process.env.APPLAYER_AUDIT_FILTER
  ? new RegExp(process.env.APPLAYER_AUDIT_FILTER, 'i') : null
const limit = Number(process.env.APPLAYER_AUDIT_LIMIT || 0)
const outputFile = process.env.APPLAYER_AUDIT_OUTPUT
  || path.resolve('artifacts/applayer-audit/report.json')
const priorReportFile = process.env.APPLAYER_AUDIT_PRIOR_REPORT
const priorCategories = new Set((process.env.APPLAYER_AUDIT_PRIOR_CATEGORIES || '')
  .split(',').filter(Boolean))
const priorTitles = priorReportFile ? new Set(JSON.parse(fs.readFileSync(priorReportFile, 'utf8')).results
  .filter((result) => priorCategories.size === 0 || priorCategories.has(result.category))
  .map((result) => result.title)) : null

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`))?.slice(1).find(Boolean) || ''
}

const sourceLayers = [...containerSource.matchAll(/<animation\b[^>]*>/g)].map(({ 0: tag }, index) => ({
  index,
  title: attribute(tag, 'title'),
  href: attribute(tag, 'xlink:href'),
  specialBackend: tag.includes('data-special-server-required'),
  externalApiChanged: tag.includes('data-external-api-changed'),
}))

function expectedCategory(layer) {
  if (layer.externalApiChanged) return 'EXTERNAL_API_CHANGED'
  if (layer.specialBackend) return 'SPECIAL_BACKEND_REQUIRED'
  if (/\{SET YOUR|graphhopperurl=/i.test(layer.href)) return 'CONFIG_REQUIRED'
  if (/Gemini|BYOK/i.test(`${layer.title} ${layer.href}`)) return 'USER_CREDENTIAL_REQUIRED'
  return null
}

function classify(layer, observation) {
  if (observation.proxyPolicyMiss.length) return 'PROXY_POLICY_MISS'
  const expected = expectedCategory(layer)
  if (expected) return expected
  if (observation.specialBackendRequired.length) return 'SPECIAL_BACKEND_REQUIRED'
  if (observation.local404.length) return 'LOCAL_ASSET_404'
  if (observation.upstream5xx.length) return 'UPSTREAM_5XX'
  if (observation.upstream4xx.length) return 'UPSTREAM_4XX'
  if (observation.requestFailures.length) return 'REQUEST_FAILED'
  if (observation.jsErrors.length) return 'JS_ERROR'
  if (observation.timedOut || !observation.hasDocument) return 'TIMEOUT'
  if (level >= 2 && observation.externalSuccesses.length === 0) return 'PASS_NO_VISIBLE_DATA'
  return 'PASS'
}

function compactResponse(response, baseOrigin) {
  const url = response.url()
  const parsed = new URL(url)
  const requestHeaders = response.request().headers()
  const responseHeaders = response.headers()
  return {
    url,
    status: response.status(),
    local: parsed.origin === baseOrigin,
    proxy: parsed.origin === baseOrigin && parsed.pathname === '/api/cors-proxy',
    backend: parsed.origin === baseOrigin && parsed.pathname.startsWith('/api/'),
    proxyError: responseHeaders['x-svgmap-proxy-error'] || null,
    ...(parsed.origin === baseOrigin && parsed.pathname === '/api/cors-proxy' ? {
      requestHeaders: Object.fromEntries(['origin', 'referer', 'sec-fetch-site']
        .filter((name) => requestHeaders[name]).map((name) => [name, requestHeaders[name]])),
    } : {}),
  }
}

async function waitForSvgMap(page) {
  await expect.poll(async () => page.evaluate(() => {
    try {
      return window.svgMap?.getRootLayersProps?.().length || 0
    } catch {
      return 0
    }
  }), {
    timeout: 60_000,
    message: 'SVGMap root layers did not initialize',
  }).toBeGreaterThan(0)
}

async function settleInitialMap(page) {
  await page.evaluate(() => new Promise((resolve) => {
    const timeout = setTimeout(resolve, 10_000)
    document.addEventListener('zoomPanMapCompleted', () => {
      clearTimeout(timeout)
      resolve()
    }, { once: true })
    window.svgMap.refreshScreen()
  }))
}

async function runRecipe(page, recipe) {
  if (!recipe) return []
  const applied = []
  for (const action of recipe.actions || []) {
    const timeoutMs = action.timeoutMs || 10_000
    if (action.type === 'viewport') {
      await page.evaluate(({ lat, lng, latSpan, lngSpan }) => {
        window.svgMap.setGeoViewPort(lat, lng, latSpan, lngSpan)
      }, action)
      applied.push(action)
      continue
    }
    const deadline = Date.now() + timeoutMs
    let frame
    while (!frame && Date.now() < deadline) {
      frame = page.frames().find((candidate) => candidate.url().includes(recipe.frameUrlIncludes))
      if (!frame) await page.waitForTimeout(100)
    }
    if (!frame) throw new Error(`Recipe frame not found: ${recipe.frameUrlIncludes}`)
    const remaining = Math.max(100, deadline - Date.now())
    if (action.type === 'check') await frame.locator(action.selector).check({ timeout: remaining })
    else if (action.type === 'click') await frame.locator(action.selector).click({ timeout: remaining })
    else if (action.type === 'select') await frame.locator(action.selector).selectOption(action.value)
    else throw new Error(`Unknown recipe action: ${action.type}`)
    applied.push(action)
  }
  return applied
}

test('SVGMap AppLayer compatibility audit', async ({ page, baseURL }) => {
  test.setTimeout(2 * 60 * 60 * 1000)
  const baseOrigin = new URL(baseURL).origin
  await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await waitForSvgMap(page)
  await settleInitialMap(page)

  const browserLayers = await page.evaluate(() => window.svgMap.getRootLayersProps().map((layer) => ({
    id: layer.id,
    title: layer.title,
    href: layer.href,
    visible: layer.visible,
  })))
  let layers = browserLayers.map((layer, index) => ({
    ...sourceLayers[index],
    ...layer,
  }))
  if (filter) layers = layers.filter((layer) => filter.test(`${layer.title} ${layer.href}`))
  if (priorTitles) layers = layers.filter((layer) => priorTitles.has(layer.title))
  if (limit > 0) layers = layers.slice(0, limit)

  const results = []
  for (const [position, layer] of layers.entries()) {
    // A fresh document prevents requests and delayed controller teardown from
    // the preceding layer being attributed to the next one.
    if (position > 0) {
      await page.goto('/svgmap.html', { waitUntil: 'domcontentloaded', timeout: 120_000 })
      await waitForSvgMap(page)
      await settleInitialMap(page)
    }
    // Let the default basemap finish its immediate work before observation.
    await page.waitForTimeout(quietWindowMs)

    const observation = {
      hasDocument: false,
      timedOut: false,
      requests: [],
      externalSuccesses: [],
      local404: [],
      proxyPolicyMiss: [],
      specialBackendRequired: [],
      upstream4xx: [],
      upstream5xx: [],
      requestFailures: [],
      jsErrors: [],
      recipeActions: [],
      ignoredRequestFailures: [],
      ignoredLocal404: [],
      ignoredUpstream4xx: [],
      requestCount: 0,
    }
    let lastActivity = Date.now()
    const onResponse = (response) => {
      const record = compactResponse(response, baseOrigin)
      const responseHost = new URL(record.url).hostname
      if (/^[abc]\.tile\.openstreetmap\.org$/.test(responseHost)
        && !/OpenStreetMap/i.test(layer.title)) return
      observation.requestCount++
      if (observation.requests.length < 200) observation.requests.push(record)
      lastActivity = Date.now()
      if (record.local && !record.proxy && record.status === 404) {
        const pathname = new URL(record.url).pathname
        if (/\/authoringLayers\/local\/(?:[^/]+\/)*(?:uploaded\/)?index\.txt$/.test(pathname)) {
          observation.ignoredLocal404.push(record)
        } else observation.local404.push(record)
      }
      else if (record.proxy && ['caller', 'policy'].includes(record.proxyError)) observation.proxyPolicyMiss.push(record)
      else if (record.proxy && record.status === 405) observation.specialBackendRequired.push(record)
      else if (record.status >= 500) observation.upstream5xx.push(record)
      else if (record.status >= 400) observation.upstream4xx.push(record)
      else if (!record.local || record.backend) observation.externalSuccesses.push(record)
    }
    const onRequestFailed = (request) => {
      const record = {
        url: request.url(),
        error: request.failure()?.errorText || 'failed',
        resourceType: request.resourceType(),
      }
      if (record.error === 'net::ERR_ABORTED' && new URL(record.url).origin === baseOrigin) {
        observation.ignoredRequestFailures.push(record)
        return
      }
      if (observation.requestFailures.length < 100) observation.requestFailures.push(record)
      lastActivity = Date.now()
    }
    const onPageError = (error) => {
      if (observation.jsErrors.length < 100) observation.jsErrors.push(String(error.stack || error.message || error))
    }
    page.on('response', onResponse)
    page.on('requestfailed', onRequestFailed)
    page.on('pageerror', onPageError)

    const startedAt = Date.now()
    try {
      await page.evaluate(({ id }) => {
        window.__appLayerAuditCompleted = false
        document.addEventListener('zoomPanMapCompleted', () => {
          window.__appLayerAuditCompleted = true
        }, { once: true })
        const item = window.svgMap.getRootLayersProps().find((candidate) => candidate.id === id)
        if (item?.visible) window.svgMap.setRootLayersProps(id, false, false)
        window.svgMap.setRootLayersProps(id, true, false)
        window.svgMap.refreshScreen()
      }, { id: layer.id })

      const recipe = level >= 3 ? recipes[layer.title] : null
      if (recipe) observation.recipeActions = await runRecipe(page, recipe)

      while (Date.now() - startedAt < layerTimeoutMs) {
        const state = await page.evaluate((id) => {
          const item = window.svgMap.getRootLayersProps().find((candidate) => candidate.id === id)
          return { hasDocument: Boolean(item?.hasDocument), completed: Boolean(window.__appLayerAuditCompleted) }
        }, layer.id)
        observation.hasDocument ||= state.hasDocument
        const quiet = Date.now() - lastActivity >= quietWindowMs
        if (observation.hasDocument && quiet && (state.completed || Date.now() - startedAt >= quietWindowMs * 2)) break
        await page.waitForTimeout(200)
      }
      observation.timedOut = !observation.hasDocument || Date.now() - startedAt >= layerTimeoutMs
    } catch (error) {
      observation.jsErrors.push(String(error.message || error))
    } finally {
      page.off('response', onResponse)
      page.off('requestfailed', onRequestFailed)
      page.off('pageerror', onPageError)
    }

    // Missing map tiles outside a provider's coverage are normal when other
    // resources from that host succeeded. Preserve them as diagnostics without
    // turning the whole layer red.
    const successfulHosts = new Set(observation.externalSuccesses.map((record) => new URL(record.url).hostname))
    observation.ignoredUpstream4xx = observation.upstream4xx
      .filter((record) => successfulHosts.has(new URL(record.url).hostname))
    observation.upstream4xx = observation.upstream4xx
      .filter((record) => !successfulHosts.has(new URL(record.url).hostname))
    const retainedFailures = []
    for (const record of observation.requestFailures) {
      if (successfulHosts.has(new URL(record.url).hostname) && record.resourceType === 'image') {
        observation.ignoredRequestFailures.push(record)
      } else retainedFailures.push(record)
    }
    observation.requestFailures = retainedFailures

    const category = classify(layer, observation)
    const result = {
      number: layer.number ?? layer.index,
      id: layer.id,
      title: layer.title,
      href: layer.href,
      level,
      category,
      durationMs: Date.now() - startedAt,
      ...observation,
    }
    results.push(result)
    console.log(`[${position + 1}/${layers.length}] ${category} ${layer.title}`)
  }

  const counts = Object.fromEntries([...new Set(results.map((result) => result.category))]
    .sort().map((category) => [category, results.filter((result) => result.category === category).length]))
  const report = {
    generatedAt: new Date().toISOString(),
    target: baseURL,
    level,
    filter: process.env.APPLAYER_AUDIT_FILTER || null,
    totalContainerLayers: browserLayers.length,
    auditedLayers: results.length,
    counts,
    results,
  }
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`AppLayer audit report: ${outputFile}`)

  const failOn = new Set((process.env.APPLAYER_AUDIT_FAIL_ON || '').split(',').filter(Boolean))
  const failures = results.filter((result) => failOn.has(result.category))
  expect(failures, `Categories selected by APPLAYER_AUDIT_FAIL_ON: ${[...failOn].join(', ')}`).toHaveLength(0)
})
