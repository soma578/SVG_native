import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const links = new Map([
	['svgmap.html', '../index.html'],
	['svgmapjs', '../svgmapjs'],
  ['svgmapAppLayers', '../svgmapAppLayers'],
  ['sw.js', '../sw.js'],
])

fs.mkdirSync(publicDir, { recursive: true })

for (const [name, relativeTarget] of links) {
  const linkPath = path.join(publicDir, name)
  const expectedTarget = path.resolve(publicDir, relativeTarget)
  if (!fs.existsSync(expectedTarget)) {
    throw new Error(`SVGMap asset is missing: ${expectedTarget}`)
  }

  try {
    const stat = fs.lstatSync(linkPath)
    if (!stat.isSymbolicLink() || fs.realpathSync(linkPath) !== fs.realpathSync(expectedTarget)) {
      throw new Error(`Refusing to replace non-matching public asset: ${linkPath}`)
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    fs.symlinkSync(relativeTarget, linkPath, fs.statSync(expectedTarget).isDirectory() ? 'dir' : 'file')
  }
}

console.log('[assets] SVGMap source trees are exposed through public symlinks')
