import fs from 'node:fs'
import path from 'node:path'
import { CORS_PROXY_POLICIES, findProxyPolicy } from '../app/api/cors-proxy/policy.js'

const root = path.resolve('svgmapAppLayers')
const sourceExtensions = new Set(['.html', '.js', '.json', '.svg'])
const sourceFiles = []
const networkCallFiles = []

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(filename)
    else if (entry.isFile() && sourceExtensions.has(path.extname(entry.name))) sourceFiles.push(filename)
  }
}
walk(root)

const proxyFiles = []
const candidateHosts = new Map()
const urlPattern = /https?:\/\/[^\s"'<>`)]+/g
for (const filename of sourceFiles) {
  const source = fs.readFileSync(filename, 'utf8')
  if (/getCORSURL\s*\(|\bfetch\s*\(|XMLHttpRequest|\.open\s*\(\s*['"]GET['"]/.test(source)) {
    networkCallFiles.push(path.relative('.', filename))
  }
  if (!source.includes('getCORSURL(')) continue
  proxyFiles.push(path.relative('.', filename))
  for (const rawMatch of source.match(urlPattern) || []) {
    const rawUrl = rawMatch.replace(/[.,;]+$/, '')
    try {
      const url = new URL(rawUrl)
      const record = candidateHosts.get(url.hostname) || { references: 0, allowed: false }
      record.references++
      record.allowed ||= Boolean(findProxyPolicy(url))
      candidateHosts.set(url.hostname, record)
    } catch {
      // Templates and examples that are not concrete URLs remain visible through
      // their source file but cannot be classified statically.
    }
  }
}

const phpFiles = []
function walkPhp(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) walkPhp(filename)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.php')) phpFiles.push(path.relative('.', filename))
  }
}
walkPhp(root)

const missingHosts = [...candidateHosts]
  .filter(([, record]) => !record.allowed)
  .sort(([a], [b]) => a.localeCompare(b))

const container = fs.readFileSync(path.join(root, 'Container.svg'), 'utf8')
const containerLayers = [...container.matchAll(/<animation\b[^>]*>/g)].map((match) => match[0])
const proxyFlagLayers = containerLayers.filter((tag) => tag.includes('data-cross-origin-proxy-required')).length
const specialBackendLayers = containerLayers.filter((tag) => tag.includes('data-special-server-required')).length

console.log(JSON.stringify({
  summary: {
    sourceFiles: sourceFiles.length,
    containerLayers: containerLayers.length,
    proxyFlagLayers,
    specialBackendLayers,
    networkCallFiles: networkCallFiles.length,
    explicitGetCORSURLFiles: proxyFiles.length,
    proxyPolicies: CORS_PROXY_POLICIES.length,
    candidateHosts: candidateHosts.size,
    candidatesOutsideAllowlist: missingHosts.length,
    phpBackends: phpFiles.length,
  },
  note: 'Host candidates come from files with getCORSURL calls and require code review; comments, documentation links, and unrelated resources are intentionally not auto-allowed.',
  candidatesOutsideAllowlist: Object.fromEntries(missingHosts),
  phpBackends: phpFiles,
}, null, 2))
